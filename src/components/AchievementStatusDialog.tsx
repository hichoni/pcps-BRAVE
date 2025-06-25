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
  DialogClose,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { useAchievements } from '@/context/AchievementsContext';
import { useAuth } from '@/context/AuthContext';
import { AreaName, User } from '@/lib/config';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { ListChecks, Send, Loader2, CircleCheck } from 'lucide-react';
import { Badge } from './ui/badge';
import { submitEvidence } from '@/ai/flows/submit-evidence';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const evidenceSchema = z.object({
  evidence: z.string().min(10, { message: '최소 10자 이상 자세하게 입력해주세요.' }).max(1000, { message: '1000자 이내로 입력해주세요.'}),
});

type EvidenceFormValues = z.infer<typeof evidenceSchema>;

export function AchievementStatusDialog({ areaName }: { areaName: AreaName }) {
  const { user } = useAuth();
  const { getAchievements } = useAchievements();
  const { challengeConfig } = useChallengeConfig();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<EvidenceFormValues>({
    resolver: zodResolver(evidenceSchema),
    defaultValues: { evidence: '' },
  });

  if (!user || !challengeConfig || !user.grade) return null;
  
  const achievements = getAchievements(user.username);
  const areaConfig = challengeConfig[areaName];
  const areaState = achievements?.[areaName];

  if (!areaState || !areaConfig) return null;
  
  const { progress, isCertified } = areaState;
  const { unit, koreanName, challengeName, requirements } = areaConfig;

  const handleFormSubmit = async (data: EvidenceFormValues) => {
    if (!user || !user.name) return;

    setIsSubmitting(true);
    try {
      await submitEvidence({
        userId: user.username,
        userName: user.name,
        areaName: areaName,
        koreanName: areaConfig.koreanName,
        challengeName: areaConfig.challengeName,
        evidence: data.evidence,
      });
      toast({
        title: '제출 완료!',
        description: '도전 내용이 갤러리에 성공적으로 제출되었습니다.',
      });
      form.reset();
      setDialogOpen(false);
    } catch (error) {
      console.error('Evidence Submission Error:', error);
      toast({
        variant: 'destructive',
        title: '제출 오류',
        description: '제출 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatus = () => {
    if (areaConfig.goalType === 'numeric') {
        const goalForGrade = areaConfig.goal[user.grade ?? '4'] ?? 0;
        return (
             <div className="py-4 text-center">
                <div className="text-lg text-muted-foreground">현재 달성도</div>
                <div className="text-4xl font-bold text-primary my-2">
                    {progress as number || 0} <span className="text-2xl text-muted-foreground">{unit}</span>
                </div>
                <div className="text-sm text-muted-foreground">목표: {goalForGrade} {unit}</div>
            </div>
        );
    }
     if (areaConfig.goalType === 'objective') {
        return (
             <div className="py-4 text-center">
                <div className="text-lg text-muted-foreground">현재 달성 상태</div>
                <div className="text-4xl font-bold text-primary my-2 h-12 flex items-center justify-center">
                   {progress ? progress : <span className="text-lg text-muted-foreground font-normal">선택 없음</span>}
                </div>
                <div className="text-sm text-muted-foreground mt-4">선택 가능 {unit}:</div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {areaConfig.options?.map(opt => (
                        <Badge key={opt} variant={progress === opt ? 'default' : 'secondary'}>{opt}</Badge>
                    ))}
                </div>
            </div>
        );
     }
     return null;
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={(isOpen) => {
      if (!isOpen) form.reset();
      setDialogOpen(isOpen);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full font-bold">
          <ListChecks className="mr-2 h-4 w-4" /> 인증 현황
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">{koreanName} 영역 현황</DialogTitle>
          <DialogDescription>
            {challengeName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-2">
            <h3 className="text-sm font-semibold mb-2">활동 내용 제출하기</h3>
            <p className="text-sm text-muted-foreground mb-4">
                친구들에게 나의 도전 과정을 공유해보세요! 여기에 작성한 내용은 도전 갤러리에 게시됩니다.
            </p>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                   <FormField
                      control={form.control}
                      name="evidence"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">활동 내용</FormLabel>
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
