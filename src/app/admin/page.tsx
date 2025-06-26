
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAchievements } from '@/context/AchievementsContext';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { User, AreaName, STATUS_CONFIG } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Users, Undo, LogOut, Settings, Plus, Minus, Check, Trash2, PlusCircle, Upload, Search, Edit, MailCheck, GalleryThumbnails } from 'lucide-react';
import { AddStudentDialog } from '@/components/AddStudentDialog';
import { EditStudentDialog } from '@/components/EditStudentDialog';
import { BulkAddStudentsDialog } from '@/components/BulkAddStudentsDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { BulkDeleteStudentsDialog } from '@/components/BulkDeleteStudentsDialog';

function PendingReviewsBadge() {
    const { user } = useAuth();
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!db || !user) return;

        let q;
        if (user.areaName) {
            q = query(
                collection(db, "challengeSubmissions"), 
                where("status", "==", "pending_review"),
                where("areaName", "==", user.areaName)
            );
        } else {
             q = query(collection(db, "challengeSubmissions"), where("status", "==", "pending_review"));
        }
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCount(snapshot.size);
        });

        return () => unsubscribe();
    }, [user]);

    if (count === 0) return null;

    return (
        <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-destructive text-destructive-foreground animate-pulse">
            {count}
        </Badge>
    )
}


export default function AdminPage() {
  const { user, users, loading: authLoading, logout, resetPin, deleteUser } = useAuth();
  const { getAchievements, setProgress, toggleCertification, loading: achievementsLoading, certificateStatus } = useAchievements();
  const { challengeConfig, loading: configLoading } = useChallengeConfig();
  const router = useRouter();
  const { toast } = useToast();
  
  const [studentToEdit, setStudentToEdit] = useState<User | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<User | null>(null);
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false);
  const [isBulkAddDialogOpen, setIsBulkAddDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  
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
    
  const challengeAreaKeys = user.areaName ? [user.areaName] : Object.keys(challengeConfig).sort();

  return (
    <TooltipProvider>
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b">
        <h1 className="text-2xl sm:text-3xl font-bold font-headline text-primary flex items-center gap-2"><Users/> 학생 성취 현황 관리</h1>
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap justify-end">
          <span className="font-semibold text-sm sm:text-base whitespace-nowrap">{user.name} 선생님</span>
          <Button asChild variant="outline" size="sm">
            <Link href="/gallery">
                <GalleryThumbnails className="h-4 w-4 sm:mr-2"/>
                <span className="hidden sm:inline">갤러리 관리</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="relative">
            <Link href="/admin/review">
                <MailCheck className="h-4 w-4 sm:mr-2"/>
                <span className="hidden sm:inline">도전 활동 검토</span>
                <PendingReviewsBadge />
            </Link>
          </Button>
          {!user.areaName && (
            <Button asChild variant="outline" size="sm">
                <Link href="/admin/challenges">
                    <Settings className="h-4 w-4 sm:mr-2"/>
                    <span className="hidden sm:inline">도전 영역 관리</span>
                </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 sm:mr-2"/>
            <span className="hidden sm:inline">로그아웃</span>
          </Button>
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
                    {!user.areaName && (
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button onClick={() => setIsAddStudentDialogOpen(true)}>
                                <PlusCircle className="mr-2"/> 학생 등록
                            </Button>
                            <Button variant="outline" onClick={() => setIsBulkAddDialogOpen(true)}>
                                <Upload className="mr-2"/> 일괄 등록
                            </Button>
                             <Button variant="destructive" onClick={() => setIsBulkDeleteDialogOpen(true)} className="bg-destructive hover:bg-destructive/90">
                                <Trash2 className="mr-2"/> 일괄 삭제
                            </Button>
                        </div>
                    )}
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
                          <TableHead className="w-[200px] sticky left-0 bg-card z-10">학생 정보</TableHead>
                          <TableHead className="w-[120px] sticky left-[200px] bg-card z-10 text-center">인증 등급</TableHead>
                          {challengeAreaKeys.map(area => (
                              <TableHead key={area} className="text-center min-w-[170px]">{challengeConfig[area].koreanName}</TableHead>
                          ))}
                          {!user.areaName && (
                            <TableHead className="text-center w-[120px]">관리</TableHead>
                          )}
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {students.map(student => {
                          const studentAchievements = getAchievements(student.username);
                          const studentStatus = certificateStatus(student.username);
                          const statusInfo = STATUS_CONFIG[studentStatus];
                          return (
                              <TableRow key={student.id} className="h-14">
                                  <TableCell className="font-medium whitespace-nowrap sticky left-0 bg-card z-10 w-[200px] px-2 py-1 align-middle">
                                      {`${student.grade}학년 ${student.classNum}반 ${student.studentNum}번 ${student.name}`}
                                  </TableCell>
                                  <TableCell className="sticky left-[200px] bg-card z-10 w-[120px] px-2 py-1 align-middle">
                                    <div className="flex items-center justify-center gap-1.5 font-semibold">
                                        <statusInfo.icon className={cn("h-4 w-4", statusInfo.color)} />
                                        <span className={cn(statusInfo.color)}>{statusInfo.label}</span>
                                    </div>
                                  </TableCell>
                                  {challengeAreaKeys.map(area => {
                                      const areaConfig = challengeConfig[area];
                                      if (!areaConfig) return null;
                                      const progress = studentAchievements[area]?.progress ?? (areaConfig.goalType === 'numeric' ? 0 : '');
                                      const isCertified = studentAchievements[area]?.isCertified ?? false;
                                      return (
                                          <TableCell key={area} className="px-2 py-1 align-middle">
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
                                                        onValueChange={(value) => handleProgressUpdate(student.username, area, value === '__NONE__' ? '' : value)}
                                                      >
                                                        <SelectTrigger className="w-[110px] h-8 text-xs">
                                                            <SelectValue placeholder="선택" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="__NONE__">미선택</SelectItem>
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
                                  {!user.areaName && (
                                    <TableCell className="text-center w-[120px] px-2 py-1 align-middle">
                                        <div className="flex items-center justify-center gap-1">
                                              <Tooltip>
                                                  <TooltipTrigger asChild>
                                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStudentToEdit(student)}>
                                                          <Edit className="h-4 w-4" />
                                                      </Button>
                                                  </TooltipTrigger>
                                                  <TooltipContent><p>학생 정보 수정</p></TooltipContent>
                                              </Tooltip>
                                              <Tooltip>
                                                  <TooltipTrigger asChild>
                                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleResetPin(student.username)}>
                                                          <Undo className="h-4 w-4" />
                                                      </Button>
                                                  </TooltipTrigger>
                                                  <TooltipContent><p>PIN 초기화</p></TooltipContent>
                                              </Tooltip>
                                              <Tooltip>
                                                  <TooltipTrigger asChild>
                                                      <AlertDialogTrigger asChild>
                                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setStudentToDelete(student)}>
                                                              <Trash2 className="h-4 w-4" />
                                                          </Button>
                                                      </AlertDialogTrigger>
                                                  </TooltipTrigger>
                                                  <TooltipContent><p>학생 삭제</p></TooltipContent>
                                              </Tooltip>
                                        </div>
                                    </TableCell>
                                  )}
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
      <EditStudentDialog open={!!studentToEdit} onOpenChange={(open) => !open && setStudentToEdit(null)} student={studentToEdit} />
      <BulkAddStudentsDialog open={isBulkAddDialogOpen} onOpenChange={setIsBulkAddDialogOpen} />
      <BulkDeleteStudentsDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen} />
    </div>
    </TooltipProvider>
  );
}
