
"use client";

import { useEffect, useState } from 'react';
import { useAchievements } from '@/context/AchievementsContext';
import { useAuth } from '@/context/AuthContext';
import { STATUS_CONFIG, CERTIFICATE_THRESHOLDS } from '@/lib/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Award, Gem, Medal, Sparkles } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface Encouragement {
    message: string;
    createdAt: Timestamp;
}

export function CertificateStatus() {
  const { user, loading: authLoading } = useAuth();
  const { getAchievements, certificateStatus, loading: achievementsLoading } = useAchievements();
  const [encouragement, setEncouragement] = useState<Encouragement | null>(null);

  useEffect(() => {
    if (!user || !db) return;

    const userStateRef = doc(db, 'userDynamicState', user.username);
    const unsubscribe = onSnapshot(userStateRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.encouragement) {
          // Only show recent messages (e.g., within last 24 hours)
          const now = new Date();
          const messageDate = (data.encouragement.createdAt as Timestamp).toDate();
          if ((now.getTime() - messageDate.getTime()) < 24 * 60 * 60 * 1000) {
            setEncouragement(data.encouragement as Encouragement);
          } else {
            setEncouragement(null);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

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
    <Dialog>
      <DialogTrigger asChild>
        <Card className="w-full h-full flex flex-col shadow-lg border cursor-pointer hover:shadow-xl hover:border-primary/50 transition-all duration-300">
          <CardHeader className="text-center p-4 pb-2">
            <CardTitle className="font-headline text-lg sm:text-xl">나의 도전 현황</CardTitle>
          </CardHeader>
          <CardContent className="text-center flex-grow flex flex-col items-center justify-center p-4 pt-0">
            {encouragement && (
                <Alert variant="default" className="mb-4 text-left border-primary/20 bg-primary/5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <AlertTitle className="font-bold text-primary">선생님의 응원 메시지</AlertTitle>
                    <AlertDescription className="text-primary/90">
                        {encouragement.message}
                    </AlertDescription>
                </Alert>
            )}
            <div className="flex flex-col items-center gap-2">
              <statusInfo.icon className={cn("w-16 h-16 transition-all duration-500", statusInfo.color)} />
              {currentStatus !== 'Unranked' && (
                <p className={cn("text-xl sm:text-2xl font-bold font-headline transition-colors duration-500", statusInfo.color)}>
                  {statusInfo.label}
                </p>
              )}
              <p className="text-muted-foreground font-semibold text-sm">{getNextGoalMessage()}</p>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>인증 등급 기준</DialogTitle>
          <DialogDescription>
            도전! 꿈 성취 학교장 인증제의 등급별 기준은 다음과 같습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 text-base">
            <div className="font-semibold flex items-center gap-3">
                <Award className="w-8 h-8 text-yellow-500" /> 
                <span><strong className="text-primary">금장:</strong> {CERTIFICATE_THRESHOLDS.GOLD}개 영역 이상 인증</span>
            </div>
            <div className="font-semibold flex items-center gap-3">
                <Medal className="w-8 h-8 text-gray-500" />
                <span><strong className="text-primary">은장:</strong> {CERTIFICATE_THRESHOLDS.SILVER}개 영역 인증</span>
            </div>
            <div className="font-semibold flex items-center gap-3">
                <Gem className="w-8 h-8 text-orange-500" />
                <span><strong className="text-primary">동장:</strong> {CERTIFICATE_THRESHOLDS.BRONZE}개 영역 인증</span>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
