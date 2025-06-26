"use client";

import { useAchievements } from '@/context/AchievementsContext';
import { useAuth } from '@/context/AuthContext';
import { STATUS_CONFIG, CERTIFICATE_THRESHOLDS } from '@/lib/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';

export function CertificateStatus() {
  const { user, loading: authLoading } = useAuth();
  const { getAchievements, certificateStatus, loading: achievementsLoading } = useAchievements();

  if (authLoading || achievementsLoading || !user) {
    return <Skeleton className="h-40 w-full" />;
  }
  
  const userAchievements = getAchievements(user.username);
  const certifiedCount = Object.values(userAchievements).filter(a => a.isCertified).length;
  const currentStatus = certificateStatus(user.username);
  const statusInfo = STATUS_CONFIG[currentStatus];

  const getNextGoalMessage = () => {
    switch (currentStatus) {
      case 'Unranked':
        const neededForBronze = CERTIFICATE_THRESHOLDS.BRONZE - certifiedCount;
        return `${neededForBronze}개 영역만 더 인증하면 동장이에요!`;
      case 'Bronze':
        const neededForSilver = CERTIFICATE_THRESHOLDS.SILVER - certifiedCount;
        return `${neededForSilver}개 영역만 더 인증하면 은장이에요!`;
      case 'Silver':
        const neededForGold = CERTIFICATE_THRESHOLDS.GOLD - certifiedCount;
        return `${neededForGold}개 영역만 더 인증하면 금장이에요!`;
      case 'Gold':
        return '최고 등급을 달성했어요! 축하합니다!';
      default:
        return '';
    }
  };

  return (
    <Card className="w-full h-full flex flex-col shadow-lg border">
      <CardHeader className="text-center p-4 sm:p-6 pb-2">
        <CardTitle className="font-headline text-xl sm:text-2xl">나의 도전 현황</CardTitle>
      </CardHeader>
      <CardContent className="text-center flex-grow flex flex-col items-center justify-center p-4 sm:p-6 pt-0">
        <div className="flex flex-col items-center gap-2">
          <statusInfo.icon className={cn("w-20 h-20 transition-all duration-500", statusInfo.color)} />
          {currentStatus !== 'Unranked' && (
            <p className={cn("text-2xl sm:text-3xl font-bold font-headline transition-colors duration-500", statusInfo.color)}>
              {statusInfo.label}
            </p>
          )}
          <p className="text-muted-foreground font-semibold text-sm sm:text-base">{getNextGoalMessage()}</p>
        </div>
      </CardContent>
    </Card>
  );
}
