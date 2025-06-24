"use client";

import { useState } from 'react';
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
import { Loader2, LogIn } from 'lucide-react';
import Image from 'next/image';

const loginSchema = z.object({
  username: z.string().min(1, { message: '아이디를 입력해주세요.' }),
  pin: z.string().length(4, { message: 'PIN 번호는 4자리여야 합니다.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    try {
      const loggedInUser = await login(data.username, data.pin);
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
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '로그인 실패',
        description: '아이디 또는 PIN 번호가 올바르지 않습니다.',
      });
    } finally {
      setLoading(false);
    }
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
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">아이디</Label>
              <Input
                id="username"
                placeholder="아이디"
                {...register('username')}
              />
              {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">PIN 번호</Label>
              <Input
                id="pin"
                type="password"
                maxLength={4}
                placeholder="4자리 숫자"
                {...register('pin')}
              />
              {errors.pin && <p className="text-sm text-destructive">{errors.pin.message}</p>}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full font-bold" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
              로그인
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
