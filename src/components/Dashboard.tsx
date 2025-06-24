"use client";

import Image from 'next/image';
import { useAchievements } from '@/context/AchievementsContext';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { AchievementCard } from '@/components/AchievementCard';
import { CertificateStatus } from '@/components/CertificateStatus';
import { AREAS } from '@/lib/config';
import { Skeleton } from '@/components/ui/skeleton';

export function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { loading: achievementsLoading } = useAchievements();

  const loading = authLoading || achievementsLoading;

  return (
    <div className="container mx-auto px-4 py-8">
      <Header />
      <main>
        <CertificateStatus />

        <div className="mt-8 text-center max-w-2xl mx-auto p-6 bg-card rounded-xl shadow-sm border">
            <h2 className="text-xl font-bold text-primary mb-2">✨ 참여 안내 ✨</h2>
            <p className="font-semibold">4~6학년 친구들만 인증할 수 있어요!</p>
            <p className="text-muted-foreground mb-4">인증 기간: 2025년 5월 1일 ~ 10월 31일</p>
            
            <Image
                src="https://placehold.co/400x120.png"
                alt="학생들이 응원하는 그림"
                data-ai-hint="students cheering cartoon"
                width={400}
                height={120}
                className="my-4 mx-auto rounded-lg"
            />

            <div className="mt-6 flex justify-center items-center flex-wrap gap-x-6 gap-y-2 text-sm">
                <span className="font-semibold">🥇 금장: 4개 영역 이상 인증</span>
                <span className="font-semibold">🥈 은장: 3개 영역 인증</span>
                <span className="font-semibold">🥉 동장: 2개 영역 인증</span>
            </div>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading || !user
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
