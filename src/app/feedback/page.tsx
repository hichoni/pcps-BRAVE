
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { submitFeedback } from '@/ai/flows/submit-feedback';
import { Feedback, FeedbackStatus, FeedbackType, FEEDBACK_TYPES } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Bug, Lightbulb, MessageSquare, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

const feedbackFormSchema = z.object({
  type: z.enum(FEEDBACK_TYPES, { required_error: '유형을 선택해주세요.' }),
  content: z.string().min(10, { message: '최소 10자 이상 입력해주세요.' }).max(2000, { message: '최대 2000자까지 입력할 수 있습니다.' }),
});

type FeedbackFormValues = z.infer<typeof feedbackFormSchema>;

const TYPE_CONFIG: Record<FeedbackType, { label: string; icon: React.FC<any> }> = {
  bug: { label: '오류 신고', icon: Bug },
  suggestion: { label: '개선 제안', icon: Lightbulb },
  etc: { label: '기타 문의', icon: MessageSquare },
};

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: '접수됨', variant: 'destructive' },
  viewed: { label: '확인 중', variant: 'default' },
  resolved: { label: '답변/처리 완료', variant: 'secondary' },
};

function FeedbackCard({ feedback }: { feedback: Feedback }) {
  const TypeIcon = TYPE_CONFIG[feedback.type].icon;
  const statusInfo = STATUS_CONFIG[feedback.status];

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg flex items-center gap-2">
            <TypeIcon className="w-5 h-5" />
            {TYPE_CONFIG[feedback.type].label}
          </CardTitle>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>
        <CardDescription>
          {formatDistanceToNow(feedback.createdAt, { addSuffix: true, locale: ko })} by {feedback.userName} ({feedback.userRole === 'student' ? '학생' : '교사'})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm text-foreground/90">{feedback.content}</p>
      </CardContent>
    </Card>
  );
}

export default function FeedbackPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!db || !user) return;

    setIsLoading(true);
    let q;
    const feedbackCollection = collection(db, "feedback");

    if (user.role === 'teacher') {
      // Teachers see all feedback, newest first.
      q = query(feedbackCollection, orderBy("createdAt", "desc"));
    } else {
      // Students only see their own feedback.
      q = query(feedbackCollection, where("userId", "==", user.username), orderBy("createdAt", "desc"));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedFeedback = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
        } as Feedback;
      });
      setFeedbackList(fetchedFeedback);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching feedback:", error);
      toast({ variant: 'destructive', title: '오류', description: '피드백 목록을 불러오는 데 실패했습니다.' });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  const onSubmit = async (data: FeedbackFormValues) => {
    if (!user) return;

    try {
      await submitFeedback({
        userId: user.username,
        userName: user.name,
        userRole: user.role,
        type: data.type,
        content: data.content,
      });
      toast({ title: '제출 완료', description: '소중한 의견 감사합니다. 검토 후 반영하도록 하겠습니다.' });
      form.reset();
    } catch (error: any) {
      toast({ variant: 'destructive', title: '제출 오류', description: error.message });
    }
  };
  
  if (authLoading || !user) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b">
        <h1 className="text-2xl sm:text-3xl font-bold font-headline text-primary flex items-center gap-3">
            <Bug className="h-8 w-8"/> 오류 신고 / 건의하기
        </h1>
        <Button asChild variant="outline" className="self-end sm:self-auto">
            <Link href={user.role === 'teacher' ? '/admin' : '/dashboard'}>
                <ArrowLeft className="mr-2"/> {user.role === 'teacher' ? '관리자 페이지로' : '대시보드로'}
            </Link>
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardHeader>
                  <CardTitle>새로운 의견 남기기</CardTitle>
                  <CardDescription>앱 사용 중 발견한 오류나 개선 아이디어를 알려주세요.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>유형 선택</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            {FEEDBACK_TYPES.map(type => (
                              <FormItem key={type} className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value={type} />
                                </FormControl>
                                <FormLabel className="font-normal flex items-center gap-2">
                                  {React.createElement(TYPE_CONFIG[type].icon, {className: "w-4 h-4"})}
                                  {TYPE_CONFIG[type].label}
                                </FormLabel>
                              </FormItem>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>상세 내용</FormLabel>
                        <FormControl>
                          <Textarea placeholder="어떤 상황에서 문제가 발생했는지, 또는 어떤 기능이 추가되면 좋을지 최대한 자세히 적어주세요." rows={6} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Send className="mr-2"/>}
                    제출하기
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </div>
        
        <div className="lg:col-span-2">
            <h2 className="text-xl font-bold mb-4">{user.role === 'teacher' ? '전체 접수 내역' : '내가 남긴 의견'}</h2>
            {isLoading ? (
                 <div className="flex h-64 w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : feedbackList.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <p className="font-semibold">접수된 내용이 없습니다.</p>
                    {user.role === 'student' && <p className="text-sm mt-1">왼쪽에서 새로운 의견을 남겨보세요.</p>}
                </div>
            ) : (
                <div className="space-y-4">
                    {feedbackList.map(item => <FeedbackCard key={item.id} feedback={item} />)}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
