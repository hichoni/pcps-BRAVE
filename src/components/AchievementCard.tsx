"use client";

import { useState, useEffect } from 'react';
import { useAchievements } from '@/context/AchievementsContext';
import { useAuth } from '@/context/AuthContext';
import { AreaName } from '@/lib/config';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { AchievementStatusDialog } from './AchievementStatusDialog';
import { Trophy, History, ListChecks, Loader2 } from 'lucide-react';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { ExternalUrlDialog } from './ExternalUrlDialog';
import { Button } from './ui/button';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { isSameDay } from 'date-fns';
import { Progress } from './ui/progress';

interface AchievementCardProps {
  areaName: AreaName;
}

export function AchievementCard({ areaName }: AchievementCardProps) {
  const { user } = useAuth();
  const { getAchievements } = useAchievements();
  const { challengeConfig, loading: configLoading } = useChallengeConfig();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'history' | 'submit'>('submit');
  const [hasApprovedToday, setHasApprovedToday] = useState(false);
  const [isCheckingHistory, setIsCheckingHistory] = useState(true);

  const openDialog = (mode: 'history' | 'submit') => {
    setDialogMode(mode);
    setDialogOpen(true);
  }

  useEffect(() => {
    if (!user || !db) {
      setIsCheckingHistory(false);
      return;
    }
    setIsCheckingHistory(true);
    const q = query(
      collection(db, "challengeSubmissions"),
      where("userId", "==", user.username),
      where("areaName", "==", areaName),
      where("status", "==", "approved")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const today = new Date();
      const approvedToday = snapshot.docs.some(doc => {
        const data = doc.data();
        const createdAt = (data.createdAt as Timestamp)?.toDate();
        return createdAt && isSameDay(createdAt, today);
      });
      setHasApprovedToday(approvedToday);
      setIsCheckingHistory(false);
    }, (error) => {
        console.error("Error checking submission history:", error);
        setIsCheckingHistory(false);
    });
    return () => unsubscribe();
  }, [user, areaName]);


  if (!user || configLoading || !challengeConfig) {
    return (
        <div className="flex flex-col space-y-3">
          <Skeleton className="h-[150px] w-full rounded-xl" />
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
  
  const gradeKey = user.grade === 0 ? '6' : String(user.grade ?? '4');
  const goal = areaConfig.goal[gradeKey] ?? 0;
  const currentProgress = (progress as number) || 0;
  const progressPercent = goal > 0 ? (currentProgress / goal) * 100 : 0;

  const renderProgressInfo = () => {
    if (areaConfig.goalType === 'numeric') {
        return (
            <div className="text-right">
                <p className={cn("text-2xl font-bold", isCertified ? "text-accent" : "text-primary")}>
                    {currentProgress}
                    <span className="text-base font-normal text-foreground/80 ml-1">{areaConfig.unit}</span>
                </p>
                <p className="text-xs text-foreground/80">목표: {goal}{areaConfig.unit}</p>
            </div>
        );
    }
    if (areaConfig.goalType === 'objective') {
        const hasProgress = !!progress;
        return (
             <div className="text-right">
                 <p className={cn("text-2xl font-bold", isCertified ? "text-accent" : (hasProgress ? "text-primary" : "text-foreground/80"))}>
                    {hasProgress ? progress : '미설정'}
                 </p>
                 <p className="text-xs text-foreground/80">{areaConfig.unit}</p>
            </div>
        );
    }
    return null;
  };

  const getButtonText = () => {
    if (isCheckingHistory) return '확인 중';
    if (hasApprovedToday) return '오늘 도전 완료';
    if (isCertified) return '계속 도전하기';
    return '도전하기';
  };

  return (
    <>
      <Card className={cn(
        "w-full overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 border",
        isCertified && "border-accent shadow-accent/20"
      )}>
        <CardContent className="p-4">
            <div className="flex justify-between items-start gap-4">
                <div className="flex items-start gap-4">
                    <div className={cn(
                      "flex-shrink-0 h-14 w-14 rounded-lg flex items-center justify-center", 
                      isCertified ? "bg-accent" : "bg-primary/10"
                    )}>
                        <AreaIcon className={cn("w-8 h-8", isCertified ? "text-accent-foreground" : "text-primary")} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-foreground">{areaConfig.koreanName}</h3>
                        <p className="text-xs text-muted-foreground">{areaConfig.challengeName}</p>
                    </div>
                </div>
                <div className="flex-shrink-0">
                    {renderProgressInfo()}
                </div>
            </div>

            {areaConfig.goalType === 'numeric' && !isCertified && (
                <div className="mt-4">
                    <Progress value={progressPercent} className="h-2" />
                </div>
            )}
            
            {isCertified && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-accent p-2 bg-accent/10 rounded-md">
                    <Trophy className="w-4 h-4"/>
                    <span>인증 완료! 축하합니다!</span>
                </div>
            )}

        </CardContent>
        
        {!isTeacherInput && (
            <CardFooter className="bg-muted/50 p-2 px-4 flex items-center gap-2 w-full border-t">
                 <Button variant="ghost" size="sm" className="flex-grow text-muted-foreground font-semibold" onClick={() => openDialog('history')}>
                    <History className="mr-2 h-4 w-4" />
                    활동 내역
                </Button>
                <Button size="sm" className="flex-grow font-bold bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => openDialog('submit')} disabled={hasApprovedToday || isCheckingHistory}>
                    {isCheckingHistory 
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <ListChecks className="mr-2 h-4 w-4" />
                    }
                    {getButtonText()}
                </Button>
                {areaConfig.externalUrl && (
                    <ExternalUrlDialog url={areaConfig.externalUrl} areaName={areaConfig.koreanName} />
                )}
            </CardFooter>
        )}
      </Card>
      { !isTeacherInput && <AchievementStatusDialog areaName={areaName} open={dialogOpen} onOpenChange={setDialogOpen} initialMode={dialogMode} /> }
    </>
  );
}
