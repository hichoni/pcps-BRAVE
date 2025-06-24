"use client";

import { useAchievements } from '@/context/AchievementsContext';
import { Header } from '@/components/Header';
import { AchievementCard } from '@/components/AchievementCard';
import { CertificateStatus } from '@/components/CertificateStatus';
import { AREAS } from '@/lib/config';
import { Skeleton } from '@/components/ui/skeleton';

export function Dashboard() {
  const { achievements, loading } = useAchievements();

  return (
    <div className="container mx-auto px-4 py-8">
      <Header />
      <main>
        <CertificateStatus />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading || !achievements
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col space-y-3">
                  <Skeleton className="h-[125px] w-full rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-3/5" />
                  </div>
                </div>
              ))
            : AREAS.map(areaName => (
                <AchievementCard key={areaName} areaName={areaName} />
              ))}
        </div>
      </main>
    </div>
  );
}
