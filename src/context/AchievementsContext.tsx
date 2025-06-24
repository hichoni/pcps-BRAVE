"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AreaName, Achievement, AchievementsState, AREAS, CERTIFICATE_THRESHOLDS, CertificateStatus } from '@/lib/config';

interface AchievementsContextType {
  achievements: AchievementsState | null;
  addAchievement: (area: AreaName, achievement: Achievement) => void;
  certificateStatus: CertificateStatus;
  loading: boolean;
}

const AchievementsContext = createContext<AchievementsContextType | undefined>(undefined);

const initialAchievementsState: AchievementsState = AREAS.reduce((acc, area) => {
  acc[area] = { achievements: [], isCertified: false };
  return acc;
}, {} as AchievementsState);

export const AchievementsProvider = ({ children }: { children: ReactNode }) => {
  const [achievements, setAchievements] = useState<AchievementsState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedAchievements = localStorage.getItem('achievements');
      if (storedAchievements) {
        setAchievements(JSON.parse(storedAchievements));
      } else {
        setAchievements(initialAchievementsState);
      }
    } catch (error) {
      console.error("Failed to parse achievements from localStorage", error);
      setAchievements(initialAchievementsState);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (achievements) {
      try {
        localStorage.setItem('achievements', JSON.stringify(achievements));
      } catch (error) {
        console.error("Failed to save achievements to localStorage", error);
      }
    }
  }, [achievements]);

  const addAchievement = useCallback((area: AreaName, newAchievement: Achievement) => {
    setAchievements(prev => {
      if (!prev) return null;
      const newState = {
        ...prev,
        [area]: {
          ...prev[area],
          achievements: [...prev[area].achievements, newAchievement],
          isCertified: true,
        },
      };
      return newState;
    });
  }, []);
  
  const certificateStatus = React.useMemo<CertificateStatus>(() => {
    if (!achievements) return 'Unranked';
    const certifiedCount = Object.values(achievements).filter(a => a.isCertified).length;
    if (certifiedCount >= CERTIFICATE_THRESHOLDS.GOLD) return 'Gold';
    if (certifiedCount >= CERTIFICATE_THRESHOLDS.SILVER) return 'Silver';
    if (certifiedCount >= CERTIFICATE_THRESHOLDS.BRONZE) return 'Bronze';
    return 'Unranked';
  }, [achievements]);

  return (
    <AchievementsContext.Provider value={{ achievements, addAchievement, certificateStatus, loading }}>
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
