
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AreaName, DEFAULT_AREAS_CONFIG, ICONS, AreaConfig as BaseAreaConfig, StoredAreaConfig } from '@/lib/config';
import { ShieldOff } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { revalidateConfigCache } from '@/app/actions';

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
            const defaultConfig = DEFAULT_AREAS_CONFIG[area] || {};
            const mergedConfig = { ...defaultConfig, ...config };

            resolvedConfig[area] = {
                ...mergedConfig,
                name: area,
                icon: ICONS[mergedConfig.iconName] || ShieldOff,
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
    if (!db) throw new Error("데이터베이스 연결이 설정되지 않았습니다.");
    try {
      const configDocRef = doc(db, CONFIG_DOC_PATH);
      await updateDoc(configDocRef, { [areaId]: newConfig });
      await revalidateConfigCache();
      await fetchConfig(); // Re-fetch the entire config to ensure UI is in sync
    } catch (error) {
      console.error("Failed to update challenge area in Firestore", error);
      // Re-throw to be caught by the calling component
      throw new Error("도전 영역 정보 업데이트에 실패했습니다.");
    }
  }, [fetchConfig]);

  const addArea = useCallback(async (areaId: AreaName, newConfig: StoredAreaConfig) => {
    if (!db) throw new Error("데이터베이스 연결이 설정되지 않았습니다.");
    try {
      const configDocRef = doc(db, CONFIG_DOC_PATH);
      await updateDoc(configDocRef, { [areaId]: newConfig });
      await revalidateConfigCache();
      await fetchConfig();
    } catch (error) {
      console.error("Failed to add challenge area to Firestore", error);
      throw new Error("새 도전 영역 추가에 실패했습니다.");
    }
  }, [fetchConfig]);

  const deleteArea = useCallback(async (areaId: AreaName) => {
    if (!db) throw new Error("데이터베이스 연결이 설정되지 않았습니다.");
    try {
      const configDocRef = doc(db, CONFIG_DOC_PATH);
      await updateDoc(configDocRef, { [areaId]: deleteField() });
      await revalidateConfigCache();
      await fetchConfig();
    } catch (error) {
      console.error("Failed to delete challenge area from Firestore", error);
      throw new Error("도전 영역 삭제에 실패했습니다.");
    }
  }, [fetchConfig]);

  const updateAnnouncement = useCallback(async (newAnnouncement: AnnouncementConfig) => {
    if (!db) throw new Error("데이터베이스 연결이 설정되지 않았습니다.");
    try {
      const announcementDocRef = doc(db, ANNOUNCEMENT_DOC_PATH);
      await setDoc(announcementDocRef, newAnnouncement);
      await revalidateConfigCache();
      await fetchConfig();
    } catch (error) {
      console.error("Failed to save announcement to Firestore", error);
      throw new Error("공지사항 저장에 실패했습니다.");
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
