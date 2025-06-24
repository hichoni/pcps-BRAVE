"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { AreaName, AchievementsState, CertificateStatus, AREAS, CERTIFICATE_THRESHOLDS, User } from '@/lib/config';
import { useChallengeConfig } from './ChallengeConfigContext';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

type AllAchievementsState = Record<string, AchievementsState>; // Keyed by username

interface AchievementsContextType {
  getAchievements: (username: string) => AchievementsState | null;
  updateProgress: (username: string, area: AreaName, progress: number) => Promise<void>;
  toggleCertification: (username: string, area: AreaName) => Promise<void>;
  certificateStatus: (username: string) => CertificateStatus;
  loading: boolean;
}

const AchievementsContext = createContext<AchievementsContextType | undefined>(undefined);

const generateInitialStateForUser = (): AchievementsState => {
    const studentAchievements = {} as AchievementsState;
    AREAS.forEach(area => {
        studentAchievements[area] = {
            progress: 0,
            isCertified: false
        };
    });
    return studentAchievements;
}

export const AchievementsProvider = ({ children }: { children: ReactNode }) => {
  const [allAchievements, setAllAchievements] = useState<AllAchievementsState | null>(null);
  const [loading, setLoading] = useState(true);
  const { users, loading: authLoading } = useAuth();
  const { loading: configLoading } = useChallengeConfig();

  useEffect(() => {
    const fetchAchievements = async () => {
      if (authLoading || !db) return;

      setLoading(true);
      try {
        const achievementsCollectionRef = collection(db, 'achievements');
        const querySnapshot = await getDocs(achievementsCollectionRef);
        const fetchedAchievements: AllAchievementsState = {};
        querySnapshot.forEach(doc => {
            fetchedAchievements[doc.id] = doc.data() as AchievementsState;
        });

        const students = users.filter(u => u.role === 'student');
        
        // Use a Firestore batch to create missing achievement documents
        const batch: { ref: any; data: AchievementsState }[] = [];

        students.forEach(student => {
            if (!fetchedAchievements[student.username]) {
                const newAchievement = generateInitialStateForUser();
                fetchedAchievements[student.username] = newAchievement;
                
                const achievementDocRef = doc(db, 'achievements', student.username);
                batch.push({ ref: achievementDocRef, data: newAchievement });
            }
        });
        
        if (batch.length > 0) {
            console.log(`Creating achievement entries for ${batch.length} new students...`);
            // Firestore write batch can't be used here easily as it's not imported, so simple loop is fine.
            for (const item of batch) {
                await setDoc(item.ref, item.data);
            }
        }
        
        setAllAchievements(fetchedAchievements);

      } catch (error) {
        console.error("Failed to fetch achievements from Firestore", error);
        setAllAchievements({}); // Set to empty on error
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && users.length > 0) {
      fetchAchievements();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [users, authLoading]);


  const getAchievements = useCallback((username: string): AchievementsState | null => {
    if (!allAchievements) return generateInitialStateForUser(); // Return default if not loaded
    return allAchievements[username] || generateInitialStateForUser();
  }, [allAchievements]);

  const updateProgress = useCallback(async (username: string, area: AreaName, progress: number) => {
    if (!db) throw new Error("DB not initialized");
    
    // Optimistic UI update
    setAllAchievements(prev => {
      if (!prev) return null;
      const userAchievements = prev[username] || generateInitialStateForUser();
      return {
        ...prev,
        [username]: {
          ...userAchievements,
          [area]: { ...userAchievements[area], progress },
        },
      };
    });

    try {
        const achievementDocRef = doc(db, 'achievements', username);
        const fieldPath = `${area}.progress`;
        await updateDoc(achievementDocRef, { [fieldPath]: progress });
    } catch(e) {
        console.error("Failed to update progress in Firestore", e);
        // Here you could add logic to revert the optimistic update
    }
  }, []);

  const toggleCertification = useCallback(async (username: string, area: AreaName) => {
    if (!db) throw new Error("DB not initialized");

    const currentIsCertified = allAchievements?.[username]?.[area]?.isCertified ?? false;
    const newIsCertified = !currentIsCertified;

    // Optimistic UI update
    setAllAchievements(prev => {
      if (!prev) return null;
      const userAchievements = prev[username] || generateInitialStateForUser();
      return {
        ...prev,
        [username]: {
          ...userAchievements,
          [area]: { ...userAchievements[area], isCertified: newIsCertified },
        },
      };
    });

    try {
        const achievementDocRef = doc(db, 'achievements', username);
        const fieldPath = `${area}.isCertified`;
        await updateDoc(achievementDocRef, { [fieldPath]: newIsCertified });
    } catch (e) {
        console.error("Failed to toggle certification in Firestore", e);
        // Here you could add logic to revert the optimistic update
    }

  }, [allAchievements]);
  
  const certificateStatus = useCallback((username: string): CertificateStatus => {
    if (!allAchievements || !allAchievements[username]) return 'Unranked';
    
    const userAchievements = allAchievements[username];
    const certifiedCount = Object.values(userAchievements).filter(a => a.isCertified).length;
    
    if (certifiedCount >= CERTIFICATE_THRESHOLDS.GOLD) return 'Gold';
    if (certifiedCount >= CERTIFICATE_THRESHOLDS.SILVER) return 'Silver';
    if (certifiedCount >= CERTIFICATE_THRESHOLDS.BRONZE) return 'Bronze';
    return 'Unranked';
  }, [allAchievements]);

  return (
    <AchievementsContext.Provider value={{ getAchievements, updateProgress, toggleCertification, certificateStatus, loading: loading || configLoading || authLoading }}>
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
