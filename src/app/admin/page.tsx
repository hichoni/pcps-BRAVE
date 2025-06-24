"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAchievements } from '@/context/AchievementsContext';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { User, AREAS, AreaName } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Users, Undo, LogOut, Settings, Plus, Minus, Check, Trash2 } from 'lucide-react';

export default function AdminPage() {
  const { user, users, loading: authLoading, logout, resetPin, deleteUser } = useAuth();
  const { getAchievements, updateProgress, toggleCertification, loading: achievementsLoading } = useAchievements();
  const { challengeConfig, loading: configLoading } = useChallengeConfig();
  const router = useRouter();
  const { toast } = useToast();
  const [studentToDelete, setStudentToDelete] = useState<User | null>(null);


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

  const handleToggleCertification = async (username: string, area: AreaName) => {
    try {
        await toggleCertification(username, area);
    } catch (error) {
        toast({ variant: 'destructive', title: '오류', description: '인증 상태 변경에 실패했습니다.' });
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

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    try {
        await deleteUser(studentToDelete.username);
        toast({ title: '성공', description: `${studentToDelete.name} 학생 정보가 삭제되었습니다.`});
    } catch (error) {
        toast({ variant: 'destructive', title: '오류', description: '학생 정보 삭제에 실패했습니다.' });
    } finally {
        setStudentToDelete(null);
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
              <Button variant="outline" aria-label="도전 영역 관리">
                <Settings className="mr-2"/> 도전 영역 관리
              </Button>
           </Link>
          <Button variant="outline" onClick={logout}><LogOut className="mr-2"/> 로그아웃</Button>
        </div>
      </header>

      <AlertDialog onOpenChange={(open) => !open && setStudentToDelete(null)}>
        <Card>
            <CardHeader>
                <CardTitle>학생 명렬표</CardTitle>
                <CardDescription>학생들의 도전과제 성취 현황을 관리하고 PIN을 초기화하거나 학생 정보를 삭제할 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead className="w-[220px]">학생 정보</TableHead>
                          {AREAS.map(area => (
                              <TableHead key={area} className="text-center">{challengeConfig[area].koreanName}</TableHead>
                          ))}
                          <TableHead className="text-center w-[220px]">관리</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {students.map(student => {
                          const studentAchievements = getAchievements(student.username);
                          return (
                              <TableRow key={student.id}>
                                  <TableCell className="font-medium whitespace-nowrap">
                                      {`${student.grade}학년 ${student.classNum}반 ${student.studentNum}번 ${student.name}`}
                                  </TableCell>
                                  {AREAS.map(area => {
                                      const progress = studentAchievements?.[area]?.progress ?? 0;
                                      const isCertified = studentAchievements?.[area]?.isCertified ?? false;
                                      return (
                                          <TableCell key={area}>
                                              <div className="flex items-center justify-center gap-1">
                                                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleProgressUpdate(student.username, area, -1)}>
                                                      <Minus className="h-3 w-3"/>
                                                  </Button>
                                                  <span className="font-mono w-8 text-center text-base">{progress}</span>
                                                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleProgressUpdate(student.username, area, 1)}>
                                                      <Plus className="h-3 w-3"/>
                                                  </Button>
                                                  <Button
                                                    variant={isCertified ? 'default' : 'outline'}
                                                    size="icon"
                                                    className="h-6 w-6 ml-2"
                                                    onClick={() => handleToggleCertification(student.username, area)}
                                                  >
                                                      <Check className="h-4 w-4" />
                                                  </Button>
                                              </div>
                                          </TableCell>
                                      )
                                  })}
                                  <TableCell className="text-center">
                                      <div className="flex items-center justify-center gap-2">
                                          <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => handleResetPin(student.username)}>
                                              <Undo className="mr-1 h-3.5 w-3.5" /> PIN 초기화
                                          </Button>
                                          <AlertDialogTrigger asChild>
                                              <Button variant="destructive" size="sm" className="h-8 px-2" onClick={() => setStudentToDelete(student)}>
                                                  <Trash2 className="mr-1 h-3.5 w-3.5" /> 삭제
                                              </Button>
                                          </AlertDialogTrigger>
                                      </div>
                                  </TableCell>
                              </TableRow>
                          )
                      })}
                  </TableBody>
              </Table>
            </CardContent>
        </Card>

        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                    {studentToDelete && `${studentToDelete.grade}학년 ${studentToDelete.classNum}반 ${studentToDelete.studentNum}번 ${studentToDelete.name}`} 학생의 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteStudent} className="bg-destructive hover:bg-destructive/90">
                    삭제
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
