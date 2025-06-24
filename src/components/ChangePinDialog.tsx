"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';

const changePinSchema = z.object({
  newPin: z.string().length(4, { message: '새 PIN 번호는 4자리여야 합니다.' }),
  confirmPin: z.string().length(4, { message: 'PIN 번호 확인은 4자리여야 합니다.' }),
}).refine(data => data.newPin === data.confirmPin, {
  message: "PIN 번호가 일치하지 않습니다.",
  path: ["confirmPin"],
});

type ChangePinFormValues = z.infer<typeof changePinSchema>;

interface ChangePinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePinDialog({ open, onOpenChange }: ChangePinDialogProps) {
  const { updatePin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<ChangePinFormValues>({
    resolver: zodResolver(changePinSchema),
    defaultValues: {
      newPin: '',
      confirmPin: '',
    },
  });

  const onSubmit = async (data: ChangePinFormValues) => {
    setLoading(true);
    try {
      await updatePin(data.newPin);
      toast({
        title: 'PIN 번호 변경 완료',
        description: '새로운 PIN 번호로 변경되었습니다. 이제 안심하고 사용하세요!',
      });
      onOpenChange(false);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'PIN 번호 변경 중 알 수 없는 오류가 발생했습니다.';
        toast({
            variant: 'destructive',
            title: '오류',
            description: errorMessage,
        });
    } finally {
      setLoading(false);
    }
  };
  
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
        form.reset();
    }
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>PIN 번호 변경</DialogTitle>
          <DialogDescription>
            보안을 위해 초기 PIN 번호(0000)를 새로운 번호로 변경해주세요.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                    control={form.control}
                    name="newPin"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>새 PIN 번호</FormLabel>
                            <FormControl>
                                <Input type="password" maxLength={4} placeholder="4자리 숫자" {...field} />
                            </FormControl>
                             <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="confirmPin"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>새 PIN 번호 확인</FormLabel>
                            <FormControl>
                                <Input type="password" maxLength={4} placeholder="4자리 숫자" {...field} />
                            </FormControl>
                             <FormMessage />
                        </FormItem>
                    )}
                />
                <DialogFooter>
                    <Button type="submit" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin mr-2"/> : <KeyRound className="mr-2"/>}
                        변경하기
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
