"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AreaName, DEFAULT_AREAS_CONFIG, ICONS, AreaConfig as BaseAreaConfig, AREAS } from '@/lib/config';
import { ShieldOff } from 'lucide-react';

// The config stored in localStorage will not have the icon component.
export type StoredAreaConfig = Omit<BaseAreaConfig, 'icon' | 'name'> & { iconName: string };
export type StoredChallengeConfig = Record<AreaName, StoredAreaConfig>;

// The config provided by the context will have the icon component resolved.
export type AreaConfig = BaseAreaConfig;
export type ChallengeConfig = Record<AreaName, AreaConfig>;

interface ChallengeConfigContextType {
  challengeConfig: ChallengeConfig | null;
  updateChallengeConfig: (newConfig: StoredChallengeConfig) => Promise<void>;
  loading: boolean;
}

const ChallengeConfigContext = createContext<ChallengeConfigContextType | undefined>(undefined);

const resolveConfigWithIcons = (storedConfig: StoredChallengeConfig): ChallengeConfig => {
    const resolvedConfig = {} as ChallengeConfig;
    (Object.keys(storedConfig) as AreaName[]).forEach(area => {
        const config = storedConfig[area];
        resolvedConfig[area] = {
            ...config,
            name: area,
            icon: ICONS[config.iconName] || ShieldOff, // Fallback icon
        };
    });
    return resolvedConfig;
};

export const ChallengeConfigProvider = ({ children }: { children: ReactNode }) => {
  const [challengeConfig, setChallengeConfig] = useState<ChallengeConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedDataRaw = localStorage.getItem('challengeConfig');
      const storedConfigData: StoredChallengeConfig | null = storedDataRaw ? JSON.parse(storedDataRaw) : null;
      let storedConfig: StoredChallengeConfig = storedConfigData || { ...DEFAULT_AREAS_CONFIG };

      // Ensure all areas from AREAS constant exist in the config
      let needsUpdate = !storedConfigData;
      AREAS.forEach(area => {
        if (!storedConfig[area]) {
          storedConfig[area] = DEFAULT_AREAS_CONFIG[area];
          needsUpdate = true;
        }
        // Ensure goal is in the new format
        if (typeof storedConfig[area].goal === 'number') {
            const oldGoal = storedConfig[area].goal as number;
            storedConfig[area].goal = { '4': oldGoal, '5': oldGoal, '6': oldGoal };
            needsUpdate = true;
        }
      });
      
      setChallengeConfig(resolveConfigWithIcons(storedConfig));

      if (needsUpdate) {
        localStorage.setItem('challengeConfig', JSON.stringify(storedConfig));
      }

    } catch (error) {
      console.error("Failed to process challenge config from localStorage", error);
      const defaultConfig = {...DEFAULT_AREAS_CONFIG};
      setChallengeConfig(resolveConfigWithIcons(defaultConfig));
    } finally {
      setLoading(false);
    }
  }, []);

  const updateChallengeConfig = useCallback(async (newConfig: StoredChallengeConfig) => {
    setChallengeConfig(resolveConfigWithIcons(newConfig));
    try {
      localStorage.setItem('challengeConfig', JSON.stringify(newConfig));
    } catch (error) {
      console.error("Failed to save challenge config to localStorage", error);
    }
  }, []);

  return (
    <ChallengeConfigContext.Provider value={{ challengeConfig, updateChallengeConfig, loading }}>
      {children}
    </ChallengeConfigContext.Provider>
  );
};

export const useChallengeConfig = () => {
  const context = useContext(ChallengeConfigContext);
  if (context === undefined) {
    throw new Error('useChallengeConfig must be used within a ChallengeConfigProvider');
  }
  return context;
};
