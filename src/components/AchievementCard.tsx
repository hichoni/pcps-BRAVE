"use client";

import { useAchievements } from '@/context/AchievementsContext';
import { useAuth } from '@/context/AuthContext';
import { AreaName } from '@/lib/config';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AchievementStatusDialog } from './AchievementStatusDialog';
import { Badge } from './ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { Skeleton } from './ui/skeleton';

interface AchievementCardProps {
  areaName: AreaName;
}

export function AchievementCard({ areaName }: AchievementCardProps) {
  const { user } = useAuth();
  const { getAchievements } = useAchievements();
  const { challengeConfig, loading: configLoading } = useChallengeConfig();
  
  if (!user || configLoading || !challengeConfig) {
    return (
        <div className="flex flex-col space-y-3">
          <Skeleton className="h-[180px] w-full rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </div>
      )
  }

  const achievements = getAchievements(user.username);
  const areaConfig = challengeConfig[areaName];
  const areaState = achievements?.[areaName];
  
  if (!areaState || !areaConfig || !user.grade) return null;

  const { isCertified, progress } = areaState;
  const goal = areaConfig.goal[user.grade];
  if (typeof goal === 'undefined') return null;


  const progressValue = goal > 0 ? (progress / goal) * 100 : 0;
  const AreaIcon = areaConfig.icon;

  return (
    <Card className="flex flex-col h-full shadow-md hover:shadow-xl transition-shadow duration-300 border">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3 mb-2">
            <AreaIcon className="w-8 h-8 text-primary" />
            <CardTitle className="font-headline text-xl">{areaConfig.koreanName}</CardTitle>
          </div>
          <Badge variant={isCertified ? 'default' : 'secondary'} className="shrink-0">
            {isCertified ? <CheckCircle2 className="mr-1 h-4 w-4" /> : <XCircle className="mr-1 h-4 w-4" />}
            {isCertified ? '인증됨' : '미인증'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col items-center justify-center">
        <p className="font-headline text-2xl font-semibold text-center mb-4">{areaConfig.challengeName}</p>
        <Progress value={progressValue} className="w-full h-2.5 transition-all duration-500" />
      </CardContent>
      <CardFooter>
        <AchievementStatusDialog areaName={areaName} />
      </CardFooter>
    </Card>
  );
}
