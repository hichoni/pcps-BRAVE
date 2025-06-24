
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { AreaName, AchievementsState, CertificateStatus, AREAS, CERTIFICATE_THRESHOLDS, User } from '@/lib/config';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, updateDoc, getDoc } from 'firebase/firestore';

type AllAchievementsState = Record<string, AchievementsState>; // Keyed by username

interface AchievementsContextType {
  getAchievements: (username: string) => AchievementsState;
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
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const loadData = async () => {
      // Wait for authentication to be resolved before doing anything.
      if (authLoading) {
        return;
      }

      setLoading(true);
      try {
        // If there is no user, we are done. Set empty state.
        if (!user) {
          setAllAchievements({});
          return;
        }
        
        const fetchedAchievements: AllAchievementsState = {};
        if (!db) {
          console.warn("Firebase is not configured. No achievements will be loaded.");
          fetchedAchievements[user.username] = generateInitialStateForUser();
        } else {
          if (user.role === 'teacher') {
            const querySnapshot = await getDocs(collection(db, 'achievements'));
            querySnapshot.forEach(doc => {
                const data = doc.data();
                const achievements = generateInitialStateForUser();
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
                  const achievements = generateInitialStateForUser();
                  Object.keys(achievements).forEach(key => {
                      const area = key as AreaName;
                      if (data[area]) {
                          achievements[area] = { ...achievements[area], ...data[area] };
                      }
                  });
                  fetchedAchievements[user.username] = achievements;
              } else {
                  fetchedAchievements[user.username] = generateInitialStateForUser();
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
  }, [user, authLoading]);


  const getAchievements = useCallback((username: string): AchievementsState => {
    if (!allAchievements) return generateInitialStateForUser(); // Return default if not loaded
    return allAchievements[username] || generateInitialStateForUser();
  }, [allAchievements]);

  const updateProgress = useCallback(async (username: string, area: AreaName, progress: number) => {
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

    if (!db) {
        return;
    }

    try {
        const achievementDocRef = doc(db, 'achievements', username);
        const fieldPath = `${area}.progress`;
        await updateDoc(achievementDocRef, { [fieldPath]: progress });
    } catch(e) {
        console.warn("Failed to update progress in Firestore", e);
        // Here you could add logic to revert the optimistic update
    }
  }, []);

  const toggleCertification = useCallback(async (username: string, area: AreaName) => {
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

    if (!db) {
        return;
    }

    try {
        const achievementDocRef = doc(db, 'achievements', username);
        const fieldPath = `${area}.isCertified`;
        await updateDoc(achievementDocRef, { [fieldPath]: newIsCertified });
    } catch (e) {
        console.warn("Failed to toggle certification in Firestore", e);
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
    <AchievementsContext.Provider value={{ getAchievements, updateProgress, toggleCertification, certificateStatus, loading }}>
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
