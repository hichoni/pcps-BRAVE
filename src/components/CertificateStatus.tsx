"use client";

import { useAchievements } from '@/context/AchievementsContext';
import { useAuth } from '@/context/AuthContext';
import { STATUS_CONFIG } from '@/lib/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';

export function CertificateStatus() {
  const { user, loading: authLoading } = useAuth();
  const { certificateStatus, loading: achievementsLoading } = useAchievements();

  if (authLoading || achievementsLoading || !user) {
    return <Skeleton className="h-40 w-full max-w-md mx-auto" />;
  }
  
  const currentStatus = certificateStatus(user.username);
  const statusInfo = STATUS_CONFIG[currentStatus];

  return (
    <Card className="max-w-md mx-auto shadow-lg border-primary/20">
      <CardHeader className="text-center pb-2">
        <CardTitle className="font-headline text-2xl">전체 현황</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <div className="flex flex-col items-center gap-2">
          <statusInfo.icon className={cn("w-20 h-20 transition-all duration-500", statusInfo.color)} />
          <p className={cn("text-3xl font-bold font-headline transition-colors duration-500", statusInfo.color)}>
            {statusInfo.label}
          </p>
          <p className="text-muted-foreground">{currentStatus}</p>
        </div>
      </CardContent>
    </Card>
  );
}
