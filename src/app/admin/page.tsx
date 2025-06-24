
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAchievements } from '@/context/AchievementsContext';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { User, AreaName } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Users, Undo, LogOut, Settings, Plus, Minus, Check, Trash2, PlusCircle, Upload, Search } from 'lucide-react';
import { AddStudentDialog } from '@/components/AddStudentDialog';
import { BulkAddStudentsDialog } from '@/components/BulkAddStudentsDialog';

export default function AdminPage() {
  const { user, users, loading: authLoading, logout, resetPin, deleteUser } = useAuth();
  const { getAchievements, setProgress, toggleCertification, loading: achievementsLoading } = useAchievements();
  const { challengeConfig, loading: configLoading } = useChallengeConfig();
  const router = useRouter();
  const { toast } = useToast();
  const [studentToDelete, setStudentToDelete] = useState<User | null>(null);
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false);
  const [isBulkAddDialogOpen, setIsBulkAddDialogOpen] = useState(false);
  
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !authLoading && user?.role !== 'teacher') {
      router.push('/login');
    }
  }, [user, authLoading, router, isClient]);

  useEffect(() => {
    if (isClient) {
      setClassFilter('all');
    }
  }, [gradeFilter, isClient]);

  const handleProgressUpdate = async (username: string, area: AreaName, value: number | string) => {
    try {
        await setProgress(username, area, value);
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

  if (!isClient || authLoading || achievementsLoading || configLoading || !user || user.role !== 'teacher' || !challengeConfig) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const allStudentUsers = users.filter(u => u.role === 'student');

  const availableGrades = [...new Set(allStudentUsers.map(u => u.grade))].sort((a,b) => (a ?? 0) - (b ?? 0));
  
  const studentsForClassList = allStudentUsers.filter(u => gradeFilter === 'all' || u.grade === parseInt(gradeFilter, 10));
  const availableClasses = [...new Set(studentsForClassList.map(u => u.classNum))].sort((a,b) => (a ?? 0) - (b ?? 0));

  const students = allStudentUsers
    .filter(u => {
        const gradeMatch = gradeFilter === 'all' || u.grade === parseInt(gradeFilter, 10);
        const classMatch = classFilter === 'all' || u.classNum === parseInt(classFilter, 10);
        const nameMatch = String(u.name ?? '').toLowerCase().includes(searchQuery.toLowerCase());
        return gradeMatch && classMatch && nameMatch;
    })
    .sort((a, b) => {
        if (a.grade !== b.grade) return (a.grade ?? 0) - (b.grade ?? 0);
        if (a.classNum !== b.classNum) return (a.classNum ?? 0) - (b.classNum ?? 0);
        return (a.studentNum ?? 0) - (b.studentNum ?? 0);
    });
    
  const challengeAreaKeys = Object.keys(challengeConfig).sort();

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex justify-between items-center mb-8 pb-4 border-b">
        <h1 className="text-2xl sm:text-3xl font-bold font-headline text-primary flex items-center gap-2"><Users/> 학생 성취 현황 관리</h1>
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
        <Card className="shadow-lg border">
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>학생 명렬표</CardTitle>
                        <CardDescription>학생들의 성취 현황을 관리하고 검색, 필터링할 수 있습니다.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => setIsAddStudentDialogOpen(true)}>
                            <PlusCircle className="mr-2"/> 학생 등록
                        </Button>
                        <Button variant="outline" onClick={() => setIsBulkAddDialogOpen(true)}>
                            <Upload className="mr-2"/> 일괄 등록
                        </Button>
                    </div>
                </div>
                <div className="mt-4 flex flex-col md:flex-row items-stretch gap-2">
                    <div className="flex items-center gap-2">
                        <Select value={gradeFilter} onValueChange={setGradeFilter}>
                            <SelectTrigger className="w-full md:w-[120px]">
                                <SelectValue placeholder="학년" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">전체 학년</SelectItem>
                                {availableGrades.map(grade => (
                                    grade != null && <SelectItem key={grade} value={String(grade)}>{grade}학년</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={classFilter} onValueChange={setClassFilter} disabled={availableClasses.length === 0}>
                            <SelectTrigger className="w-full md:w-[120px]">
                                <SelectValue placeholder="반" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">전체 반</SelectItem>
                                {availableClasses.map(classNum => (
                                    classNum != null && <SelectItem key={classNum} value={String(classNum)}>{classNum}반</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="relative w-full md:flex-grow">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                         <Input
                            placeholder="학생 이름으로 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                         />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table className="min-w-full">
                  <TableHeader>
                      <TableRow>
                          <TableHead className="w-[220px] sticky left-0 bg-card z-10">학생 정보</TableHead>
                          {challengeAreaKeys.map(area => (
                              <TableHead key={area} className="text-center min-w-[180px]">{challengeConfig[area].koreanName}</TableHead>
                          ))}
                          <TableHead className="text-center w-[220px]">관리</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {students.map(student => {
                          const studentAchievements = getAchievements(student.username);
                          return (
                              <TableRow key={student.id}>
                                  <TableCell className="font-medium whitespace-nowrap sticky left-0 bg-card z-10">
                                      {`${student.grade}학년 ${student.classNum}반 ${student.studentNum}번 ${student.name}`}
                                  </TableCell>
                                  {challengeAreaKeys.map(area => {
                                      const areaConfig = challengeConfig[area];
                                      if (!areaConfig) return null;
                                      const progress = studentAchievements[area]?.progress ?? (areaConfig.goalType === 'numeric' ? 0 : '');
                                      const isCertified = studentAchievements[area]?.isCertified ?? false;
                                      return (
                                          <TableCell key={area}>
                                              <div className="flex items-center justify-center gap-1">
                                                  {areaConfig.goalType === 'numeric' ? (
                                                      <>
                                                          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleProgressUpdate(student.username, area, Math.max(0, (progress as number || 0) - 1))}>
                                                              <Minus className="h-3 w-3"/>
                                                          </Button>
                                                          <span className="font-mono w-8 text-center text-base">{progress as number || 0}</span>
                                                          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => handleProgressUpdate(student.username, area, (progress as number || 0) + 1)}>
                                                              <Plus className="h-3 w-3"/>
                                                          </Button>
                                                      </>
                                                  ) : (
                                                      <Select
                                                        value={progress as string || ''}
                                                        onValueChange={(value) => handleProgressUpdate(student.username, area, value)}
                                                      >
                                                        <SelectTrigger className="w-[120px] h-8">
                                                            <SelectValue placeholder="선택" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="">미선택</SelectItem>
                                                            {areaConfig.options?.map(option => (
                                                                <SelectItem key={option} value={option}>{option}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                      </Select>
                                                  )}
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
              </div>
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

      <AddStudentDialog open={isAddStudentDialogOpen} onOpenChange={setIsAddStudentDialogOpen} />
      <BulkAddStudentsDialog open={isBulkAddDialogOpen} onOpenChange={setIsBulkAddDialogOpen} />
    </div>
  );
}
