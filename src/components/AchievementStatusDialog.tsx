"use client";

import { useState } from 'react';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { useAchievements } from '@/context/AchievementsContext';
import { useAuth } from '@/context/AuthContext';
import { AreaName } from '@/lib/config';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { ListChecks, Send, Loader2, CircleCheck } from 'lucide-react';
import { submitEvidence } from '@/ai/flows/submit-evidence';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Input } from './ui/input';

const evidenceSchema = z.object({
  evidence: z.string().min(10, { message: '최소 10자 이상 자세하게 입력해주세요.' }).max(1000, { message: '1000자 이내로 입력해주세요.'}),
  media: z.any().optional(),
});

type EvidenceFormValues = z.infer<typeof evidenceSchema>;

export function AchievementStatusDialog({ areaName }: { areaName: AreaName }) {
  const { user } = useAuth();
  const { challengeConfig } = useChallengeConfig();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  const form = useForm<EvidenceFormValues>({
    resolver: zodResolver(evidenceSchema),
    defaultValues: { evidence: '' },
  });

  if (!user || !challengeConfig || !user.grade) return null;
  
  const areaConfig = challengeConfig[areaName];

  if (!areaConfig) return null;
  
  const { koreanName, challengeName } = areaConfig;
  const isMediaRequired = !!areaConfig.mediaRequired;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
        setMediaFile(null);
        setMediaPreview(null);
    }
  };

  const handleFormSubmit = async (data: EvidenceFormValues) => {
    if (!user || !user.name) return;

    if (isMediaRequired && !mediaFile) {
        toast({
            variant: 'destructive',
            title: '파일 누락',
            description: '이 영역은 사진이나 영상 제출이 필수입니다.',
        });
        return;
    }

    setIsSubmitting(true);
    try {
      await submitEvidence({
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
        title: '제출 완료!',
        description: '도전 내용이 갤러리에 성공적으로 제출되었습니다.',
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
                    
                    {isMediaRequired && (
                        <>
                            <Alert variant="default" className="border-primary/50 text-primary [&>svg]:text-primary">
                                <CircleCheck className="h-4 w-4" />
                                <AlertTitle className="font-bold">사진/영상 제출 필수!</AlertTitle>
                                <AlertDescription>
                                이 영역은 활동을 증명할 수 있는 사진이나 영상을 필수로 제출해야 합니다.
                                </AlertDescription>
                            </Alert>
                            <FormField
                                control={form.control}
                                name="media" // Dummy name for react-hook-form
                                render={() => (
                                <FormItem>
                                    <FormLabel>증명 파일 (사진/영상)</FormLabel>
                                    <FormControl>
                                    <Input 
                                        type="file" 
                                        accept="image/*,video/*"
                                        onChange={handleFileChange}
                                        className="file:text-primary file:font-semibold"
                                    />
                                    </FormControl>
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
                    
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Send className="mr-2"/>}
                        갤러리에 제출하기
                    </Button>
                </form>
            </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
