
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AreaName, DEFAULT_AREAS_CONFIG, ICONS, AreaConfig as BaseAreaConfig, StoredAreaConfig } from '@/lib/config';
import { ShieldOff } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, FieldValue, deleteField } from 'firebase/firestore';

export type ChallengeConfig = Record<AreaName, BaseAreaConfig>;

interface ChallengeConfigContextType {
  challengeConfig: ChallengeConfig | null;
  updateArea: (areaId: AreaName, newConfig: StoredAreaConfig) => Promise<void>;
  addArea: (areaId: AreaName, newConfig: StoredAreaConfig) => Promise<void>;
  deleteArea: (areaId: AreaName) => Promise<void>;
  loading: boolean;
}

const ChallengeConfigContext = createContext<ChallengeConfigContextType | undefined>(undefined);

const resolveConfigWithIcons = (storedConfig: Record<AreaName, StoredAreaConfig>): ChallengeConfig => {
    const resolvedConfig = {} as ChallengeConfig;
    Object.keys(storedConfig).forEach(area => {
        const config = storedConfig[area];
        if (config) {
            // To be resilient to config changes, merge the stored config over the default.
            // This ensures new properties added to the default config are present.
            const defaultConfig = DEFAULT_AREAS_CONFIG[area] || {};
            const mergedConfig = { ...defaultConfig, ...config };

            resolvedConfig[area] = {
                ...mergedConfig,
                name: area,
                icon: ICONS[mergedConfig.iconName] || ShieldOff, // Fallback icon
            };
        }
    });
    return resolvedConfig;
};

const CONFIG_DOC_PATH = 'config/challengeConfig';

export const ChallengeConfigProvider = ({ children }: { children: ReactNode }) => {
  const [challengeConfig, setChallengeConfig] = useState<ChallengeConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    let configData: Record<AreaName, StoredAreaConfig>;

    if (!db) {
      configData = { ...DEFAULT_AREAS_CONFIG };
    } else {
      try {
        const configDocRef = doc(db, CONFIG_DOC_PATH);
        const configDocSnap = await getDoc(configDocRef);

        if (configDocSnap.exists() && typeof configDocSnap.data() === 'object' && configDocSnap.data() !== null) {
           const fromDb = configDocSnap.data() as Record<AreaName, StoredAreaConfig>;
           configData = fromDb;
        } else {
          configData = { ...DEFAULT_AREAS_CONFIG };
          await setDoc(configDocRef, configData);
        }
      } catch (error) {
        console.warn("Failed to fetch/read challenge config from Firestore", error);
        configData = { ...DEFAULT_AREAS_CONFIG };
      }
    }
    
    setChallengeConfig(resolveConfigWithIcons(configData));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateArea = useCallback(async (areaId: AreaName, newConfig: StoredAreaConfig) => {
    const currentConfig = challengeConfig || {};
    const updatedConfig = resolveConfigWithIcons({ ...currentConfig, [areaId]: newConfig });
    setChallengeConfig(updatedConfig);

    if (!db) return;
    try {
      const configDocRef = doc(db, CONFIG_DOC_PATH);
      await updateDoc(configDocRef, { [areaId]: newConfig });
    } catch (error) {
      console.error("Failed to save challenge config to Firestore", error);
      fetchConfig(); // Revert on failure
    }
  }, [challengeConfig, fetchConfig]);

  const addArea = useCallback(async (areaId: AreaName, newConfig: StoredAreaConfig) => {
     const currentConfig = challengeConfig || {};
     const updatedConfig = resolveConfigWithIcons({ ...currentConfig, [areaId]: newConfig });
     setChallengeConfig(updatedConfig);
    
    if (!db) return;
    try {
        const configDocRef = doc(db, CONFIG_DOC_PATH);
        await updateDoc(configDocRef, { [areaId]: newConfig });
    } catch(e) {
        console.error("Failed to add area", e);
        fetchConfig(); // Revert on failure
    }
  }, [challengeConfig, fetchConfig]);

  const deleteArea = useCallback(async (areaId: AreaName) => {
    setChallengeConfig(prev => {
        if (!prev) return null;
        const newConfig = { ...prev };
        delete newConfig[areaId];
        return newConfig;
    });

    if (!db) return;
    try {
        const configDocRef = doc(db, CONFIG_DOC_PATH);
        await updateDoc(configDocRef, { [areaId]: deleteField() });
    } catch(e) {
        console.error("Failed to delete area", e);
        fetchConfig(); // Revert on failure
    }
  }, [fetchConfig]);

  return (
    <ChallengeConfigContext.Provider value={{ challengeConfig, updateArea, addArea, deleteArea, loading }}>
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
