"use client";

import { useState } from 'react';
import { useAchievements } from '@/context/AchievementsContext';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { AchievementCard } from '@/components/AchievementCard';
import { CertificateStatus } from '@/components/CertificateStatus';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { KeyRound, ShieldAlert, GalleryThumbnails } from 'lucide-react';
import { ChangePinDialog } from '@/components/ChangePinDialog';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { getAchievements, loading: achievementsLoading } = useAchievements();
  const { challengeConfig, loading: configLoading } = useChallengeConfig();
  const [isChangePinDialogOpen, setChangePinDialogOpen] = useState(false);

  const loading = authLoading || achievementsLoading || configLoading;

  const sortedAreaNames = (user && challengeConfig && !loading)
    ? Object.keys(challengeConfig).sort((a, b) => {
        const userAchievements = getAchievements(user.username);
        const aIsCertified = userAchievements[a]?.isCertified ?? false;
        const bIsCertified = userAchievements[b]?.isCertified ?? false;

        if (aIsCertified && !bIsCertified) {
          return 1;
        }
        if (!aIsCertified && bIsCertified) {
          return -1;
        }
        return challengeConfig[a].koreanName.localeCompare(challengeConfig[b].koreanName);
      })
    : [];

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
          <div className="space-y-8 flex flex-col">
            <CertificateStatus />
            <Link href="/gallery" passHref>
              <Card className={cn(
                  "flex-grow flex flex-col items-center justify-center p-4 sm:p-6 text-center shadow-lg border bg-card",
                  "hover:shadow-xl hover:border-primary/50 transition-all duration-300 cursor-pointer group"
              )}>
                  <GalleryThumbnails className="w-16 h-16 text-muted-foreground group-hover:text-primary transition-colors duration-300"/>
                  <p className="font-headline text-lg sm:text-xl mt-4 text-primary font-semibold">도전 갤러리 가기</p>
                  <p className="text-muted-foreground text-sm">다른 친구들의 도전을 구경해보세요!</p>
              </Card>
            </Link>
          </div>
          
          <Card className="h-full flex flex-col justify-center p-4 sm:p-6 text-center shadow-lg border bg-card">
            <CardHeader className="p-2">
              <CardTitle className="font-headline text-xl sm:text-2xl">✨ 참여 안내 ✨</CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-grow flex flex-col items-center justify-center">
              <p className="font-semibold text-sm sm:text-base">4~6학년 친구들만 인증할 수 있어요!</p>
              <p className="text-muted-foreground mb-4 text-xs sm:text-sm">인증 기간: 2025년 5월 1일 ~ 10월 31일</p>
              <Separator className="my-4"/>
              <div className="space-y-2 text-left">
                  <p className="font-semibold flex items-center gap-2 text-sm sm:text-base">
                      <span className="text-xl sm:text-2xl">🥇</span> 
                      <span><strong className="text-primary">금장:</strong> 4개 영역 이상 인증</span>
                  </p>
                  <p className="font-semibold flex items-center gap-2 text-sm sm:text-base">
                      <span className="text-xl sm:text-2xl">🥈</span>
                      <span><strong className="text-primary">은장:</strong> 3개 영역 인증</span>
                  </p>
                  <p className="font-semibold flex items-center gap-2 text-sm sm:text-base">
                      <span className="text-xl sm:text-2xl">🥉</span>
                      <span><strong className="text-primary">동장:</strong> 2개 영역 인증</span>
                  </p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold font-headline text-primary">도전 영역 둘러보기</h2>
            <p className="text-muted-foreground text-sm sm:text-base">아래 영역들을 눌러 현재 진행 상황을 확인하고, 실천 내용을 갤러리에 공유해보세요.</p>
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
            : sortedAreaNames.map(areaName => (
                <AchievementCard key={areaName} areaName={areaName} />
              ))}
        </div>
      </main>
      <ChangePinDialog open={isChangePinDialogOpen} onOpenChange={setChangePinDialogOpen} />
    </div>
  );
}
