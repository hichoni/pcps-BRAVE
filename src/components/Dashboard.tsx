"use client";

import { useAchievements } from '@/context/AchievementsContext';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { AchievementCard } from '@/components/AchievementCard';
import { CertificateStatus } from '@/components/CertificateStatus';
import { AREAS } from '@/lib/config';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';

export function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { loading: achievementsLoading } = useAchievements();

  const loading = authLoading || achievementsLoading;

  return (
    <div className="container mx-auto px-4 py-8">
      <Header />
      <main>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <CertificateStatus />
          <Card className="h-full flex flex-col justify-center p-6 text-center shadow-lg border bg-card">
            <CardHeader className="p-2">
              <CardTitle className="font-headline text-2xl">✨ 참여 안내 ✨</CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-grow flex flex-col items-center justify-center">
              <p className="font-semibold">4~6학년 친구들만 인증할 수 있어요!</p>
              <p className="text-muted-foreground mb-4">인증 기간: 2025년 5월 1일 ~ 10월 31일</p>
              <Separator className="my-4"/>
              <div className="space-y-2 text-left">
                  <p className="font-semibold flex items-center gap-2">
                      <span className="text-2xl">🥇</span> 
                      <span><strong className="text-primary">금장:</strong> 4개 영역 이상 인증</span>
                  </p>
                  <p className="font-semibold flex items-center gap-2">
                      <span className="text-2xl">🥈</span>
                      <span><strong className="text-primary">은장:</strong> 3개 영역 인증</span>
                  </p>
                  <p className="font-semibold flex items-center gap-2">
                      <span className="text-2xl">🥉</span>
                      <span><strong className="text-primary">동장:</strong> 2개 영역 인증</span>
                  </p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="text-center mb-12">
            <h2 className="text-3xl font-bold font-headline text-primary">도전 영역 둘러보기</h2>
            <p className="text-muted-foreground">아래 영역들을 눌러 현재 진행 상황을 확인해보세요.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading || !user
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col space-y-3">
                  <Skeleton className="h-[180px] w-full rounded-xl" />
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
