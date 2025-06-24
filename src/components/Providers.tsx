"use client";

import type { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ChallengeConfigProvider } from '@/context/ChallengeConfigContext';
import { AchievementsProvider } from '@/context/AchievementsContext';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ChallengeConfigProvider>
        <AchievementsProvider>
          {children}
          <Toaster />
        </AchievementsProvider>
      </ChallengeConfigProvider>
    </AuthProvider>
  );
}
