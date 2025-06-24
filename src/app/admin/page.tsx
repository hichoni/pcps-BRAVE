"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAchievements } from '@/context/AchievementsContext';
import { User, AREAS, AreaName } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Save, Undo, LogOut, Settings } from 'lucide-react';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import Link from 'next/link';

export default function AdminPage() {
  const { user, users, loading, logout, resetPin } = useAuth();
  const { getAchievements, updateProgress, loading: achievementsLoading } = useAchievements();
  const { challengeConfig, loading: configLoading } = useChallengeConfig();
  const router = useRouter();
  const { toast } = useToast();

  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [progress, setProgress] = useState<Record<AreaName, number>>({} as Record<AreaName, number>);

  useEffect(() => {
    if (!loading && user?.role !== 'teacher') {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (selectedStudent) {
      const studentAchievements = getAchievements(selectedStudent.username);
      if (studentAchievements) {
        const initialProgress = {} as Record<AreaName, number>;
        AREAS.forEach(area => {
          initialProgress[area] = studentAchievements[area].progress;
        });
        setProgress(initialProgress);
      }
    }
  }, [selectedStudent, getAchievements]);

  const handleStudentSelect = (username: string) => {
    const student = users.find(u => u.username === username) || null;
    setSelectedStudent(student);
  };

  const handleProgressChange = (area: AreaName, value: string) => {
    const numericValue = parseInt(value, 10);
    if (!isNaN(numericValue)) {
      setProgress(prev => ({ ...prev, [area]: numericValue }));
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedStudent) return;
    try {
      await Promise.all(
        AREAS.map(area => updateProgress(selectedStudent.username, area, progress[area]))
      );
      toast({ title: '성공', description: `${selectedStudent.name} 학생의 정보가 저장되었습니다.` });
    } catch (error) {
      toast({ variant: 'destructive', title: '오류', description: '저장에 실패했습니다.' });
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

  if (loading || achievementsLoading || configLoading || !user || user.role !== 'teacher' || !challengeConfig) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const students = users.filter(u => u.role === 'student');

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex justify-between items-center mb-8 pb-4 border-b">
        <h1 className="text-3xl font-bold font-headline text-primary flex items-center gap-2"><Users/> 관리자 페이지</h1>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>학생 목록</CardTitle>
          </CardHeader>
          <CardContent>
            <Select onValueChange={handleStudentSelect} value={selectedStudent?.username}>
              <SelectTrigger>
                <SelectValue placeholder="학생을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.username}>
                    {s.grade}학년 {s.classNum}반 {s.studentNum}번 {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{selectedStudent ? `${selectedStudent.name} 학생 성취 현황` : '학생을 선택해주세요'}</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedStudent ? (
              <div className="space-y-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>영역</TableHead>
                      <TableHead>목표</TableHead>
                      <TableHead>현재 현황</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {AREAS.map(area => {
                      const areaConfig = challengeConfig[area];
                      return (
                      <TableRow key={area}>
                        <TableCell className="font-medium">{areaConfig.koreanName}</TableCell>
                        <TableCell>{areaConfig.goal} {areaConfig.unit}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={progress[area] || 0}
                            onChange={(e) => handleProgressChange(area, e.target.value)}
                            className="w-32"
                          />
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
                <div className="flex justify-end gap-2">
                  <Button onClick={handleSaveChanges}><Save className="mr-2"/> 변경사항 저장</Button>
                  <Button variant="destructive" onClick={() => handleResetPin(selectedStudent.username)}>
                    <Undo className="mr-2"/> PIN 초기화
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">왼쪽에서 학생을 선택하여 성취 현황을 수정하세요.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
