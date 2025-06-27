
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { AreaName, AchievementsState, CertificateStatus, CERTIFICATE_THRESHOLDS, User } from '@/lib/config';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { useChallengeConfig } from './ChallengeConfigContext';

type AllAchievementsState = Record<string, AchievementsState>; // Keyed by username

interface AchievementsContextType {
  getAchievements: (username: string) => AchievementsState;
  setProgress: (username: string, area: AreaName, progress: number | string) => Promise<void>;
  toggleCertification: (username: string, area: AreaName) => Promise<void>;
  certificateStatus: (username: string) => CertificateStatus;
  loading: boolean;
}

const AchievementsContext = createContext<AchievementsContextType | undefined>(undefined);

const generateInitialStateForUser = (challengeConfig: any): AchievementsState => {
    const studentAchievements = {} as AchievementsState;
    if (!challengeConfig || typeof challengeConfig !== 'object') return studentAchievements;
    
    Object.keys(challengeConfig).forEach(area => {
        const config = challengeConfig[area as AreaName];
        if (!config || typeof config !== 'object') return;

        let initialProgress: string | number = '';
        if (config.goalType === 'numeric') {
            initialProgress = 0;
        } else if (config.goalType === 'objective') {
            if (area === 'Information') {
                initialProgress = '입문';
            } else if (area === 'Physical-Education') {
                initialProgress = '5등급';
            } else {
                initialProgress = '';
            }
        }

        studentAchievements[area] = {
            progress: initialProgress,
            isCertified: false
        };
    });
    return studentAchievements;
}

export const AchievementsProvider = ({ children }: { children: ReactNode }) => {
  const [allAchievements, setAllAchievements] = useState<AllAchievementsState | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, users, loading: authLoading } = useAuth();
  const { challengeConfig, loading: configLoading } = useChallengeConfig();

  useEffect(() => {
    if (authLoading || configLoading || !db || !user || !challengeConfig) {
      if (!authLoading && !configLoading) {
        setLoading(false);
        setAllAchievements({});
      }
      return;
    }

    setLoading(true);
    
    let unsubscribe: () => void;

    if (user.role === 'teacher') {
        const achievementsCollection = collection(db, 'achievements');
        unsubscribe = onSnapshot(achievementsCollection, (querySnapshot) => {
            const fetchedAchievements: AllAchievementsState = {};
            querySnapshot.forEach(doc => {
                const data = doc.data();
                // Ensure data is an object before processing
                if(data && typeof data === 'object') {
                    fetchedAchievements[doc.id] = data as AchievementsState;
                }
            });
            setAllAchievements(fetchedAchievements);
            setLoading(false);
        }, (error) => {
            console.error("Failed to listen for achievement updates:", error);
            setLoading(false);
            setAllAchievements({});
        });
    } else { // student
        const studentDocRef = doc(db, 'achievements', user.username);
        unsubscribe = onSnapshot(studentDocRef, (docSnap) => {
            const fetchedAchievements: AllAchievementsState = {};
             if (docSnap.exists()) {
                  const data = docSnap.data();
                  // Ensure data is an object before processing
                  if(data && typeof data === 'object') {
                      fetchedAchievements[user.username] = data as AchievementsState;
                  }
              }
              setAllAchievements(fetchedAchievements);
              setLoading(false);
        }, (error) => {
            console.error(`Failed to listen for student ${user.username} achievement updates:`, error);
            setLoading(false);
            setAllAchievements({});
        });
    }

    return () => unsubscribe && unsubscribe();

  }, [user, authLoading, challengeConfig, configLoading]);


  const getAchievements = useCallback((username: string): AchievementsState => {
    const baseDefaultState = generateInitialStateForUser(challengeConfig);
    if (!allAchievements || !challengeConfig || !allAchievements[username]) {
        return baseDefaultState;
    }
    
    const userAchievements = allAchievements[username];
    const finalState = {} as AchievementsState;

    for (const area of Object.keys(baseDefaultState)) {
        const defaultAreaState = baseDefaultState[area];
        const userAreaState = userAchievements ? userAchievements[area] : undefined;
        
        // Defensively ensure both are valid objects before spreading.
        const safeDefault = (typeof defaultAreaState === 'object' && defaultAreaState !== null) 
            ? defaultAreaState 
            : { progress: 0, isCertified: false };

        const safeUser = (typeof userAreaState === 'object' && userAreaState !== null) 
            ? userAreaState 
            : {};

        finalState[area] = { ...safeDefault, ...safeUser };
    }
    return finalState;
  }, [allAchievements, challengeConfig]);

  const setProgress = useCallback(async (username: string, area: AreaName, progress: number | string) => {
    if (!db || !challengeConfig || !users) return;

    try {
        const achievementDocRef = doc(db, 'achievements', username);
        const areaConfig = challengeConfig[area];
        const student = users.find(u => u.username === username);

        const docSnap = await getDoc(achievementDocRef);
        const currentData = docSnap.exists() && docSnap.data()?.[area] ? docSnap.data()?.[area] : {};
        
        let newIsCertified;

        // For objective types with auto-certify rules, the status is directly tied to the value.
        if (areaConfig?.goalType === 'objective' && areaConfig.autoCertifyOn && typeof progress === 'string') {
            newIsCertified = areaConfig.autoCertifyOn.includes(progress);
        } 
        // For numeric types, certify if goal is met (and don't un-certify).
        else if (areaConfig?.goalType === 'numeric' && typeof progress === 'number' && student?.grade !== undefined) {
            const gradeKey = student.grade === 0 ? '6' : String(student.grade);
            const goal = areaConfig.goal?.[gradeKey] ?? 0;
            const meetsGoal = goal > 0 && progress >= goal;
            newIsCertified = (currentData.isCertified ?? false) || meetsGoal;
        } else {
            // For objective types without auto-certify rules, or other cases, don't change certification status.
            newIsCertified = currentData.isCertified ?? false;
        }
        
        const newData = {
            progress: progress,
            isCertified: newIsCertified,
        };

        await setDoc(achievementDocRef, { [area]: newData }, { merge: true });

    } catch(e) {
        console.warn("Failed to update progress in Firestore", e);
        throw e;
    }
  }, [challengeConfig, users]);

  const toggleCertification = useCallback(async (username: string, area: AreaName) => {
    if (!db) return;
    try {
        const achievementDocRef = doc(db, 'achievements', username);
        const docSnap = await getDoc(achievementDocRef);
        const currentIsCertified = docSnap.exists() ? (docSnap.data()?.[area]?.isCertified ?? false) : false;
        const newIsCertified = !currentIsCertified;
        
        await setDoc(achievementDocRef, { [area]: { isCertified: newIsCertified } }, { merge: true });
    } catch (e) {
        console.warn("Failed to toggle certification in Firestore", e);
    }
  }, []);
  
  const certificateStatus = useCallback((username: string): CertificateStatus => {
    const userAchievements = getAchievements(username);
    const certifiedCount = Object.values(userAchievements).filter(a => a && a.isCertified).length;
    
    if (certifiedCount >= CERTIFICATE_THRESHOLDS.GOLD) return 'Gold';
    if (certifiedCount >= CERTIFICATE_THRESHOLDS.SILVER) return 'Silver';
    if (certifiedCount >= CERTIFICATE_THRESHOLDS.BRONZE) return 'Bronze';
    return 'Unranked';
  }, [getAchievements]);

  return (
    <AchievementsContext.Provider value={{ getAchievements, setProgress, toggleCertification, certificateStatus, loading }}>
      {children}
    </AchievementsContext.Provider>
  );
};

export const useAchievements = () => {
  const context = useContext(AchievementsContext);
  if (context === undefined) {
    throw new Error('useAchievements must be used within an AchievementsProvider');
  }
  return context;
};
