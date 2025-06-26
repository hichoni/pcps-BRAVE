"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { Loader2, ArrowLeft, User as UserIcon, Calendar as CalendarIcon, MailCheck, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { reviewSubmission } from '@/ai/flows/review-submission';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';

interface PendingSubmission {
  id: string;
  userId: string;
  userName: string;
  areaName: string;
  koreanName: string;
  challengeName: string;
  evidence: string;
  createdAt: Date;
  mediaUrl?: string;
  mediaType?: string;
}

function ReviewCard({ submission, onReviewed }: { submission: PendingSubmission; onReviewed: (id: string) => void; }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const { challengeConfig } = useChallengeConfig();
    const [isProcessing, setIsProcessing] = useState(false);
    const AreaIcon = challengeConfig?.[submission.areaName]?.icon || UserIcon;

    const handleReview = async (isApproved: boolean) => {
        if (!user) return;
        setIsProcessing(true);
        try {
            await reviewSubmission({ submissionId: submission.id, isApproved, teacherId: String(user.id) });
            toast({ title: '처리 완료', description: `활동이 ${isApproved ? '승인' : '반려'}되었습니다.` });
            onReviewed(submission.id);
        } catch (error: any) {
            toast({ variant: 'destructive', title: '처리 오류', description: error.message });
            setIsProcessing(false);
        }
    };
    
    return (
        <Card className="flex flex-col h-full shadow-md border">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
                <div className="flex-grow">
                    <CardTitle className="text-base font-bold">{submission.userName} 학생</CardTitle>
                    <CardDescription className="flex items-center gap-1 text-xs pt-1">
                        <CalendarIcon className="w-3 h-3"/>
                        {submission.createdAt ? formatDistanceToNow(submission.createdAt, { addSuffix: true, locale: ko }) : '방금 전'}
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                <div className="p-3 bg-secondary/50 rounded-md">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <AreaIcon className="w-4 h-4" />
                        <span>{submission.koreanName} - {submission.challengeName}</span>
                    </div>
                </div>
                {submission.mediaUrl && submission.mediaType && (
                    <div className="my-2 rounded-lg border overflow-hidden">
                        {submission.mediaType.startsWith('image/') && (
                            <Image 
                                src={submission.mediaUrl}
                                alt={`${submission.koreanName} 활동 증명`}
                                width={400}
                                height={300}
                                className="w-full h-auto object-cover aspect-video"
                            />
                        )}
                        {submission.mediaType.startsWith('video/') && (
                            <video 
                                src={submission.mediaUrl}
                                controls
                                className="w-full aspect-video"
                            />
                        )}
                    </div>
                )}
                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed bg-background p-3 rounded-md border">
                    {submission.evidence}
                </p>
            </CardContent>
            <CardFooter className="flex justify-end items-center p-4 pt-0 gap-2">
                <Button variant="destructive" onClick={() => handleReview(false)} disabled={isProcessing}>
                    <ThumbsDown className="mr-2"/> 반려
                </Button>
                <Button onClick={() => handleReview(true)} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="animate-spin"/> : <><ThumbsUp className="mr-2"/> 승인</>}
                </Button>
            </CardFooter>
        </Card>
    )
}


export default function ReviewPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'teacher')) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!db || !user || user.role !== 'teacher') return;

        setIsLoading(true);
        const q = query(
            collection(db, "challengeSubmissions"),
            where("status", "==", "pending_review"),
            orderBy("createdAt", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedSubmissions = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
                } as PendingSubmission;
            });
            setSubmissions(fetchedSubmissions);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching pending submissions: ", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user]);
    
    const handleSubmissionReviewed = (id: string) => {
        setSubmissions(prev => prev.filter(sub => sub.id !== id));
    };

    if (authLoading || isLoading) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b">
                <h1 className="text-2xl sm:text-3xl font-bold font-headline text-primary flex items-center gap-2">
                    <MailCheck /> 도전 활동 검토
                </h1>
                <Button variant="outline" onClick={() => router.push('/admin')} className="self-end sm:self-auto">
                    <ArrowLeft className="mr-2"/> 학생 관리로
                </Button>
            </header>
            
            {submissions.length === 0 ? (
                <div className="text-center py-20">
                    <p className="text-lg font-semibold text-muted-foreground">검토할 활동이 없습니다!</p>
                    <p className="text-sm text-muted-foreground">모든 제출물을 확인하셨습니다. 훌륭해요!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {submissions.map(sub => (
                        <ReviewCard key={sub.id} submission={sub} onReviewed={handleSubmissionReviewed} />
                    ))}
                </div>
            )}
        </div>
    );
}
