
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, User as UserIcon, ShieldCheck, Download, AlertCircle, Share2 } from 'lucide-react';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User } from '@/lib/config';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const studentLoginSchema = z.object({
  grade: z.string().min(1, { message: '학년을 선택해주세요.' }),
  classNum: z.string().min(1, { message: '반을 선택해주세요.' }),
  studentNum: z.string().min(1, { message: '번호를 선택해주세요.' }),
  pin: z.string().length(4, { message: 'PIN 번호는 4자리여야 합니다.' }),
});

const teacherLoginSchema = z.object({
  username: z.string().min(1, { message: '아이디를 입력해주세요.' }),
  pin: z.string().length(4, { message: 'PIN 번호는 4자리여야 합니다.' }),
});

type StudentLoginFormValues = z.infer<typeof studentLoginSchema>;
type TeacherLoginFormValues = z.infer<typeof teacherLoginSchema>;

const maskName = (name: string) => {
  if (name.length > 2) {
    return `${name.charAt(0)}${'*'.repeat(name.length - 2)}${name.charAt(name.length - 1)}`;
  }
  if (name.length === 2) {
    return `${name.charAt(0)}*`;
  }
  return name;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, users, loading: authLoading, usersLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [foundStudent, setFoundStudent] = useState<User | null>(null);
  const [studentNotFound, setStudentNotFound] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // New state for PWA install prompt
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);


  useEffect(() => {
    setIsClient(true);
    
    const isIosDevice = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);
  
  const handleInstallClick = () => {
    if (!installPrompt) return;
    
    (installPrompt as any).prompt();
    (installPrompt as any).userChoice.then((choiceResult: { outcome: string }) => {
      if (choiceResult.outcome === 'accepted') {
        toast({ title: "앱 설치 완료", description: "이제 홈 화면에서 바로 접속할 수 있어요!" });
      } else {
        toast({ title: "설치 취소됨", description: "나중에 언제든지 다시 설치할 수 있습니다.", duration: 3000 });
      }
      setInstallPrompt(null);
    });
  };


  const studentForm = useForm<StudentLoginFormValues>({
    resolver: zodResolver(studentLoginSchema),
    defaultValues: { grade: '', classNum: '', studentNum: '', pin: '' },
  });

  const teacherForm = useForm<TeacherLoginFormValues>({
    resolver: zodResolver(teacherLoginSchema),
  });

  const watchedGrade = studentForm.watch('grade');
  const watchedClassNum = studentForm.watch('classNum');
  const watchedStudentNum = studentForm.watch('studentNum');

  const studentUsers = useMemo(() => users.filter(u => u.role === 'student'), [users]);

  const availableGrades = useMemo(() => {
    return [...new Set(studentUsers.map(u => u.grade))].sort((a, b) => (a ?? 0) - (b ?? 0));
  }, [studentUsers]);
  
  const availableClasses = useMemo(() => {
    if (!watchedGrade) return [];
    const gradeNum = parseInt(watchedGrade, 10);
    const studentsInGrade = studentUsers.filter(u => u.grade === gradeNum);
    return [...new Set(studentsInGrade.map(u => u.classNum))].sort((a, b) => (a ?? 0) - (b ?? 0));
  }, [studentUsers, watchedGrade]);

  const availableStudentNums = useMemo(() => {
    if (!watchedGrade || !watchedClassNum) return [];
    const gradeNum = parseInt(watchedGrade, 10);
    const classNum = parseInt(watchedClassNum, 10);
    const studentsInClass = studentUsers.filter(u => u.grade === gradeNum && u.classNum === classNum);
    return [...new Set(studentsInClass.map(u => u.studentNum))].sort((a, b) => (a ?? 0) - (b ?? 0));
  }, [studentUsers, watchedGrade, watchedClassNum]);


  useEffect(() => {
    const findStudent = () => {
        if (watchedGrade && watchedClassNum && watchedStudentNum) {
          const grade = parseInt(watchedGrade, 10);
          const classNum = parseInt(watchedClassNum, 10);
          const studentNum = parseInt(watchedStudentNum, 10);
          if (!isNaN(grade) && !isNaN(classNum) && !isNaN(studentNum)) {
            if (!usersLoading) {
                const student = users.find(u =>
                  u.role === 'student' &&
                  u.grade === grade &&
                  u.classNum === classNum &&
                  u.studentNum === studentNum
                );
                setFoundStudent(student || null);
                setStudentNotFound(!student);
            }
          } else {
            setFoundStudent(null);
            setStudentNotFound(false);
          }
        } else {
          setFoundStudent(null);
          setStudentNotFound(false);
        }
    };
    findStudent();
  }, [watchedGrade, watchedClassNum, watchedStudentNum, users, usersLoading]);

  const onStudentSubmit = async (data: StudentLoginFormValues) => {
    setLoading(true);
    try {
      const loggedInUser = await login({
        grade: parseInt(data.grade, 10),
        classNum: parseInt(data.classNum, 10),
        studentNum: parseInt(data.studentNum, 10),
        pin: data.pin
      });
      handleLoginSuccess(loggedInUser);
    } catch (error) {
      handleLoginFailure();
    } finally {
      setLoading(false);
    }
  };

  const onTeacherSubmit = async (data: TeacherLoginFormValues) => {
    setLoading(true);
    try {
      const loggedInUser = await login({ username: data.username, pin: data.pin });
      handleLoginSuccess(loggedInUser);
    } catch (error) {
      handleLoginFailure();
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (loggedInUser: User | null) => {
    if (loggedInUser) {
      toast({
        title: '로그인 성공',
        description: `${loggedInUser.name}님, 환영합니다!`,
      });
      if (loggedInUser.role === 'teacher') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } else {
      throw new Error('Invalid credentials');
    }
  };

  const handleLoginFailure = () => {
    toast({
      variant: 'destructive',
      title: '로그인 실패',
      description: '입력한 정보가 올바르지 않습니다.',
    });
  };

  const combinedLoading = loading || usersLoading;

  if (!isClient || authLoading || usersLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-secondary">
      <main>
        <Card className="w-full max-w-sm shadow-lg border">
          <CardHeader className="text-center pt-6 pb-4">
            <Image
              src="/icon-main.png"
              alt="풍천풍서초등학교 로고"
              width={80}
              height={80}
              priority
              className="mx-auto rounded-full shadow-md mb-2"
            />
            <CardTitle className="font-headline text-2xl text-primary">학교장 인증제 로그인</CardTitle>
            <CardDescription>계정 정보를 입력해주세요.</CardDescription>
          </CardHeader>
          
          <div className="px-6 pb-4 space-y-3">
              {isClient && !isStandalone && installPrompt && (
                <Button onClick={handleInstallClick} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                  <Download className="mr-2"/>
                  앱으로 설치하고 편하게 사용하기
                </Button>
              )}
              {isClient && !isStandalone && isIos && !installPrompt && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>iPhone/iPad 설치 안내</AlertTitle>
                  <AlertDescription>
                    하단 공유 버튼 <Share2 className="inline h-4 w-4 align-text-bottom mx-0.5" /> 을 누른 후 '홈 화면에 추가'를 선택하세요.
                  </AlertDescription>
                </Alert>
              )}
          </div>

          <Tabs defaultValue="student" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="student"><UserIcon className="mr-2"/> 학생</TabsTrigger>
              <TabsTrigger value="teacher"><ShieldCheck className="mr-2"/> 교사</TabsTrigger>
            </TabsList>
            <TabsContent value="student">
              <Form {...studentForm}>
                <form onSubmit={studentForm.handleSubmit(onStudentSubmit)}>
                  <CardContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-3 gap-2">
                      <FormField
                          control={studentForm.control}
                          name="grade"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>학년</FormLabel>
                              <Select
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  studentForm.setValue('classNum', '');
                                  studentForm.setValue('studentNum', '');
                                }}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="학년" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {availableGrades.map(grade => (
                                    grade != null && <SelectItem key={grade} value={String(grade)}>{grade}학년</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={studentForm.control}
                          name="classNum"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>반</FormLabel>
                              <Select
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  studentForm.setValue('studentNum', '');
                                }}
                                value={field.value}
                                disabled={!watchedGrade || availableClasses.length === 0}
                              >
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="반" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {availableClasses.map(classNum => (
                                    classNum != null && <SelectItem key={classNum} value={String(classNum)}>{classNum}반</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={studentForm.control}
                          name="studentNum"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>번호</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled={!watchedClassNum || availableStudentNums.length === 0}
                              >
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="번호" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {availableStudentNums.map(num => (
                                    num != null && <SelectItem key={num} value={String(num)}>{num}번</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                    </div>
                    
                    {foundStudent ? (
                        <div className="p-3 bg-secondary rounded-md text-center text-secondary-foreground font-semibold">
                            {maskName(foundStudent.name)}
                        </div>
                    ) : studentNotFound && (
                        <div className="p-3 bg-destructive/10 rounded-md text-center text-destructive text-sm font-semibold">
                            해당 정보의 학생을 찾을 수 없습니다.
                        </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="pin-student">PIN 번호</Label>
                      <Input
                        id="pin-student"
                        type="password"
                        maxLength={4}
                        placeholder="4자리 숫자"
                        {...studentForm.register('pin')}
                        className="text-lg"
                      />
                      {studentForm.formState.errors.pin && <p className="text-sm text-destructive">{studentForm.formState.errors.pin.message}</p>}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full font-bold" disabled={combinedLoading}>
                      {combinedLoading ? <Loader2 className="animate-spin" /> : <LogIn />}
                      로그인
                    </Button>
                  </CardFooter>
                </form>
              </Form>
            </TabsContent>
            <TabsContent value="teacher">
              <form onSubmit={teacherForm.handleSubmit(onTeacherSubmit)}>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">아이디</Label>
                    <Input id="username" placeholder="아이디" {...teacherForm.register('username')} />
                    {teacherForm.formState.errors.username && <p className="text-sm text-destructive">{teacherForm.formState.errors.username.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pin-teacher">PIN 번호</Label>
                    <Input id="pin-teacher" type="password" maxLength={4} placeholder="4자리 숫자" {...teacherForm.register('pin')} className="text-lg"/>
                    {teacherForm.formState.errors.pin && <p className="text-sm text-destructive">{teacherForm.formState.errors.pin.message}</p>}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full font-bold" disabled={combinedLoading}>
                    {combinedLoading ? <Loader2 className="animate-spin" /> : <LogIn />}
                    로그인
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
          <div className="px-6 pb-6 text-center text-xs text-muted-foreground">
            <div className="border-t pt-4 mt-2">
              <p>
                본 서비스는 <strong className="text-primary font-semibold">풍천풍서초등학교 학생들</strong>의 <strong className="text-primary font-semibold">꿈</strong>과 <strong className="text-primary font-semibold">도전</strong>을<br />응원하기 위해 제작되었습니다.
              </p>
              <p className="mt-2 text-foreground/50">
                  © 2025 Pungcheon Pungseo Elementary School.<br/>All Rights Reserved.
              </p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
