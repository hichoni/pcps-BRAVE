
"use client";

import React, { useState, useEffect, useCallback, useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from './ui/form';
import { useAuth } from '@/context/AuthContext';
import { AreaName, SubmissionStatus } from '@/lib/config';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { ListChecks, Send, Loader2, UploadCloud, ThumbsUp, ThumbsDown, BrainCircuit, FileCheck, FileX, History, Trash2, Info, ShieldAlert } from 'lucide-react';
import { submitEvidence } from '@/ai/flows/submit-evidence';
import { checkCertification } from '@/ai/flows/certification-checker';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Input } from './ui/input';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { Separator } from './ui/separator';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { deleteSubmission } from '@/ai/flows/delete-submission';
import { uploadFile } from '@/services/client-storage';

interface Submission {
  id: string;
  evidence: string;
  createdAt: Date;
  status: SubmissionStatus;
}

const evidenceSchema = z.object({
  evidence: z.string().min(1, { message: '간단한 활동 내용을 입력해주세요.' }).max(1000, { message: '1000자 이내로 입력해주세요.'}),
});

type EvidenceFormValues = z.infer<typeof evidenceSchema>;

const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;


const StatusInfo = {
    approved: { icon: FileCheck, text: '승인됨', color: 'text-green-600' },
    pending_review: { icon: History, text: '검토 중', color: 'text-yellow-600' },
    rejected: { icon: FileX, text: '반려됨', color: 'text-red-600' },
    pending_deletion: { icon: Trash2, text: '삭제 요청 중', color: 'text-orange-500' },
}

export function AchievementStatusDialog({ areaName }: { areaName: AreaName }) {
  const { user } = useAuth();
  const { challengeConfig } = useChallengeConfig();
  const { toast } = useToast();
  
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{ isSufficient: boolean; reasoning: string } | null>(null);
  const [submissionToDelete, setSubmissionToDelete] = useState<Submission | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<EvidenceFormValues>({
    resolver: zodResolver(evidenceSchema),
    defaultValues: { evidence: '' },
  });

  const evidenceValue = form.watch('evidence');

  useEffect(() => {
    if (!user || !dialogOpen || !db) return;

    setSubmissionsLoading(true);
    const q = query(
        collection(db, "challengeSubmissions"),
        where("userId", "==", user.username),
        where("areaName", "==", areaName)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetchedSubmissions = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                evidence: data.evidence,
                createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
                status: data.status,
            } as Submission;
        });
        fetchedSubmissions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setSubmissions(fetchedSubmissions);
        setSubmissionsLoading(false);
    }, (error) => {
        console.error("Error fetching submissions for dialog:", error);
        toast({
            variant: "destructive",
            title: "오류",
            description: "활동 목록을 불러오는 데 실패했습니다."
        });
        setSubmissionsLoading(false);
    });

    return () => unsubscribe();
  }, [dialogOpen, user, areaName, toast]);


  if (!user || !challengeConfig || user.grade === undefined) return null;
  
  const areaConfig = challengeConfig[areaName];

  if (!areaConfig) return null;
  
  const { koreanName, challengeName } = areaConfig;

  useEffect(() => {
    if (areaName === 'Information') {
        setAiFeedback(null);
        setIsChecking(false);
        return;
    }
      
    if (evidenceValue.trim().length < 10) {
      setAiFeedback(null);
      return;
    }

    setIsChecking(true);
    setAiFeedback(null);

    const handler = setTimeout(async () => {
      if (!areaConfig) return;
      try {
        const result = await checkCertification({
          areaName: koreanName,
          requirements: areaConfig.requirements,
          evidence: evidenceValue,
        });
        setAiFeedback(result);
      } catch (error) {
        console.error("Real-time AI check failed:", error);
      } finally {
        setIsChecking(false);
      }
    }, 1500);

    return () => {
      clearTimeout(handler);
    };
  }, [evidenceValue, areaName, koreanName, areaConfig, toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
        const file = event.target.files?.[0];
        if (!file) {
            setFileName(null);
            return;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            toast({
                variant: 'destructive',
                title: '파일 크기 초과',
                description: `파일 크기는 ${MAX_FILE_SIZE_MB}MB를 넘을 수 없습니다.`,
            });
            event.target.value = '';
            setFileName(null);
            return;
        }
        setFileName(file.name);
    } catch (error) {
        console.error("File selection error:", error);
        toast({
            variant: 'destructive',
            title: '파일 선택 오류',
            description: '파일을 선택하는 중 문제가 발생했습니다. 다른 파일을 선택해보세요.'
        });
    }
  };

  const handleFormSubmit = async (data: EvidenceFormValues) => {
    if (!user || !user.name) return;

    const mediaFile = fileInputRef.current?.files?.[0];

    if (areaConfig.mediaRequired && !mediaFile) {
        toast({
            variant: 'destructive',
            title: '파일 누락',
            description: '이 영역은 사진이나 영상 제출이 필수입니다.',
        });
        return;
    }

    setIsSubmitting(true);
    try {
      let mediaUrl: string | undefined = undefined;
      let mediaType: string | undefined = undefined;

      if (mediaFile) {
        mediaUrl = await uploadFile(mediaFile, user.username);
        mediaType = mediaFile.type;
      }
      
      const result = await submitEvidence({
        userId: user.username,
        userName: user.name,
        areaName: areaName,
        koreanName: areaConfig.koreanName,
        challengeName: areaConfig.challengeName,
        evidence: data.evidence || '미디어 파일 제출',
        mediaUrl: mediaUrl,
        mediaType: mediaType,
      });
      
      toast({
        title: result.status === 'approved' ? '제출 및 자동 승인 완료!' : '제출 완료!',
        description: (
            <div>
                <p className="font-semibold">{result.updateMessage}</p>
                <p className="text-xs mt-2 text-muted-foreground">AI 판단 근거: {result.aiReasoning}</p>
            </div>
        ),
        duration: 9000,
      });

      form.reset();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setFileName(null);
    } catch (error: unknown) {
      console.error('Evidence Submission Error:', error);
      let errorMessage = '알 수 없는 오류가 발생했습니다.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        variant: 'destructive',
        title: '제출 오류',
        description: errorMessage,
        duration: 9000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const onDialogClose = (isOpen: boolean) => {
      if (!isOpen) {
          form.reset();
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          setFileName(null);
          setAiFeedback(null);
      }
      setDialogOpen(isOpen);
  }

  const handleDeleteRequest = async () => {
    if (!submissionToDelete || !user) return;

    setIsDeleting(true);
    try {
        const result = await deleteSubmission({
            submissionId: submissionToDelete.id,
            userId: String(user.id),
        });

        toast({
            title: "요청 완료",
            description: result.message
        });
        setSubmissionToDelete(null);
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "삭제 요청 오류",
            description: error.message || '삭제 요청에 실패했습니다.'
        });
    } finally {
        setIsDeleting(false);
    }
  };

  return (
    <AlertDialog onOpenChange={(open) => { if (!open && submissionToDelete) setSubmissionToDelete(null); }}>
      <Dialog open={dialogOpen} onOpenChange={onDialogClose}>
        <DialogTrigger asChild>
          <Button variant="outline" className="flex-grow font-bold">
            <ListChecks className="mr-2 h-4 w-4" /> 도전하기
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b shrink-0">
            <DialogTitle className="font-headline text-2xl">{koreanName} 활동 현황</DialogTitle>
            <DialogDescription>
              {challengeName} - 이제까지의 활동 내역을 확인하고, 새로운 활동을 공유해보세요.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 min-h-0">
            <Form {...form}>
              <form id={formId} onSubmit={form.handleSubmit(handleFormSubmit)} className="py-4 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-2">내 활동 목록</h3>
                  <div className="w-full rounded-md border p-2 space-y-2 min-h-[5rem] max-h-48 overflow-y-auto">
                    {submissionsLoading ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin"/>
                      </div>
                    ) : submissions.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        아직 제출한 활동이 없습니다.
                      </div>
                    ) : (
                      submissions.map(sub => {
                        const status = StatusInfo[sub.status];
                        if (!status) return null;
                        const Icon = status.icon;
                        const isPending = sub.status === 'pending_review' || sub.status === 'pending_deletion';
                        return (
                          <div key={sub.id} className={cn(
                            "text-sm p-2 rounded-md flex justify-between items-center group transition-colors",
                            sub.status === 'pending_deletion' ? 'bg-orange-500/10 border border-orange-500/20 opacity-80' : 'bg-secondary/50'
                          )}>
                            <div className="flex-grow min-w-0">
                                <div className="flex justify-between items-start">
                                    <p className="text-muted-foreground truncate pr-4 flex-grow">{sub.evidence}</p>
                                    <div className={cn("flex items-center gap-1 font-semibold text-xs shrink-0", status.color)}>
                                        <Icon className="h-3.5 w-3.5"/>
                                        <span>{status.text}</span>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground/70 mt-1">{format(sub.createdAt, "yyyy.MM.dd HH:mm", { locale: ko })}</p>
                            </div>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" onClick={() => setSubmissionToDelete(sub)} disabled={isPending}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                <Separator />
                
                <div>
                  <h3 className="text-sm font-semibold mb-2">새 활동 공유하기</h3>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="evidence"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">활동 내용</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={
                                areaName === 'Information'
                                ? "타자 연습 날짜나 간단한 메모를 남겨주세요."
                                : "여기에 나의 실천 내용을 자세히 적어주세요. (예: 어떤 책을 읽고 무엇을 느꼈는지, 봉사활동을 통해 무엇을 배우고 실천했는지 등)"
                              }
                              {...field}
                              rows={areaName === 'Information' ? 2 : 3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {areaName !== 'Information' && (
                      <div className="flex items-center justify-center min-h-[4rem]">
                        {isChecking && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse p-2">
                            <BrainCircuit className="h-4 w-4" />
                            <span>AI가 실시간으로 내용을 분석하고 있습니다...</span>
                          </div>
                        )}
                        {!isChecking && aiFeedback && (
                          <Alert variant={aiFeedback.isSufficient ? "default" : "destructive"} className="p-2 w-full">
                            {aiFeedback.isSufficient ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
                            <AlertTitle className="text-xs font-semibold mb-0.5">
                              {aiFeedback.isSufficient ? "AI 피드백: 좋은 내용입니다!" : "AI 피드백: 기준에 조금 부족해요."}
                            </AlertTitle>
                            <AlertDescription className="text-xs">
                              {aiFeedback.reasoning}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                    
                    <div>
                      <FormLabel htmlFor="media-file-input" className="text-xs">
                        {areaName === 'Information' ? '타자 연습 결과 스크린샷' : '증명 파일 (사진/영상)'}
                        {areaConfig.mediaRequired && <span className="text-destructive ml-1">*필수</span>}
                      </FormLabel>
                      <Input
                        id="media-file-input"
                        ref={fileInputRef}
                        type="file"
                        accept={areaName === 'Information' ? "image/*" : "image/*,video/*"}
                        onChange={handleFileChange}
                        className="file:text-primary file:font-semibold text-xs h-9 mt-1"
                        disabled={isSubmitting}
                      />
                      <FormDescription className="text-xs mt-1">
                        {MAX_FILE_SIZE_MB}MB 이하의 파일을 올려주세요.
                      </FormDescription>
                    </div>

                    {fileName && (
                      <div className="text-sm p-3 bg-secondary rounded-md text-secondary-foreground flex items-center gap-2">
                         <FileCheck className="h-4 w-4 text-primary" />
                         <span className="font-medium">{fileName}</span>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </Form>
          </div>
          
          <DialogFooter className="p-6 pt-4 border-t shrink-0 flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-2">
              <DialogClose asChild>
                  <Button type="button" variant="secondary" className="w-full sm:w-auto order-last sm:order-first">
                      닫기
                  </Button>
              </DialogClose>
              <Button type="submit" form={formId} className="w-full sm:w-auto" disabled={isSubmitting || isChecking}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <Send className="mr-2"/>}
                  {isSubmitting ? '제출 중...' : '제출하기'}
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialogContent>
        <AlertDialogHeader>
            <AlertDialogTitle>정말로 삭제를 요청하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
                이 활동 기록의 삭제를 요청합니다. 요청이 선생님의 승인을 받으면, 이 기록과 관련 진행도는 영구적으로 삭제되며 되돌릴 수 없습니다.
            </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRequest} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : '삭제 요청'}
            </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
