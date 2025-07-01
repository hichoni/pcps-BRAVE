
"use client";

import { useState } from 'react';
import { useAchievements } from '@/context/AchievementsContext';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/Header';
import { AchievementCard } from '@/components/AchievementCard';
import { CertificateStatus } from '@/components/CertificateStatus';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { KeyRound, ShieldAlert, GalleryThumbnails, Info, Bug } from 'lucide-react';
import { ChangePinDialog } from '@/components/ChangePinDialog';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { WelcomeMessage } from '@/components/WelcomeMessage';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { getAchievements, loading: achievementsLoading } = useAchievements();
  const { challengeConfig, announcement, loading: configLoading } = useChallengeConfig();
  const [isChangePinDialogOpen, setChangePinDialogOpen] = useState(false);

  const loading = authLoading || achievementsLoading || configLoading;

  const sortedAreaNames = (!loading && user && challengeConfig)
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
      
      {loading && (
        <div className="mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-8">
            <div className="lg:col-span-2"><Skeleton className="h-40 w-full" /></div>
            <div className="lg:col-span-3"><Skeleton className="h-40 w-full" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-52 w-full" />
            ))}
          </div>
        </div>
      )}
      
      {!loading && user && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-8">
            <div className="lg:col-span-2">
                <WelcomeMessage />
            </div>
            
            <div className="lg:col-span-3">
              {announcement?.enabled && announcement.text && (
                <Alert className="h-full">
                    <Info className="h-4 w-4" />
                    <AlertTitle className="font-bold">안내사항</AlertTitle>
                    <AlertDescription className="whitespace-pre-wrap">
                      {announcement.text}
                    </AlertDescription>
                </Alert>
              )}
            </div>
          </div>


          <main>
            {user.pin === '0000' && (
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <CertificateStatus />
              
                <Link href="/gallery" passHref className="h-full">
                  <Card className={cn(
                      "h-full flex flex-col items-center justify-center p-4 text-center shadow-lg border bg-card",
                      "hover:shadow-xl hover:border-primary/50 transition-all duration-300 cursor-pointer group"
                  )}>
                      <GalleryThumbnails className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors duration-300"/>
                      <p className="font-headline text-base sm:text-lg mt-3 text-primary font-semibold">도전 갤러리 가기</p>
                      <p className="text-muted-foreground text-xs">다른 친구들의 도전을 구경해보세요!</p>
                  </Card>
                </Link>

                <Link href="/feedback" passHref className="h-full">
                  <Card className={cn(
                      "h-full flex flex-col items-center justify-center p-4 text-center shadow-lg border bg-card",
                      "hover:shadow-xl hover:border-primary/50 transition-all duration-300 cursor-pointer group"
                  )}>
                      <Bug className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors duration-300"/>
                      <p className="font-headline text-base sm:text-lg mt-3 text-primary font-semibold">오류 신고 / 건의하기</p>
                      <p className="text-muted-foreground text-xs">불편한 점이나 아이디어를 알려주세요.</p>
                  </Card>
                </Link>
            </div>
            
            <div className="text-center mb-12">
                <h2 className="text-2xl sm:text-3xl font-bold font-headline text-primary">도전 영역 둘러보기</h2>
                <p className="text-muted-foreground text-sm sm:text-base">아래 영역들을 눌러 현재 진행 상황을 확인하고, 실천 내용을 갤러리에 공유해보세요.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {sortedAreaNames.map(areaName => (
                    <AchievementCard key={areaName} areaName={areaName} />
                  ))}
            </div>
          </main>
        </>
      )}

      <ChangePinDialog open={isChangePinDialogOpen} onOpenChange={setChangePinDialogOpen} />
    </div>
  );
}
