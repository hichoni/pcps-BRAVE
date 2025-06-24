"use client";

import { useState, useEffect } from 'react';
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
import { Loader2, KeyRound } from 'lucide-react';

const changePinSchema = z.object({
  newPin: z.string().length(4, { message: '새 PIN 번호는 4자리여야 합니다.' }),
  confirmPin: z.string().length(4, { message: 'PIN 번호 확인은 4자리여야 합니다.' }),
}).refine(data => data.newPin === data.confirmPin, {
  message: "PIN 번호가 일치하지 않습니다.",
  path: ["confirmPin"],
});

type ChangePinFormValues = z.infer<typeof changePinSchema>;

export default function ChangePinPage() {
  const router = useRouter();
  const { user, updatePin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePinFormValues>({
    resolver: zodResolver(changePinSchema),
  });

  useEffect(() => {
    if (!isClient || authLoading) return;
    if (!user) {
      router.push('/login');
    } else if (user.pin !== '0000') {
      router.push('/');
    }
  }, [authLoading, user, router, isClient]);

  const onSubmit = async (data: ChangePinFormValues) => {
    setLoading(true);
    try {
      await updatePin(data.newPin);
      toast({
        title: 'PIN 번호 변경 완료',
        description: '새로운 PIN 번호로 변경되었습니다.',
      });
      router.push('/');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: 'PIN 번호 변경에 실패했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };
  
  if (!isClient || authLoading || !user || user.pin !== '0000') {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-sm shadow-lg border">
        <CardHeader>
          <CardTitle className="font-headline text-xl sm:text-2xl">최초 PIN 번호 변경</CardTitle>
          <CardDescription>
            보안을 위해 초기 PIN 번호를 변경해주세요.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPin">새 PIN 번호</Label>
              <Input
                id="newPin"
                type="password"
                maxLength={4}
                {...register('newPin')}
                placeholder="4자리 숫자"
              />
              {errors.newPin && <p className="text-sm text-destructive">{errors.newPin.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPin">새 PIN 번호 확인</Label>
              <Input
                id="confirmPin"
                type="password"
                maxLength={4}
                {...register('confirmPin')}
                placeholder="4자리 숫자"
              />
              {errors.confirmPin && <p className="text-sm text-destructive">{errors.confirmPin.message}</p>}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full font-bold" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <KeyRound />}
              변경하기
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
