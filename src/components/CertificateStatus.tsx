"use client";

import { useAchievements } from '@/context/AchievementsContext';
import { STATUS_CONFIG } from '@/lib/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';

export function CertificateStatus() {
  const { certificateStatus, loading } = useAchievements();

  if (loading) {
    return <Skeleton className="h-40 w-full max-w-md mx-auto" />;
  }
  
  const statusInfo = STATUS_CONFIG[certificateStatus];

  return (
    <Card className="max-w-md mx-auto shadow-lg border-primary/20">
      <CardHeader className="text-center pb-2">
        <CardTitle className="font-headline text-2xl">Overall Status</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <div className="flex flex-col items-center gap-2">
          <statusInfo.icon className={cn("w-20 h-20 transition-all duration-500", statusInfo.color)} />
          <p className={cn("text-3xl font-bold font-headline transition-colors duration-500", statusInfo.color)}>
            {statusInfo.label}
          </p>
          <p className="text-muted-foreground">{certificateStatus}</p>
        </div>
      </CardContent>
    </Card>
  );
}
