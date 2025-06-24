
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { AreaName, AchievementsState, CertificateStatus, CERTIFICATE_THRESHOLDS, User } from '@/lib/config';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, updateDoc, getDoc } from 'firebase/firestore';
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
    if (!challengeConfig) return studentAchievements;
    
    Object.keys(challengeConfig).forEach(area => {
        const config = challengeConfig[area];
        studentAchievements[area] = {
            progress: config.goalType === 'numeric' ? 0 : '',
            isCertified: false
        };
    });
    return studentAchievements;
}

export const AchievementsProvider = ({ children }: { children: ReactNode }) => {
  const [allAchievements, setAllAchievements] = useState<AllAchievementsState | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const { challengeConfig, loading: configLoading } = useChallengeConfig();

  useEffect(() => {
    const loadData = async () => {
      if (authLoading || configLoading) return;

      setLoading(true);
      try {
        if (!user || !challengeConfig) {
          setAllAchievements({});
          return;
        }
        
        const fetchedAchievements: AllAchievementsState = {};
        if (!db) {
          console.warn("Firebase is not configured. No achievements will be loaded.");
          fetchedAchievements[user.username] = generateInitialStateForUser(challengeConfig);
        } else {
          if (user.role === 'teacher') {
            const querySnapshot = await getDocs(collection(db, 'achievements'));
            querySnapshot.forEach(doc => {
                const data = doc.data();
                const achievements = generateInitialStateForUser(challengeConfig);
                Object.keys(achievements).forEach(key => {
                    const area = key as AreaName;
                    if (data[area]) {
                        achievements[area] = { ...achievements[area], ...data[area] };
                    }
                });
                fetchedAchievements[doc.id] = achievements;
            });
          } else if (user.role === 'student') {
              const studentDocRef = doc(db, 'achievements', user.username);
              const docSnap = await getDoc(studentDocRef);
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  const achievements = generateInitialStateForUser(challengeConfig);
                  Object.keys(achievements).forEach(key => {
                      const area = key as AreaName;
                      if (data[area]) {
                          achievements[area] = { ...achievements[area], ...data[area] };
                      }
                  });
                  fetchedAchievements[user.username] = achievements;
              } else {
                  fetchedAchievements[user.username] = generateInitialStateForUser(challengeConfig);
              }
          }
        }
        setAllAchievements(fetchedAchievements);
      } catch (error) {
        console.warn("Failed to fetch achievements from Firestore", error);
        setAllAchievements({});
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, authLoading, challengeConfig, configLoading]);


  const getAchievements = useCallback((username: string): AchievementsState => {
    if (!allAchievements || !challengeConfig) return generateInitialStateForUser(challengeConfig);
    
    // Ensure all areas from current config exist for the user
    const userAchievements = allAchievements[username] || {};
    const defaultState = generateInitialStateForUser(challengeConfig);
    const finalState: AchievementsState = { ...defaultState };

    for (const area in defaultState) {
        if (userAchievements[area]) {
            finalState[area] = userAchievements[area];
        }
    }
    return finalState;

  }, [allAchievements, challengeConfig]);

  const setProgress = useCallback(async (username: string, area: AreaName, progress: number | string) => {
    setAllAchievements(prev => {
      if (!prev) return null;
      const userAchievements = prev[username] || generateInitialStateForUser(challengeConfig);
      return {
        ...prev,
        [username]: {
          ...userAchievements,
          [area]: { ...userAchievements[area], progress },
        },
      };
    });

    if (!db) return;

    try {
        const achievementDocRef = doc(db, 'achievements', username);
        const fieldPath = `${area}.progress`;
        await setDoc(achievementDocRef, { [area]: { progress } }, { merge: true });
    } catch(e) {
        console.warn("Failed to update progress in Firestore", e);
    }
  }, [challengeConfig]);

  const toggleCertification = useCallback(async (username: string, area: AreaName) => {
    const currentIsCertified = allAchievements?.[username]?.[area]?.isCertified ?? false;
    const newIsCertified = !currentIsCertified;

    setAllAchievements(prev => {
      if (!prev) return null;
      const userAchievements = prev[username] || generateInitialStateForUser(challengeConfig);
      return {
        ...prev,
        [username]: {
          ...userAchievements,
          [area]: { ...userAchievements[area], isCertified: newIsCertified },
        },
      };
    });

    if (!db) return;

    try {
        const achievementDocRef = doc(db, 'achievements', username);
        const fieldPath = `${area}.isCertified`;
        await setDoc(achievementDocRef, { [area]: { isCertified: newIsCertified } }, { merge: true });
    } catch (e) {
        console.warn("Failed to toggle certification in Firestore", e);
    }

  }, [allAchievements, challengeConfig]);
  
  const certificateStatus = useCallback((username: string): CertificateStatus => {
    if (!allAchievements || !allAchievements[username]) return 'Unranked';
    
    const userAchievements = getAchievements(username);
    const certifiedCount = Object.values(userAchievements).filter(a => a.isCertified).length;
    
    if (certifiedCount >= CERTIFICATE_THRESHOLDS.GOLD) return 'Gold';
    if (certifiedCount >= CERTIFICATE_THRESHOLDS.SILVER) return 'Silver';
    if (certifiedCount >= CERTIFICATE_THRESHOLDS.BRONZE) return 'Bronze';
    return 'Unranked';
  }, [allAchievements, getAchievements]);

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
