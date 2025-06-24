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
    AREAS.forEach(area => {
        const config = storedConfig[area];
        if (config) {
            resolvedConfig[area] = {
                ...config,
                name: area,
                icon: ICONS[config.iconName] || ShieldOff, // Fallback icon
            };
        }
    });
    return resolvedConfig;
};

const CONFIG_DOC_PATH = 'config/challengeConfig';

export const ChallengeConfigProvider = ({ children }: { children: ReactNode }) => {
  const [challengeConfig, setChallengeConfig] = useState<ChallengeConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      let configData: StoredChallengeConfig;

      if (!db) {
        configData = { ...DEFAULT_AREAS_CONFIG };
      } else {
        try {
          const configDocRef = doc(db, CONFIG_DOC_PATH);
          const configDocSnap = await getDoc(configDocRef);

          if (configDocSnap.exists() && typeof configDocSnap.data() === 'object' && configDocSnap.data() !== null) {
            configData = configDocSnap.data() as StoredChallengeConfig;
          } else {
            // If no config in Firestore or data is malformed, use default and save it.
            configData = { ...DEFAULT_AREAS_CONFIG };
            await setDoc(configDocRef, configData);
          }
        } catch (error) {
          console.warn("Failed to fetch/read challenge config from Firestore", error);
          configData = { ...DEFAULT_AREAS_CONFIG };
        }
      }
      
      try {
        // Ensure all areas from AREAS constant exist in the config, and data is valid
        let needsUpdateInDb = false;
        AREAS.forEach(area => {
            if (!configData[area] || typeof configData[area] !== 'object') {
                configData[area] = DEFAULT_AREAS_CONFIG[area];
                needsUpdateInDb = true;
            }
            // Ensure goal is in the new format (object with grade keys)
            if (typeof configData[area].goal !== 'object' || configData[area].goal === null) {
                const oldGoal = Number(configData[area].goal) || DEFAULT_AREAS_CONFIG[area].goal['4'];
                configData[area].goal = { '4': oldGoal, '5': oldGoal, '6': oldGoal };
                needsUpdateInDb = true;
            }
        });
        
        if (needsUpdateInDb && db) {
            await setDoc(doc(db, CONFIG_DOC_PATH), configData);
        }

        setChallengeConfig(resolveConfigWithIcons(configData));

      } catch (error) {
        console.error("Error processing the challenge config, falling back to default.", error);
        setChallengeConfig(resolveConfigWithIcons({ ...DEFAULT_AREAS_CONFIG }));
      } finally {
        setLoading(false);
      }
    };
    
    fetchConfig();
  }, []);

  const updateChallengeConfig = useCallback(async (newConfig: StoredChallengeConfig) => {
    setLoading(true);
    // Optimistically update the UI
    setChallengeConfig(resolveConfigWithIcons(newConfig));

    if (!db) {
        console.warn("DB not available, config only updated in local state.");
        setLoading(false);
        return;
    }
    
    try {
      const configDocRef = doc(db, CONFIG_DOC_PATH);
      await setDoc(configDocRef, newConfig);
    } catch (error) {
      console.error("Failed to save challenge config to Firestore", error);
      // Optional: Add logic to revert optimistic update
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
