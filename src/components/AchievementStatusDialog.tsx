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

export function AchievementStatusDialog({ areaName }: { areaName: AreaName }) {
  const { user } = useAuth();
  const { getAchievements } = useAchievements();
  const { challengeConfig } = useChallengeConfig();
  
  if (!user || !challengeConfig) return null;
  
  const achievements = getAchievements(user.username);
  const areaConfig = challengeConfig[areaName];
  const areaState = achievements?.[areaName];

  if (!areaState || !areaConfig) return null;
  
  const { progress } = areaState;
  const { goal, unit, koreanName, challengeName } = areaConfig;

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
        <div className="py-4 text-center">
            <div className="text-lg text-muted-foreground">현재 달성도</div>
            <div className="text-4xl font-bold text-primary my-2">
                {progress} <span className="text-2xl text-muted-foreground">{unit}</span>
            </div>
            <div className="text-sm text-muted-foreground">목표: {goal} {unit}</div>
        </div>
         <DialogClose asChild>
            <Button type="button" className="w-full">확인</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
