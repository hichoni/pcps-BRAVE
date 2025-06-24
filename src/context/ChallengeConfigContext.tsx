"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AreaName, DEFAULT_AREAS_CONFIG, ICONS, AreaConfig as BaseAreaConfig, AREAS } from '@/lib/config';
import { ShieldOff } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

const CONFIG_DOC_PATH = 'config/challengeConfig';

export const ChallengeConfigProvider = ({ children }: { children: ReactNode }) => {
  const [challengeConfig, setChallengeConfig] = useState<ChallengeConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      if (!db) {
        const defaultConfig = {...DEFAULT_AREAS_CONFIG};
        setChallengeConfig(resolveConfigWithIcons(defaultConfig));
        setLoading(false);
        return;
      }

      try {
        const configDocRef = doc(db, CONFIG_DOC_PATH);
        const configDocSnap = await getDoc(configDocRef);

        let configData: StoredChallengeConfig;

        if (configDocSnap.exists()) {
          configData = configDocSnap.data() as StoredChallengeConfig;
        } else {
          // If no config in Firestore, use default and save it.
          configData = { ...DEFAULT_AREAS_CONFIG };
          await setDoc(configDocRef, configData);
        }
        
        // Ensure all areas from AREAS constant exist in the config
        let needsUpdate = false;
        AREAS.forEach(area => {
            if (!configData[area]) {
                configData[area] = DEFAULT_AREAS_CONFIG[area];
                needsUpdate = true;
            }
            // Ensure goal is in the new format
            if (typeof configData[area].goal === 'number') {
                const oldGoal = configData[area].goal as number;
                configData[area].goal = { '4': oldGoal, '5': oldGoal, '6': oldGoal };
                needsUpdate = true;
            }
        });
        
        if (needsUpdate) {
            await setDoc(configDocRef, configData);
        }

        setChallengeConfig(resolveConfigWithIcons(configData));

      } catch (error) {
        console.warn("Failed to fetch challenge config from Firestore", error);
        const defaultConfig = {...DEFAULT_AREAS_CONFIG};
        setChallengeConfig(resolveConfigWithIcons(defaultConfig));
      } finally {
        setLoading(false);
      }
    };
    
    fetchConfig();
  }, []);

  const updateChallengeConfig = useCallback(async (newConfig: StoredChallengeConfig) => {
    setLoading(true);
    setChallengeConfig(resolveConfigWithIcons(newConfig));

    if (!db) {
        setLoading(false);
        return;
    }
    
    try {
      const configDocRef = doc(db, CONFIG_DOC_PATH);
      await setDoc(configDocRef, newConfig);
    } catch (error) {
      console.warn("Failed to save challenge config to Firestore", error);
    } finally {
      setLoading(false);
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
