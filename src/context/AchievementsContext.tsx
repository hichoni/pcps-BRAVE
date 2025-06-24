"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AreaName, AchievementsState, CertificateStatus, AREAS, CERTIFICATE_THRESHOLDS, AREAS_CONFIG, MOCK_USERS } from '@/lib/config';

type AllAchievementsState = Record<string, AchievementsState>; // Keyed by username

interface AchievementsContextType {
  getAchievements: (username: string) => AchievementsState | null;
  updateProgress: (username: string, area: AreaName, progress: number) => Promise<void>;
  certificateStatus: (username: string) => CertificateStatus;
  loading: boolean;
}

const AchievementsContext = createContext<AchievementsContextType | undefined>(undefined);

const generateInitialState = (): AllAchievementsState => {
  const allAchievements: AllAchievementsState = {};
  MOCK_USERS.forEach(user => {
    if (user.role === 'student') {
      const studentAchievements = {} as AchievementsState;
      AREAS.forEach(area => {
        studentAchievements[area] = {
          progress: 0,
          isCertified: false
        };
      });
      allAchievements[user.username] = studentAchievements;
    }
  });
  return allAchievements;
};

export const AchievementsProvider = ({ children }: { children: ReactNode }) => {
  const [allAchievements, setAllAchievements] = useState<AllAchievementsState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedData = localStorage.getItem('allAchievements');
      if (storedData) {
        setAllAchievements(JSON.parse(storedData));
      } else {
        setAllAchievements(generateInitialState());
      }
    } catch (error) {
      console.error("Failed to parse achievements from localStorage", error);
      setAllAchievements(generateInitialState());
    } finally {
      setLoading(false);
    }
  }, []);

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
