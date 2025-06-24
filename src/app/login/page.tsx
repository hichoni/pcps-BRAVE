"use client";

import { useEffect, useState } from 'react';
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
import { Loader2, LogIn, User as UserIcon, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User } from '@/lib/config';

const studentLoginSchema = z.object({
  grade: z.string().min(1, { message: '학년을 선택해주세요.' }),
  classNum: z.string().min(1, { message: '반을 입력해주세요.' }),
  studentNum: z.string().min(1, { message: '번호를 입력해주세요.' }),
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
    return `${name.charAt(0)}${'@'.repeat(name.length - 2)}${name.charAt(name.length - 1)}`;
  }
  if (name.length === 2) {
    return `${name.charAt(0)}@`;
  }
  return name;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, users } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [foundStudent, setFoundStudent] = useState<User | null>(null);

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

  useEffect(() => {
    if (watchedGrade && watchedClassNum && watchedStudentNum) {
      const grade = parseInt(watchedGrade, 10);
      const classNum = parseInt(watchedClassNum, 10);
      const studentNum = parseInt(watchedStudentNum, 10);
      if (!isNaN(grade) && !isNaN(classNum) && !isNaN(studentNum)) {
        const student = users.find(u =>
          u.role === 'student' &&
          u.grade === grade &&
          u.classNum === classNum &&
          u.studentNum === studentNum
        );
        setFoundStudent(student || null);
      } else {
        setFoundStudent(null);
      }
    } else {
      setFoundStudent(null);
    }
  }, [watchedGrade, watchedClassNum, watchedStudentNum, users]);

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
      } else if (loggedInUser.pin === '0000') {
        router.push('/change-pin');
      } else {
        router.push('/');
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center">
          <Image
            src="/icon-main.png"
            alt="풍천풍서초등학교 로고"
            width={80}
            height={80}
            className="mx-auto rounded-full shadow-md mb-4"
          />
          <CardTitle className="font-headline text-2xl">학교장 인증제 로그인</CardTitle>
          <CardDescription>계정 정보를 입력해주세요.</CardDescription>
        </CardHeader>
        <Tabs defaultValue="student" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="student"><UserIcon className="mr-2"/> 학생</TabsTrigger>
            <TabsTrigger value="teacher"><ShieldCheck className="mr-2"/> 교사</TabsTrigger>
          </TabsList>
          <TabsContent value="student">
            <form onSubmit={studentForm.handleSubmit(onStudentSubmit)}>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="grade">학년</Label>
                    <Select onValueChange={(value) => studentForm.setValue('grade', value)} defaultValue={studentForm.getValues('grade')}>
                       <SelectTrigger id="grade">
                         <SelectValue placeholder="학년"/>
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="4">4학년</SelectItem>
                         <SelectItem value="5">5학년</SelectItem>
                         <SelectItem value="6">6학년</SelectItem>
                       </SelectContent>
                    </Select>
                  </div>
                   <div className="space-y-2">
                     <Label htmlFor="classNum">반</Label>
                     <Input id="classNum" type="number" placeholder="반" {...studentForm.register('classNum')} />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="studentNum">번호</Label>
                     <Input id="studentNum" type="number" placeholder="번호" {...studentForm.register('studentNum')} />
                   </div>
                </div>
                 {studentForm.formState.errors.grade && <p className="text-sm text-destructive">{studentForm.formState.errors.grade.message}</p>}
                 {studentForm.formState.errors.classNum && <p className="text-sm text-destructive">{studentForm.formState.errors.classNum.message}</p>}
                 {studentForm.formState.errors.studentNum && <p className="text-sm text-destructive">{studentForm.formState.errors.studentNum.message}</p>}
                
                {foundStudent && (
                    <div className="p-3 bg-secondary rounded-md text-center text-secondary-foreground font-semibold">
                        {maskName(foundStudent.name)}
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
                  />
                  {studentForm.formState.errors.pin && <p className="text-sm text-destructive">{studentForm.formState.errors.pin.message}</p>}
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full font-bold" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
                  로그인
                </Button>
              </CardFooter>
            </form>
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
                  <Input id="pin-teacher" type="password" maxLength={4} placeholder="4자리 숫자" {...teacherForm.register('pin')} />
                  {teacherForm.formState.errors.pin && <p className="text-sm text-destructive">{teacherForm.formState.errors.pin.message}</p>}
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full font-bold" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
                  로그인
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
