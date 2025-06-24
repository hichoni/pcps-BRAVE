"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { AreaName, AchievementsState, CertificateStatus, AREAS, CERTIFICATE_THRESHOLDS, AREAS_CONFIG } from '@/lib/config';

type AllAchievementsState = Record<string, AchievementsState>; // Keyed by username

interface AchievementsContextType {
  getAchievements: (username: string) => AchievementsState | null;
  updateProgress: (username: string, area: AreaName, progress: number) => Promise<void>;
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

  useEffect(() => {
    if (authLoading) return; // Wait for users to be available

    try {
      const storedDataRaw = localStorage.getItem('allAchievements');
      const storedData: AllAchievementsState = storedDataRaw ? JSON.parse(storedDataRaw) : {};
      
      const students = users.filter(u => u.role === 'student');
      let needsUpdate = false;

      // Ensure all current students have an entry
      students.forEach(student => {
          if (!storedData[student.username]) {
              storedData[student.username] = generateInitialStateForUser();
              needsUpdate = true;
          }
      });

      // Prune achievements for users that no longer exist
      const studentUsernames = new Set(students.map(s => s.username));
      for (const username in storedData) {
          if (!studentUsernames.has(username)) {
              delete storedData[username];
              needsUpdate = true;
          }
      }

      setAllAchievements(storedData);
      if (needsUpdate) {
        localStorage.setItem('allAchievements', JSON.stringify(storedData));
      }

    } catch (error) {
      console.error("Failed to process achievements from localStorage", error);
      const initialState: AllAchievementsState = {};
      users.filter(u => u.role === 'student').forEach(student => {
          initialState[student.username] = generateInitialStateForUser();
      });
      setAllAchievements(initialState);
    } finally {
      setLoading(false);
    }
  }, [users, authLoading]);

  useEffect(() => {
    if (allAchievements && !loading) {
      try {
        localStorage.setItem('allAchievements', JSON.stringify(allAchievements));
      } catch (error) {
        console.error("Failed to save achievements to localStorage", error);
      }
    }
  }, [allAchievements, loading]);

  const getAchievements = useCallback((username: string): AchievementsState | null => {
    if (!allAchievements) return null;
    return allAchievements[username] || null;
  }, [allAchievements]);

  const updateProgress = useCallback(async (username: string, area: AreaName, progress: number) => {
    setAllAchievements(prev => {
      if (!prev || !prev[username]) return prev;

      const areaConfig = AREAS_CONFIG[area];
      const isCertified = progress >= areaConfig.goal;
      
      const newState = { ...prev };
      newState[username] = {
        ...prev[username],
        [area]: {
          progress,
          isCertified,
        },
      };
      return newState;
    });
  }, []);
  
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
    <AchievementsContext.Provider value={{ getAchievements, updateProgress, certificateStatus, loading }}>
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
