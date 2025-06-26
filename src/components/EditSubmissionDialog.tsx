
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { useAuth } from '@/context/AuthContext';
import { updateSubmissionEvidence } from '@/ai/flows/update-submission-evidence';

const formSchema = z.object({
  evidence: z.string().min(10, '활동 내용은 최소 10자 이상이어야 합니다.').max(1000, '활동 내용은 1000자를 넘을 수 없습니다.'),
});

type FormValues = z.infer<typeof formSchema>;

interface SubmissionForEdit {
    id: string;
    evidence: string;
}

interface EditSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: SubmissionForEdit | null;
  onSubmissionUpdated: (updatedSubmission: {id: string, evidence: string}) => void;
}

export function EditSubmissionDialog({ open, onOpenChange, submission, onSubmissionUpdated }: EditSubmissionDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      evidence: '',
    },
  });

  useEffect(() => {
    if (submission) {
      form.reset({ evidence: submission.evidence });
    }
  }, [submission, form, open]);
  
  const onSubmit = async (data: FormValues) => {
    if (!submission || !user) return;
    setLoading(true);
    
    try {
        await updateSubmissionEvidence({
            submissionId: submission.id,
            newEvidence: data.evidence,
            teacherId: String(user.id),
        });
        toast({ title: '성공', description: '게시글이 수정되었습니다.' });
        onSubmissionUpdated({ id: submission.id, evidence: data.evidence });
        onOpenChange(false);
    } catch (error: any) {
         toast({ variant: 'destructive', title: '오류', description: error.message || '저장에 실패했습니다.' });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>게시글 내용 수정</DialogTitle>
          <DialogDescription>
            학생의 활동 내용을 수정합니다. 오탈자나 부적절한 내용을 바로잡을 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <FormField
                  control={form.control}
                  name="evidence"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel className="sr-only">활동 내용</FormLabel>
                          <FormControl>
                              <Textarea {...field} rows={8} />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )}
              />
                
              <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">취소</Button></DialogClose>
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
