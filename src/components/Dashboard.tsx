"use client";

import { useState } from 'react';
import { useAchievements } from '@/context/AchievementsContext';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { AchievementCard } from '@/components/AchievementCard';
import { CertificateStatus } from '@/components/CertificateStatus';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { ChangePinDialog } from './ChangePinDialog';

export function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { loading: achievementsLoading } = useAchievements();
  const { challengeConfig, loading: configLoading } = useChallengeConfig();
  const [isChangePinDialogOpen, setChangePinDialogOpen] = useState(false);

  const loading = authLoading || achievementsLoading || configLoading;

  return (
    <div className="container mx-auto px-4 py-8">
      <Header />
      <main>
        {user?.pin === '0000' && (
          <Alert variant="destructive" className="mb-8">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle className="font-bold">보안 경고!</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <span>초기 PIN 번호를 사용하고 있습니다. 보안을 위해 즉시 변경해주세요.</span>
              <Button variant="outline" size="sm" className="bg-white hover:bg-gray-100 text-destructive border-destructive" onClick={() => setChangePinDialogOpen(true)}>
                <KeyRound className="mr-2 h-4 w-4" />
                PIN 변경하기
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <CertificateStatus />
          <Card className="h-full flex flex-col justify-center p-6 text-center shadow-lg border bg-card">
            <CardHeader className="p-2">
              <CardTitle className="font-headline text-xl sm:text-2xl">✨ 참여 안내 ✨</CardTitle>
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
            <h2 className="text-2xl sm:text-3xl font-bold font-headline text-primary">도전 영역 둘러보기</h2>
            <p className="text-muted-foreground">아래 영역들을 눌러 현재 진행 상황을 확인해보세요.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading || !user || !challengeConfig
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col space-y-3">
                  <Skeleton className="h-[220px] w-full rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-3/5" />
                  </div>
                </div>
              ))
            : Object.keys(challengeConfig).sort().map(areaName => (
                <AchievementCard key={areaName} areaName={areaName} />
              ))}
        </div>
      </main>
      <ChangePinDialog open={isChangePinDialogOpen} onOpenChange={setChangePinDialogOpen} />
    </div>
  );
}
