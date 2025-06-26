"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth, User } from '@/context/AuthContext';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';

const editStudentSchema = z.object({
  grade: z.string().min(1, { message: '학년을 선택해주세요.' }),
  classNum: z.coerce.number().min(1, { message: '반을 입력해주세요.' }),
  studentNum: z.coerce.number().min(1, { message: '번호를 입력해주세요.' }),
  name: z.string().min(2, { message: '이름은 2글자 이상이어야 합니다.' }),
});

type EditStudentFormValues = z.infer<typeof editStudentSchema>;

interface EditStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: User | null;
}

export function EditStudentDialog({ open, onOpenChange, student }: EditStudentDialogProps) {
  const { updateUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<EditStudentFormValues>({
    resolver: zodResolver(editStudentSchema),
  });

  useEffect(() => {
    if (student) {
      form.reset({
        grade: String(student.grade || ''),
        classNum: student.classNum,
        studentNum: student.studentNum,
        name: student.name,
      });
    }
  }, [student, open, form]);

  const onSubmit = async (data: EditStudentFormValues) => {
    if (!student) return;

    setLoading(true);
    const result = await updateUser(student.id, {
        ...data,
        grade: parseInt(data.grade, 10),
    });

    if (result.success) {
      toast({ title: '성공', description: result.message });
      onOpenChange(false);
    } else {
      toast({ variant: 'destructive', title: '오류', description: result.message });
    }
    setLoading(false);
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
          <DialogTitle>학생 정보 수정</DialogTitle>
          <DialogDescription>{student?.name} 학생의 정보를 수정합니다. 변경 사항을 저장해주세요.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                    control={form.control}
                    name="grade"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>학년</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="학년 선택" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            <SelectItem value="4">4학년</SelectItem>
                            <SelectItem value="5">5학년</SelectItem>
                            <SelectItem value="6">6학년</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="classNum"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>반</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="예: 1" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || '')} />
                            </FormControl>
                             <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="studentNum"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>번호</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="예: 15" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || '')} />
                            </FormControl>
                             <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>이름</FormLabel>
                            <FormControl>
                                <Input placeholder="예: 홍길동" {...field} />
                            </FormControl>
                             <FormMessage />
                        </FormItem>
                    )}
                />
                <DialogFooter>
                    <Button type="submit" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>}
                        저장하기
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
