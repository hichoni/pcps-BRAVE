
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AreaName, DEFAULT_AREAS_CONFIG, ICONS, AreaConfig as BaseAreaConfig, StoredAreaConfig } from '@/lib/config';
import { ShieldOff } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';

export type ChallengeConfig = Record<AreaName, BaseAreaConfig>;

export interface AnnouncementConfig {
  text: string;
  enabled: boolean;
}

interface ChallengeConfigContextType {
  challengeConfig: ChallengeConfig | null;
  announcement: AnnouncementConfig | null;
  updateArea: (areaId: AreaName, newConfig: StoredAreaConfig) => Promise<void>;
  addArea: (areaId: AreaName, newConfig: StoredAreaConfig) => Promise<void>;
  deleteArea: (areaId: AreaName) => Promise<void>;
  updateAnnouncement: (newAnnouncement: AnnouncementConfig) => Promise<void>;
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
const ANNOUNCEMENT_DOC_PATH = 'config/announcement';

const defaultAnnouncement: AnnouncementConfig = { 
  text: "4~6학년 친구들만 인증할 수 있어요!\n인증 기간: 2025년 5월 1일 ~ 10월 31일", 
  enabled: true 
};


export const ChallengeConfigProvider = ({ children }: { children: ReactNode }) => {
  const [challengeConfig, setChallengeConfig] = useState<ChallengeConfig | null>(null);
  const [announcement, setAnnouncement] = useState<AnnouncementConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    let configData: Record<AreaName, StoredAreaConfig>;

    if (!db) {
      configData = { ...DEFAULT_AREAS_CONFIG };
      setAnnouncement(defaultAnnouncement);
    } else {
      try {
        const configDocRef = doc(db, CONFIG_DOC_PATH);
        const announcementDocRef = doc(db, ANNOUNCEMENT_DOC_PATH);

        const [configDocSnap, announcementDocSnap] = await Promise.all([
            getDoc(configDocRef),
            getDoc(announcementDocRef)
        ]);

        if (configDocSnap.exists() && typeof configDocSnap.data() === 'object' && configDocSnap.data() !== null) {
           configData = configDocSnap.data() as Record<AreaName, StoredAreaConfig>;
        } else {
          configData = { ...DEFAULT_AREAS_CONFIG };
          await setDoc(configDocRef, configData);
        }
        
        if (announcementDocSnap.exists()) {
            setAnnouncement(announcementDocSnap.data() as AnnouncementConfig);
        } else {
            await setDoc(announcementDocRef, defaultAnnouncement);
            setAnnouncement(defaultAnnouncement);
        }

      } catch (error) {
        console.warn("Failed to fetch/read config from Firestore", error);
        configData = { ...DEFAULT_AREAS_CONFIG };
        setAnnouncement(defaultAnnouncement);
      }
    }
    
    setChallengeConfig(resolveConfigWithIcons(configData));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateArea = useCallback(async (areaId: AreaName, newConfig: StoredAreaConfig) => {
    // Optimistically update the UI state.
    setChallengeConfig(prevConfig => {
        if (!prevConfig) return null;
        
        const newResolvedConfig = { ...prevConfig };
        
        // Resolve the new config for just the area being updated.
        newResolvedConfig[areaId] = {
            ...newConfig,
            name: areaId,
            icon: ICONS[newConfig.iconName] || ShieldOff,
        };
        
        return newResolvedConfig;
    });

    if (!db) return;
    try {
      const configDocRef = doc(db, CONFIG_DOC_PATH);
      // Persist only the storable part of the config to Firestore.
      await updateDoc(configDocRef, { [areaId]: newConfig });
    } catch (error) {
      console.error("Failed to save challenge config to Firestore", error);
      // If the database update fails, refetch the original state to revert the optimistic UI update.
      fetchConfig();
    }
  }, [fetchConfig]);

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

  const updateAnnouncement = useCallback(async (newAnnouncement: AnnouncementConfig) => {
    setAnnouncement(newAnnouncement);
    if (!db) return;
    try {
      const announcementDocRef = doc(db, ANNOUNCEMENT_DOC_PATH);
      await setDoc(announcementDocRef, newAnnouncement);
    } catch (error) {
      console.error("Failed to save announcement to Firestore", error);
      fetchConfig(); // Revert
    }
  }, [fetchConfig]);

  return (
    <ChallengeConfigContext.Provider value={{ challengeConfig, announcement, updateAnnouncement, updateArea, addArea, deleteArea, loading }}>
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
