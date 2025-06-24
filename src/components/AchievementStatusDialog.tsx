"use client";

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { useAchievements } from '@/context/AchievementsContext';
import { useAuth } from '@/context/AuthContext';
import { AreaName } from '@/lib/config';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { ListChecks } from 'lucide-react';
import { Badge } from './ui/badge';

export function AchievementStatusDialog({ areaName }: { areaName: AreaName }) {
  const { user } = useAuth();
  const { getAchievements } = useAchievements();
  const { challengeConfig } = useChallengeConfig();
  
  if (!user || !challengeConfig || !user.grade) return null;
  
  const achievements = getAchievements(user.username);
  const areaConfig = challengeConfig[areaName];
  const areaState = achievements?.[areaName];

  if (!areaState || !areaConfig) return null;
  
  const { progress } = areaState;
  const { unit, koreanName, challengeName } = areaConfig;


  const renderStatus = () => {
    if (areaConfig.goalType === 'numeric') {
        const goalForGrade = areaConfig.goal[user.grade ?? '4'] ?? 0;
        return (
             <div className="py-4 text-center">
                <div className="text-lg text-muted-foreground">현재 달성도</div>
                <div className="text-4xl font-bold text-primary my-2">
                    {progress as number || 0} <span className="text-2xl text-muted-foreground">{unit}</span>
                </div>
                <div className="text-sm text-muted-foreground">목표: {goalForGrade} {unit}</div>
            </div>
        );
    }
     if (areaConfig.goalType === 'objective') {
        return (
             <div className="py-4 text-center">
                <div className="text-lg text-muted-foreground">현재 달성 상태</div>
                <div className="text-4xl font-bold text-primary my-2">
                   {progress || "미달성"}
                </div>
                <div className="text-sm text-muted-foreground mt-4">선택 가능 {unit}:</div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {areaConfig.options?.map(opt => (
                        <Badge key={opt} variant={progress === opt ? 'default' : 'secondary'}>{opt}</Badge>
                    ))}
                </div>
            </div>
        );
     }
     return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full font-bold">
          <ListChecks className="mr-2 h-4 w-4" /> 인증 현황
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">{koreanName} 영역 현황</DialogTitle>
          <DialogDescription>
            {challengeName}
          </DialogDescription>
        </DialogHeader>
        {renderStatus()}
         <DialogClose asChild>
            <Button type="button" className="w-full">확인</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
