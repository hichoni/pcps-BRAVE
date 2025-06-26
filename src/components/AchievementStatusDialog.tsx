"use client";

import { useState, useEffect } from 'react';
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
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from './ui/form';
import { useAuth } from '@/context/AuthContext';
import { AreaName } from '@/lib/config';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { ListChecks, Send, Loader2, UploadCloud, ThumbsUp, ThumbsDown, BrainCircuit } from 'lucide-react';
import { submitEvidence } from '@/ai/flows/submit-evidence';
import { checkCertification } from '@/ai/flows/certification-checker';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Input } from './ui/input';

const evidenceSchema = z.object({
  evidence: z.string().min(10, { message: '최소 10자 이상 자세하게 입력해주세요.' }).max(1000, { message: '1000자 이내로 입력해주세요.'}),
  media: z.any().optional(),
});

type EvidenceFormValues = z.infer<typeof evidenceSchema>;

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const resizeImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<{ dataUri: string; file: File }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Canvas to Blob conversion failed'));
            }
            const resizedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            
            const resizedReader = new FileReader();
            resizedReader.onloadend = () => {
                resolve({ dataUri: resizedReader.result as string, file: resizedFile });
            };
            resizedReader.readAsDataURL(blob);

          },
          'image/jpeg',
          0.8
        );
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};


export function AchievementStatusDialog({ areaName }: { areaName: AreaName }) {
  const { user } = useAuth();
  const { challengeConfig } = useChallengeConfig();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{ isSufficient: boolean; reasoning: string } | null>(null);

  const form = useForm<EvidenceFormValues>({
    resolver: zodResolver(evidenceSchema),
    defaultValues: { evidence: '' },
  });

  const evidenceValue = form.watch('evidence');

  if (!user || !challengeConfig || !user.grade) return null;
  
  const areaConfig = challengeConfig[areaName];

  if (!areaConfig) return null;
  
  const { koreanName, challengeName } = areaConfig;

  useEffect(() => {
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
    }, 1500); // 1.5초 후에 AI 분석 시작

    return () => {
      clearTimeout(handler);
    };
  }, [evidenceValue, areaName, koreanName, areaConfig]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
            toast({
                variant: 'destructive',
                title: '파일 크기 초과',
                description: `동영상 등 미디어 파일의 크기는 ${MAX_FILE_SIZE_MB}MB를 넘을 수 없습니다.`,
            });
            event.target.value = ''; // Reset the file input
            return;
        }

        if (!file.type.startsWith('image/')) {
            setMediaFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setMediaPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
            return;
        }

        setIsSubmitting(true); // Show loader while resizing
        try {
            const { dataUri, file: resizedFile } = await resizeImage(file, 1280, 720, 0.8);
            setMediaFile(resizedFile);
            setMediaPreview(dataUri);
        } catch (error) {
            console.error("Image resize error:", error);
            toast({
                variant: 'destructive',
                title: '이미지 처리 오류',
                description: '이미지 크기를 조절하는 데 실패했습니다. 다른 파일을 시도해주세요.',
            });
            setMediaFile(null);
            setMediaPreview(null);
        } finally {
            setIsSubmitting(false);
        }
    } else {
        setMediaFile(null);
        setMediaPreview(null);
    }
  };

  const handleFormSubmit = async (data: EvidenceFormValues) => {
    if (!user || !user.name) return;

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
      const result = await submitEvidence({
        userId: user.username,
        userName: user.name,
        areaName: areaName,
        koreanName: areaConfig.koreanName,
        challengeName: areaConfig.challengeName,
        evidence: data.evidence,
        mediaDataUri: mediaPreview ?? undefined,
        mediaType: mediaFile?.type ?? undefined,
      });
      
      toast({
        title: result.progressUpdated ? '제출 완료 및 진행도 업데이트!' : '제출 완료!',
        description: (
            <div>
                <p className="font-semibold">{result.updateMessage}</p>
                <p className="text-xs mt-2 text-muted-foreground">AI 판단 근거: {result.aiReasoning}</p>
            </div>
        ),
        duration: 9000,
      });

      form.reset();
      setMediaFile(null);
      setMediaPreview(null);
      setDialogOpen(false);
    } catch (error: unknown) {
      console.error('Evidence Submission Error:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
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
          setMediaFile(null);
          setMediaPreview(null);
          setAiFeedback(null);
      }
      setDialogOpen(isOpen);
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={onDialogClose}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full font-bold">
          <ListChecks className="mr-2 h-4 w-4" /> 갤러리에 공유
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">{koreanName} 활동 공유</DialogTitle>
          <DialogDescription>
            {challengeName} - 나의 도전 과정을 친구들에게 공유해보세요!
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-2">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                   <FormField
                      control={form.control}
                      name="evidence"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>활동 내용</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="여기에 나의 실천 내용을 자세히 적어주세요. (예: 어떤 책을 읽고 무엇을 느꼈는지, 봉사활동을 통해 무엇을 배우고 실천했는지 등)"
                              {...field}
                              rows={5}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="min-h-[6rem] flex items-center">
                        {isChecking && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse p-2">
                                <BrainCircuit className="h-4 w-4" />
                                <span>AI가 실시간으로 내용을 분석하고 있습니다...</span>
                            </div>
                        )}
                        {!isChecking && aiFeedback && (
                            <Alert variant={aiFeedback.isSufficient ? "default" : "destructive"} className="p-3 w-full">
                                {aiFeedback.isSufficient ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
                                <AlertTitle className="text-sm font-semibold mb-1">
                                    {aiFeedback.isSufficient ? "AI 피드백: 좋은 내용입니다!" : "AI 피드백: 기준에 조금 부족해요."}
                                </AlertTitle>
                                <AlertDescription className="text-xs">
                                    {aiFeedback.reasoning}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                    
                    {areaConfig.mediaRequired && (
                        <>
                            <FormField
                                control={form.control}
                                name="media"
                                render={() => (
                                <FormItem>
                                    <FormLabel>
                                        증명 파일 (사진/영상)
                                        {areaConfig.mediaRequired && <span className="text-destructive ml-1">*필수</span>}
                                    </FormLabel>
                                    <FormControl>
                                    <Input 
                                        type="file" 
                                        accept="image/*,video/*"
                                        onChange={handleFileChange}
                                        className="file:text-primary file:font-semibold"
                                        disabled={isSubmitting}
                                    />
                                    </FormControl>
                                    <FormDescription>
                                        10MB 이하의 사진/동영상. 큰 사진은 자동으로 최적화됩니다.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />

                            {mediaPreview && mediaFile && (
                                <div className="mt-4">
                                    <p className="text-sm font-medium mb-2">미리보기:</p>
                                    {mediaFile.type.startsWith('image/') ? (
                                        <img src={mediaPreview} alt="미리보기" className="rounded-md max-h-60 w-auto mx-auto border" />
                                    ) : (
                                        <video src={mediaPreview} controls className="rounded-md max-h-60 w-auto mx-auto border" />
                                    )}
                                </div>
                            )}
                        </>
                    )}
                    
                    <Button type="submit" className="w-full" disabled={isSubmitting || isChecking}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Send className="mr-2"/>}
                        {isSubmitting && !mediaFile ? '제출 중...' : (isSubmitting && mediaFile ? '파일 처리 중...' : '갤러리에 제출하기')}
                    </Button>
                </form>
            </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
