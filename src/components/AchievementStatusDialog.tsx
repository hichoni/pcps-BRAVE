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
import { Send, Loader2, UploadCloud, FileCheck, FileX, History, Trash2, Info, BrainCircuit, Edit } from 'lucide-react';
import { submitEvidence } from '@/ai/flows/submit-evidence';
import { getTextFeedback } from '@/ai/flows/text-feedback';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy, limit, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { deleteSubmission } from '@/ai/flows/delete-submission';
import { uploadFile } from '@/services/client-storage';
import { resizeImage } from '@/lib/image-utils';
import { Separator } from './ui/separator';

type HistoryItem = {
    id: string;
    createdAt: Date;
} & (
    {
        type: 'submission';
        evidence: string;
        status: SubmissionStatus;
    } |
    {
        type: 'manual_update';
        text: string;
    }
);

const evidenceSchema = z.object({
  evidence: z.string().min(1, { message: '간단한 활동 내용을 입력해주세요.' }).max(1000, { message: '1000자 이내로 입력해주세요.'}),
  mediaUrl: z.string().url({ message: '올바른 URL 형식을 입력해주세요.' }).optional().or(z.literal('')),
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
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [showLengthWarning, setShowLengthWarning] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<HistoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [intervalLock, setIntervalLock] = useState({ locked: false, minutesToWait: 0 });
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<EvidenceFormValues>({
    resolver: zodResolver(evidenceSchema),
    defaultValues: { evidence: '', mediaUrl: '' },
  });

  const evidenceValue = form.watch('evidence');

  // This single effect handles data fetching and checks when the dialog opens.
  useEffect(() => {
    // If the dialog is not open, or we don't have the necessary info, do nothing.
    if (!user || !open || !db || !areaConfig) {
        // Reset loading state if dialog is closed
        if (!open) {
          setHistoryLoading(true);
          setIntervalLock({ locked: false, minutesToWait: 0 });
        }
        return;
    }

    const fetchHistory = () => {
        setHistoryLoading(true);

        const submissionsQuery = query(
            collection(db, "challengeSubmissions"),
            where("userId", "==", user.username),
            where("areaName", "==", areaName)
        );

        const manualUpdatesQuery = query(
            collection(db, "manualUpdates"),
            where("userId", "==", user.username),
            where("areaName", "==", areaName)
        );

        Promise.all([getDocs(submissionsQuery), getDocs(manualUpdatesQuery)]).then(([submissionsSnapshot, manualUpdatesSnapshot]) => {
            const submissionItems: HistoryItem[] = submissionsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    type: 'submission',
                    evidence: data.evidence,
                    status: data.status,
                    createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
                };
            });

            const manualUpdateItems: HistoryItem[] = manualUpdatesSnapshot.docs.map(doc => {
                const data = doc.data();
                let text = '';
                if (data.updateType === 'progress') {
                    text = `선생님께서 진행도를 '${data.newValue}${areaConfig.unit}'(으)로 수정했습니다.`;
                } else if (data.updateType === 'certification') {
                    text = `선생님께서 인증 상태를 '${data.newValue ? '인증 완료' : '미인증'}'(으)로 변경했습니다.`;
                }

                return {
                    id: doc.id,
                    type: 'manual_update',
                    text: text,
                    createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
                };
            });

            const combinedHistory = [...submissionItems, ...manualUpdateItems];
            combinedHistory.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());

            setHistory(combinedHistory);
            setHistoryLoading(false);
        }).catch(error => {
            console.error("Error fetching submission history:", error);
            toast({
                variant: "destructive",
                title: "오류",
                description: "활동 목록을 불러오는 데 실패했습니다. 다시 시도해주세요."
            });
            setHistoryLoading(false);
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
        setHistoryLoading(false); // No list to load in submit mode
        checkInterval();
    }

  }, [open, user, areaName, toast, areaConfig, initialMode]);


  // Effect for AI real-time feedback
  useEffect(() => {
    if (!open || !areaConfig || initialMode !== 'submit') {
      return;
    }

    const text = evidenceValue.trim();
    const hasMedia = !!fileName || !!form.getValues('mediaUrl');

    const handler = setTimeout(async () => {
      if (text.length < 10) return;
      setIsChecking(true);
      try {
        const result = await getTextFeedback({
          text: evidenceValue,
          requirements: areaConfig.requirements,
          hasMedia: hasMedia,
          mediaRequired: !!areaConfig.mediaRequired,
        });
        setAiFeedback(result?.feedback ?? null);
      } catch (error) {
        console.error("Real-time AI check failed:", error);
        setAiFeedback('AI 조언을 가져오는 데 실패했습니다.');
      } finally {
        setIsChecking(false);
      }
    }, 1500);
    
    if (text.length === 0) {
      setAiFeedback(null);
      setShowLengthWarning(false);
    } else if (text.length < 10) {
      setAiFeedback("AI 조언을 받으려면 10글자 이상 입력해주세요.");
      setShowLengthWarning(true);
    } else {
      setShowLengthWarning(false);
    }

    return () => clearTimeout(handler);
  }, [evidenceValue, fileName, areaConfig, open, initialMode, form]);
  
  if (!user || !challengeConfig || user.grade === undefined || !areaConfig) return null;
  
  const { koreanName, challengeName } = areaConfig;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
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
      toast({ variant: 'destructive', title: '지원하지 않는 파일 형식', description: '사진 또는 영상 파일만 업로드할 수 있습니다.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectedFile(null);
      setFileName(null);
      return;
    }

    if (file.size > limitBytes) {
      toast({ variant: 'destructive', title: '파일 크기 초과', description: `${fileType} 파일 크기는 ${limitMb}MB를 넘을 수 없습니다.` });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectedFile(null);
      setFileName(null);
      return;
    }
    setSelectedFile(file);
    setFileName(file.name);
  };

  const handleFormSubmit = async (data: EvidenceFormValues) => {
    if (!user || !user.name) return;
    setIsSubmitting(true);

    try {
      let finalMediaUrl: string | undefined = undefined;
      let finalMediaType: string | undefined = undefined;
      
      const fileToUpload = selectedFile;
      const urlFromInput = data.mediaUrl?.trim();
      
      if (fileToUpload && urlFromInput) {
        toast({ variant: 'destructive', title: '중복 제출 오류', description: '파일과 URL을 동시에 제출할 수 없습니다. 하나만 선택해주세요.' });
        setIsSubmitting(false);
        return;
      }
      
      if (areaConfig.mediaRequired && !fileToUpload && !urlFromInput) {
          toast({ variant: 'destructive', title: '미디어 누락', description: '이 영역은 미디어(파일 또는 URL) 제출이 필수입니다.' });
          setIsSubmitting(false);
          return;
      }

      if (fileToUpload) {
        const isImage = fileToUpload.type.startsWith('image/');
        let processedFile = fileToUpload;
        if (isImage) {
          try {
            processedFile = await resizeImage(fileToUpload, 1024);
          } catch (resizeError) {
            console.error("Image resize failed, uploading original:", resizeError);
          }
        }
        finalMediaUrl = await uploadFile(processedFile, user.username, 'evidence');
        finalMediaType = processedFile.type;
      } else if (urlFromInput) {
        finalMediaUrl = urlFromInput;
        finalMediaType = undefined;
      }
      
      const result = await submitEvidence({
        userId: user.username,
        userName: user.name,
        areaName: areaName,
        koreanName: areaConfig.koreanName,
        challengeName: areaConfig.challengeName,
        evidence: data.evidence || '미디어 자료 제출',
        mediaUrl: finalMediaUrl,
        mediaType: finalMediaType,
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
      setSelectedFile(null);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onOpenChange(false);

    } catch (error: unknown) {
      console.error('Evidence Submission Error:', error);
      let errorMessage = "알 수 없는 오류가 발생했습니다.";
      if (error instanceof Error) errorMessage = error.message;
      else if (typeof error === 'string') errorMessage = error;
      
      if (errorMessage.startsWith('제출 간격 제한:')) {
        toast({ variant: 'default', title: '제출 간격 제한', description: errorMessage.replace('제출 간격 제한: ', ''), duration: 9000 });
      } else {
        toast({ variant: 'destructive', title: '제출 오류', description: errorMessage, duration: 9000 });
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const onDialogClose = (isOpen: boolean) => {
      if (!isOpen) {
          form.reset();
          setSelectedFile(null);
          setFileName(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          setAiFeedback(null);
          setShowLengthWarning(false);
          setIntervalLock({ locked: false, minutesToWait: 0 });
      }
      onOpenChange(isOpen);
  }

  const handleDeleteRequest = async () => {
    if (!itemToDelete || itemToDelete.type !== 'submission' || !user) return;

    setIsDeleting(true);
    try {
        const result = await deleteSubmission({ submissionId: itemToDelete.id, userId: String(user.id) });
        toast({ title: "요청 완료", description: result.message });
        setItemToDelete(null);
    } catch (error: any) {
        toast({ variant: "destructive", title: "삭제 요청 오류", description: error.message || '삭제 요청에 실패했습니다.' });
    } finally {
        setIsDeleting(false);
    }
  };

  const dialogTitle = initialMode === 'history' 
    ? `[${koreanName}] 활동 내역` 
    : `[${koreanName}] ${challengeName}`;

  return (
    <AlertDialog onOpenChange={(open) => { if (!open && itemToDelete) setItemToDelete(null); }}>
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
                {historyLoading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin"/>
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    아직 제출한 활동이 없습니다.
                  </div>
                ) : (
                  history.map(item => {
                    if (item.type === 'manual_update') {
                        return (
                            <div key={item.id} className="text-sm p-2 rounded-md flex justify-between items-center bg-blue-500/10 border border-blue-500/20">
                                <div className="flex-grow min-w-0 flex items-center gap-2">
                                    <Edit className="h-4 w-4 text-primary shrink-0"/>
                                    <div>
                                        <p className="text-primary font-medium">{item.text}</p>
                                        <p className="text-xs text-muted-foreground/80 mt-1">{format(item.createdAt, "yyyy.MM.dd HH:mm", { locale: ko })}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    const status = StatusInfo[item.status];
                    if (!status) return null;
                    const Icon = status.icon;
                    const isPending = item.status === 'pending_review' || item.status === 'pending_deletion';
                    return (
                      <div key={item.id} className={cn(
                        "text-sm p-2 rounded-md flex justify-between items-center group transition-colors",
                        item.status === 'pending_deletion' ? 'bg-orange-500/10 border border-orange-500/20 opacity-80' : 'bg-secondary/50'
                      )}>
                        <div className="flex-grow min-w-0">
                            <div className="flex justify-between items-start">
                                <p className="text-muted-foreground truncate pr-4 flex-grow">{item.evidence}</p>
                                <div className={cn("flex items-center gap-1 font-semibold text-xs shrink-0", status.color)}>
                                    <Icon className="h-3.5 w-3.5"/>
                                    <span>{status.text}</span>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground/70 mt-1">{format(item.createdAt, "yyyy.MM.dd HH:mm", { locale: ko })}</p>
                        </div>
                        {item.type === 'submission' && (
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" onClick={() => setItemToDelete(item)} disabled={isPending}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                        )}
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
                                placeholder={areaConfig.placeholderText || "여기에 나의 실천 내용을 자세히 적어주세요."}
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
                            <AlertTitle className="text-xs font-semibold mb-0.5">AI 실시간 조언</AlertTitle>
                            <AlertDescription className="text-xs">{aiFeedback}</AlertDescription>
                          </Alert>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>
                            증명 자료
                            {areaConfig.mediaRequired && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        <p className="text-xs text-muted-foreground -mt-1">
                            파일 또는 URL 중 하나를 선택하여 제출해주세요.
                        </p>
                        <div className="space-y-4 rounded-md border p-4">
                             <div>
                                <FormLabel htmlFor="media-file-input" className="text-sm font-medium">
                                  파일 업로드 (사진/영상)
                                  {areaConfig.aiVisionCheck && <span className="text-blue-600 font-semibold ml-1 text-xs">(AI 자동 분석 대상)</span>}
                                </FormLabel>
                                <Input
                                  id="media-file-input"
                                  ref={fileInputRef}
                                  type="file"
                                  accept="image/*,video/*"
                                  onChange={handleFileChange}
                                  className="file:text-primary file:font-semibold text-xs h-9 mt-1"
                                />
                                <FormDescription className="text-xs mt-1">사진 {MAX_IMAGE_SIZE_MB}MB, 영상 {MAX_VIDEO_SIZE_MB}MB 이하</FormDescription>
                              </div>

                              <div className="relative flex items-center">
                                <Separator className="flex-1" />
                                <span className="mx-2 text-xs text-muted-foreground">또는</span>
                                <Separator className="flex-1" />
                              </div>

                              <FormField
                                control={form.control}
                                name="mediaUrl"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium">
                                      외부 URL 붙여넣기 (유튜브 등)
                                    </FormLabel>
                                    <FormControl>
                                      <Input placeholder="https://..." {...field} />
                                    </FormControl>
                                    <FormDescription className="text-xs mt-1">
                                        URL로 제출하면 선생님의 확인이 필요해요.
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                        </div>
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
