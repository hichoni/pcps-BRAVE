"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAchievements } from '@/context/AchievementsContext';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { User, AREAS, AreaName } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Undo, LogOut, Settings, Plus, Minus, CheckCircle2 } from 'lucide-react';

export default function AdminPage() {
  const { user, users, loading: authLoading, logout, resetPin } = useAuth();
  const { getAchievements, updateProgress, loading: achievementsLoading } = useAchievements();
  const { challengeConfig, loading: configLoading } = useChallengeConfig();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && user?.role !== 'teacher') {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleProgressUpdate = async (username: string, area: AreaName, change: number) => {
    const studentAchievements = getAchievements(username);
    const currentProgress = studentAchievements?.[area]?.progress || 0;
    const newProgress = Math.max(0, currentProgress + change);
    try {
        await updateProgress(username, area, newProgress);
    } catch (error) {
        toast({ variant: 'destructive', title: '오류', description: '업데이트에 실패했습니다.' });
    }
  };

  const handleResetPin = async (studentUsername: string) => {
    try {
        await resetPin(studentUsername);
        const student = users.find(u => u.username === studentUsername);
        toast({ title: '성공', description: `${student?.name} 학생의 PIN이 '0000'으로 초기화되었습니다.`});
    } catch (error) {
        toast({ variant: 'destructive', title: '오류', description: 'PIN 초기화에 실패했습니다.' });
    }
  };

  if (authLoading || achievementsLoading || configLoading || !user || user.role !== 'teacher' || !challengeConfig) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const students = users
    .filter(u => u.role === 'student')
    .sort((a, b) => {
        if (a.grade !== b.grade) return (a.grade ?? 0) - (b.grade ?? 0);
        if (a.classNum !== b.classNum) return (a.classNum ?? 0) - (b.classNum ?? 0);
        return (a.studentNum ?? 0) - (b.studentNum ?? 0);
    });

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex justify-between items-center mb-8 pb-4 border-b">
        <h1 className="text-3xl font-bold font-headline text-primary flex items-center gap-2"><Users/> 학생 성취 현황 관리</h1>
        <div className="flex items-center gap-4">
          <span className="font-semibold">{user.name} 선생님</span>
           <Link href="/admin/challenges" passHref>
              <Button variant="outline" size="icon" aria-label="도전 영역 관리">
                <Settings/>
              </Button>
           </Link>
          <Button variant="outline" onClick={logout}><LogOut className="mr-2"/> 로그아웃</Button>
        </div>
      </header>

      <Card>
          <CardHeader>
              <CardTitle>학생 명렬표</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[150px]">학생 정보</TableHead>
                        {AREAS.map(area => (
                            <TableHead key={area}>{challengeConfig[area].koreanName}</TableHead>
                        ))}
                        <TableHead className="text-center">관리</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {students.map(student => {
                        const studentAchievements = getAchievements(student.username);
                        return (
                            <TableRow key={student.id}>
                                <TableCell className="font-medium">
                                    {student.grade}-{student.classNum} {student.studentNum} {student.name}
                                </TableCell>
                                {AREAS.map(area => {
                                    const progress = studentAchievements?.[area]?.progress ?? 0;
                                    const isCertified = studentAchievements?.[area]?.isCertified ?? false;
                                    return (
                                        <TableCell key={area}>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleProgressUpdate(student.username, area, -1)}>
                                                    <Minus className="h-4 w-4"/>
                                                </Button>
                                                <span className="font-mono w-8 text-center">{progress}</span>
                                                <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleProgressUpdate(student.username, area, 1)}>
                                                    <Plus className="h-4 w-4"/>
                                                </Button>
                                                {isCertified && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                            </div>
                                        </TableCell>
                                    )
                                })}
                                <TableCell className="text-center">
                                    <Button variant="destructive" size="sm" onClick={() => handleResetPin(student.username)}>
                                        <Undo className="mr-2 h-4 w-4" /> PIN 초기화
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
          </CardContent>
      </Card>
    </div>
  );
}
