"use client";

import { useAchievements } from '@/context/AchievementsContext';
import { useAuth } from '@/context/AuthContext';
import { AreaName, AREAS_CONFIG } from '@/lib/config';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AchievementStatusDialog } from './AchievementStatusDialog';
import { Badge } from './ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';

interface AchievementCardProps {
  areaName: AreaName;
}

export function AchievementCard({ areaName }: AchievementCardProps) {
  const { user } = useAuth();
  const { getAchievements } = useAchievements();
  
  if (!user) return null;

  const achievements = getAchievements(user.username);
  const areaConfig = AREAS_CONFIG[areaName];
  const areaState = achievements?.[areaName];
  
  if (!areaState) return null;

  const { isCertified, progress } = areaState;
  const { goal } = areaConfig;

  const progressValue = goal > 0 ? (progress / goal) * 100 : 0;

  return (
    <Card className="flex flex-col h-full shadow-md hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3 mb-2">
            <areaConfig.icon className="w-8 h-8 text-primary" />
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
        <Progress value={progressValue} className="w-full h-3 transition-all duration-500" />
      </CardContent>
      <CardFooter>
        <AchievementStatusDialog areaName={areaName} />
      </CardFooter>
    </Card>
  );
}
