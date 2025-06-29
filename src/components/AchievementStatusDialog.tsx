
"use client";

import React, { useState, useEffect, useCallback, useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from './ui/form';
import { useAuth } from '@/context/AuthContext';
import { AreaName, SubmissionStatus } from '@/lib/config';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { Send, Loader2, UploadCloud, FileCheck, FileX, History, Trash2, Info, BrainCircuit } from 'lucide-react';
import { submitEvidence } from '@/ai/flows/submit-evidence';
import { getTextFeedback } from '@/ai/flows/text-feedback';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Input } from './ui/input';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy, limit, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { deleteSubmission } from '@/ai/flows/delete-submission';
import { uploadFile } from '@/services/client-storage';
import { resizeImage } from '@/lib/image-utils';

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

const MAX_IMAGE_SIZE_MB = 10;
const MAX_VIDEO_SIZE_MB = 100;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;


const StatusInfo = {
    approved: { icon: FileCheck, text: '승인됨', color: 'text-green-600' },
    pending_review: { icon: History, text: '검토 중', color: 'text-yellow-600' },
    rejected: { icon: FileX, text: '반려됨', color: 'text-red-600' },
    pending_deletion: { icon: Trash2, text: '삭제 요청 중', color: 'text-orange-500' },
}

interface AchievementStatusDialogProps {
  areaName: AreaName;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode: 'history' | 'submit';
}

export function AchievementStatusDialog({ areaName, open, onOpenChange, initialMode }: AchievementStatusDialogProps) {
  const { user } = useAuth();
  const { challengeConfig } = useChallengeConfig();
  const { toast } = useToast();

  const areaConfig = challengeConfig?.[areaName];
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [showLengthWarning, setShowLengthWarning] = useState(false);
  const [submissionToDelete, setSubmissionToDelete] = useState<Submission | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [intervalLock, setIntervalLock] = useState({ locked: false, minutesToWait: 0 });
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<EvidenceFormValues>({
    resolver: zodResolver(evidenceSchema),
    defaultValues: { evidence: '' },
  });

  const evidenceValue = form.watch('evidence');

  // This single effect handles data fetching and checks when the dialog opens.
  useEffect(() => {
    // If the dialog is not open, or we don't have the necessary info, do nothing.
    if (!user || !open || !db || !areaConfig) {
        // Reset loading state if dialog is closed
        if (!open) {
          setSubmissionsLoading(true);
          setIntervalLock({ locked: false, minutesToWait: 0 });
        }
        return;
    }

    let unsubscribe: (() => void) | undefined;

    const fetchHistory = () => {
        setSubmissionsLoading(true);
        // Firestore does not allow orderBy on a different field than the range filter.
        // We fetch all relevant documents and sort them client-side.
        const q = query(
          collection(db, "challengeSubmissions"),
          where("userId", "==", user.username),
          where("areaName", "==", areaName)
        );
        
        unsubscribe = onSnapshot(q, (snapshot) => {
          const fetchedSubmissions = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
            } as Submission;
          });
          // Sort client-side
          fetchedSubmissions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

          setSubmissions(fetchedSubmissions);
          setSubmissionsLoading(false);
        }, (error) => {
            console.error("Error fetching submission history:", error);
            toast({
                variant: "destructive",
                title: "오류",
                description: "활동 목록을 불러오는 데 실패했습니다. 다시 시도해주세요."
            });
            setSubmissionsLoading(false);
        });
    }

    const checkInterval = () => {
        if (areaConfig.submissionIntervalMinutes && areaConfig.submissionIntervalMinutes > 0) {
            const submissionsQuery = query(
                collection(db, "challengeSubmissions"),
                where("userId", "==", user.username),
                where("areaName", "==", areaName),
                where("status", "in", ['approved', 'pending_review', 'pending_deletion'])
            );

            getDocs(submissionsQuery).then(querySnapshot => {
                if (!querySnapshot.empty) {
                    const sortedDocs = querySnapshot.docs.sort((a, b) => {
                        const timeA = (a.data().createdAt as Timestamp)?.toMillis() || 0;
                        const timeB = (b.data().createdAt as Timestamp)?.toMillis() || 0;
                        return timeB - timeA;
                    });
                    
                    const lastValidSubmission = sortedDocs[0].data();
                    if (lastValidSubmission && lastValidSubmission.createdAt) {
                        const lastSubmissionTime = (lastValidSubmission.createdAt as Timestamp).toDate();
                        const now = new Date();
                        const minutesSinceLastSubmission = (now.getTime() - lastSubmissionTime.getTime()) / (1000 * 60);
    
                        if (minutesSinceLastSubmission < areaConfig.submissionIntervalMinutes) {
                            const minutesToWait = Math.ceil(areaConfig.submissionIntervalMinutes - minutesSinceLastSubmission);
                            setIntervalLock({ locked: true, minutesToWait });
                        } else {
                             setIntervalLock({ locked: false, minutesToWait: 0 });
                        }
                    } else {
                        setIntervalLock({ locked: false, minutesToWait: 0 });
                    }
                } else {
                     setIntervalLock({ locked: false, minutesToWait: 0 });
                }
            }).catch(error => {
                console.error("Error checking submission interval:", error);
                setIntervalLock({ locked: false, minutesToWait: 0 });
                toast({
                  variant: "destructive",
                  title: "오류",
                  description: "활동 정보를 확인하는 데 실패했습니다. 인터넷 연결을 확인해주세요."
                });
            });
        }
    }

    if (initialMode === 'history') {
        fetchHistory();
    } else { // 'submit' mode
        setSubmissionsLoading(false); // No list to load in submit mode
        checkInterval();
    }

    return () => {
        if (unsubscribe) unsubscribe();
    };
  }, [open, user, areaName, toast, areaConfig, initialMode]);


  // Effect for AI real-time feedback
  useEffect(() => {
    // Exit if the dialog is closed, or not in submit mode, or config is missing
    if (!open || !areaConfig || initialMode !== 'submit') {
      return;
    }

    const text = evidenceValue.trim();

    // Debounce the API call
    const handler = setTimeout(async () => {
      // Don't run for very short text to save resources
      if (text.length < 10) {
        return;
      }
      setIsChecking(true);
      try {
        const result = await getTextFeedback({
          text: evidenceValue,
          requirements: areaConfig.requirements,
          hasMedia: !!fileName,
          mediaRequired: !!areaConfig.mediaRequired,
        });
        setAiFeedback(result?.feedback ?? null);
      } catch (error) {
        console.error("Real-time AI check failed:", error);
        setAiFeedback('AI 조언을 가져오는 데 실패했습니다.');
      } finally {
        setIsChecking(false);
      }
    }, 1500); // 1.5-second delay
    
    // Immediate feedback for short text length
    if (text.length === 0) {
      setAiFeedback(null);
      setShowLengthWarning(false);
    } else if (text.length < 10) {
      setAiFeedback("AI 조언을 받으려면 10글자 이상 입력해주세요.");
      setShowLengthWarning(true);
    } else {
      setShowLengthWarning(false);
    }

    return () => {
      clearTimeout(handler);
    };
  }, [evidenceValue, fileName, areaConfig, open, initialMode]);
  
  if (!user || !challengeConfig || user.grade === undefined || !areaConfig) return null;
  
  const { koreanName, challengeName } = areaConfig;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setFileName(null);
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    let limitBytes = 0;
    let limitMb = 0;
    let fileType = '';

    if (isImage) {
      limitBytes = MAX_IMAGE_SIZE_BYTES;
      limitMb = MAX_IMAGE_SIZE_MB;
      fileType = '사진';
    } else if (isVideo) {
      limitBytes = MAX_VIDEO_SIZE_BYTES;
      limitMb = MAX_VIDEO_SIZE_MB;
      fileType = '영상';
    } else {
      toast({
        variant: 'destructive',
        title: '지원하지 않는 파일 형식',
        description: '사진 또는 영상 파일만 업로드할 수 있습니다.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFileName(null);
      return;
    }

    if (file.size > limitBytes) {
      toast({
        variant: 'destructive',
        title: '파일 크기 초과',
        description: `${fileType} 파일 크기는 ${limitMb}MB를 넘을 수 없습니다.`,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFileName(null);
      return;
    }
    setFileName(file.name);
  };

  const handleFormSubmit = async (data: EvidenceFormValues) => {
    if (!user || !user.name) return;

    let fileToUpload = fileInputRef.current?.files?.[0];

    if (areaConfig.mediaRequired && !fileToUpload) {
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

      if (fileToUpload) {
        const isImage = fileToUpload.type.startsWith('image/');
        const isVideo = fileToUpload.type.startsWith('video/');

        if (isImage) {
          try {
            fileToUpload = await resizeImage(fileToUpload, 1024); // Max width 1024px
          } catch (resizeError) {
            console.error("Image resize failed, uploading original:", resizeError);
            toast({
              variant: 'default',
              title: '이미지 리사이징 실패',
              description: '원본 이미지로 업로드를 시도합니다.',
            });
          }
        }

        let limitBytes = 0;
        let limitMb = 0;
        let fileType = '';

        if (isImage) {
          limitBytes = MAX_IMAGE_SIZE_BYTES;
          limitMb = MAX_IMAGE_SIZE_MB;
          fileType = '사진';
        } else if (isVideo) {
          limitBytes = MAX_VIDEO_SIZE_BYTES;
          limitMb = MAX_VIDEO_SIZE_MB;
          fileType = '영상';
        }

        if (limitBytes > 0 && fileToUpload.size > limitBytes) {
          toast({
            variant: 'destructive',
            title: '파일 크기 초과',
            description: `처리 후 ${fileType} 파일 크기가 ${limitMb}MB를 초과하여 업로드할 수 없습니다.`,
          });
          setIsSubmitting(false);
          return;
        }

        mediaUrl = await uploadFile(fileToUpload, user.username);
        mediaType = fileToUpload.type;
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
      onOpenChange(false);
    } catch (error: unknown) {
      console.error('Evidence Submission Error:', error);
      let errorMessage = "알 수 없는 오류가 발생했습니다.";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      if (errorMessage.startsWith('제출 간격 제한:')) {
        toast({
          variant: 'default',
          title: '제출 간격 제한',
          description: errorMessage.replace('제출 간격 제한: ', ''),
          duration: 9000,
        });
      } else {
        toast({
          variant: 'destructive',
          title: '제출 오류',
          description: errorMessage,
          duration: 9000,
        });
      }
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
          setShowLengthWarning(false);
          setIntervalLock({ locked: false, minutesToWait: 0 });
      }
      onOpenChange(isOpen);
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

  const dialogTitle = initialMode === 'history' 
    ? `[${koreanName}] 활동 내역` 
    : `[${koreanName}] ${challengeName}`;

  return (
    <AlertDialog onOpenChange={(open) => { if (!open && submissionToDelete) setSubmissionToDelete(null); }}>
      <Dialog open={open} onOpenChange={onDialogClose}>
        <DialogContent className="sm:max-w-lg h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b shrink-0">
            <DialogTitle className="font-headline text-2xl">{dialogTitle}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 min-h-0">
          {initialMode === 'history' ? (
            <div className="py-4 flex-1 flex flex-col min-h-0 h-full">
              <h3 className="text-sm font-semibold mb-2 shrink-0">내 활동 목록</h3>
              <div className="w-full rounded-md border p-2 space-y-2 flex-grow overflow-y-auto">
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
          ) : (
            <Form {...form}>
              <form id={formId} onSubmit={form.handleSubmit(handleFormSubmit)} className="py-4 space-y-6">
                {intervalLock.locked ? (
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle className="font-bold">지금은 도전할 수 없어요!</AlertTitle>
                        <AlertDescription>
                          {`활동 제출 후 ${areaConfig.submissionIntervalMinutes}분(교사가 설정한 시간)이 지나야 해요. (${intervalLock.minutesToWait}분 남음)`}
                        </AlertDescription>
                    </Alert>
                ) : (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">새 활동 공유하기</h3>
                    <fieldset disabled={isSubmitting || isChecking} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="evidence"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="sr-only">활동 내용</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder={
                                  "여기에 나의 실천 내용을 자세히 적어주세요. (예: 어떤 책을 읽고 무엇을 느꼈는지, 봉사활동을 통해 무엇을 배우고 실천했는지 등)"
                                }
                                {...field}
                                rows={3}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex items-center justify-center min-h-[4rem]">
                        {isChecking ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse p-2">
                            <BrainCircuit className="h-4 w-4" />
                            <span>AI가 실시간으로 내용을 분석하고 있습니다...</span>
                          </div>
                        ) : (showLengthWarning || aiFeedback) && (
                          <Alert variant="default" className="p-2 w-full">
                            <BrainCircuit className="h-4 w-4" />
                            <AlertTitle className="text-xs font-semibold mb-0.5">
                              AI 실시간 조언
                            </AlertTitle>
                            <AlertDescription className="text-xs">
                              {aiFeedback}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                      
                      <div>
                        <FormLabel htmlFor="media-file-input" className="text-xs">
                          증명 파일 (사진/영상)
                          {areaConfig.mediaRequired && <span className="text-destructive ml-1">*필수</span>}
                        </FormLabel>
                        <Input
                          id="media-file-input"
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,video/*"
                          onChange={handleFileChange}
                          className="file:text-primary file:font-semibold text-xs h-9 mt-1"
                        />
                        <FormDescription className="text-xs mt-1">
                          사진 {MAX_IMAGE_SIZE_MB}MB, 영상 {MAX_VIDEO_SIZE_MB}MB 이하의 파일을 올려주세요.
                        </FormDescription>
                      </div>

                      {fileName && (
                        <div className="text-sm p-3 bg-secondary rounded-md text-secondary-foreground flex items-center gap-2">
                           <FileCheck className="h-4 w-4 text-primary" />
                           <span className="font-medium">{fileName}</span>
                        </div>
                      )}
                    </fieldset>
                  </div>
                )}
              </form>
            </Form>
          )}
          </div>
          
          <DialogFooter className="p-6 pt-4 border-t shrink-0 flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-2">
              <DialogClose asChild>
                  <Button type="button" variant="secondary" className="w-full sm:w-auto order-last sm:order-first">
                      닫기
                  </Button>
              </DialogClose>
              {initialMode === 'submit' && (
                <Button type="submit" form={formId} className="w-full sm:w-auto" disabled={isSubmitting || isChecking || intervalLock.locked}>
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Send className="mr-2"/>}
                    {isSubmitting ? '제출 중...' : '제출하기'}
                </Button>
              )}
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
