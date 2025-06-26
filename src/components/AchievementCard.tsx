
"use client";

import { useAchievements } from '@/context/AchievementsContext';
import { useAuth } from '@/context/AuthContext';
import { AreaName } from '@/lib/config';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AchievementStatusDialog } from './AchievementStatusDialog';
import { Badge } from './ui/badge';
import { XCircle, Trophy } from 'lucide-react';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { ExternalUrlDialog } from './ExternalUrlDialog';

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
          <Skeleton className="h-[220px] w-full rounded-xl" />
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
  
  if (!areaState || !areaConfig || user.grade === undefined) return null;

  const { isCertified, progress } = areaState;
  
  const AreaIcon = areaConfig.icon;
  const isTeacherInput = areaConfig.goalType === 'objective';

  const renderProgress = () => {
    if (areaConfig.goalType === 'numeric') {
        const goal = areaConfig.goal[user.grade ?? '4'] ?? 0;
        const currentProgress = (progress as number) || 0;
        const unit = areaConfig.unit;

        return (
            <div className="text-center">
                <p className="text-xs sm:text-sm text-muted-foreground">목표: {goal}{unit}</p>
                <p className="font-bold text-base sm:text-lg text-primary h-7">
                    현재: {currentProgress}{unit}
                </p>
            </div>
        );
    }
    if (areaConfig.goalType === 'objective') {
        const hasProgress = !!progress;
        return (
            <div className="text-center">
                 <p className="text-xs sm:text-sm text-muted-foreground">목표: {areaConfig.goalDescription || '교사 확인'}</p>
                 <div className="font-bold text-base sm:text-lg text-primary flex items-center justify-center gap-2 h-7">
                    {hasProgress ? (
                        <>
                            <Trophy className="w-5 h-5"/>
                            <span>{progress}</span>
                        </>
                    ) : (
                        <span className="text-xs sm:text-sm font-normal text-muted-foreground">아직 인증된 등급이 없습니다.</span>
                    )}
                </div>
            </div>
        );
    }
    return null;
  }

  return (
    <Card className={cn(
      "flex flex-col h-full shadow-md hover:shadow-xl transition-shadow duration-300 border",
      isCertified && "bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100 border-amber-400 shadow-amber-500/20"
    )}>
      <CardHeader className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3 mb-2">
            <AreaIcon className={cn("w-8 h-8", isCertified ? "text-amber-500" : "text-primary")} />
            <CardTitle className={cn("font-headline text-lg sm:text-xl", isCertified && "text-amber-700")}>{areaConfig.koreanName}</CardTitle>
          </div>
          {isCertified ? (
            <Badge variant="default" className="shrink-0 bg-amber-400 text-amber-900 hover:bg-amber-400/90 shadow">
              <Trophy className="mr-1 h-4 w-4" />
              인증 완료!
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0">
              <XCircle className="mr-1 h-4 w-4" />
              미인증
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs sm:text-sm pt-1 !mt-0 h-10">
          {areaConfig.challengeName}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex-grow flex flex-col items-center justify-center">
        {renderProgress()}
      </CardContent>
      <CardFooter className="p-4 pt-0 flex items-center gap-2 w-full">
        { !isTeacherInput && <AchievementStatusDialog areaName={areaName} /> }
        {areaConfig.externalUrl && (
          <ExternalUrlDialog url={areaConfig.externalUrl} areaName={areaConfig.koreanName} />
        )}
      </CardFooter>
    </Card>
  );
}
