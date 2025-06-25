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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { useAchievements } from '@/context/AchievementsContext';
import { useAuth } from '@/context/AuthContext';
import { AreaName } from '@/lib/config';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { ListChecks, Sparkles, Loader2, CircleCheck, CircleX } from 'lucide-react';
import { Badge } from './ui/badge';
import { checkCertification, type CertificationCheckOutput } from '@/ai/flows/certification-checker';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { cn } from '@/lib/utils';

const evidenceSchema = z.object({
  evidence: z.string().min(10, { message: '최소 10자 이상 자세하게 입력해주세요.' }).max(500, { message: '500자 이내로 입력해주세요.'}),
});

type EvidenceFormValues = z.infer<typeof evidenceSchema>;

export function AchievementStatusDialog({ areaName }: { areaName: AreaName }) {
  const { user } = useAuth();
  const { getAchievements } = useAchievements();
  const { challengeConfig } = useChallengeConfig();
  const { toast } = useToast();
  
  const [isChecking, setIsChecking] = useState(false);
  const [aiResponse, setAiResponse] = useState<CertificationCheckOutput | null>(null);

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

  const handleCheckEvidence = async (data: EvidenceFormValues) => {
    setIsChecking(true);
    setAiResponse(null);
    try {
      const response = await checkCertification({
        areaName: koreanName,
        requirements: requirements,
        evidence: data.evidence,
      });
      setAiResponse(response);
    } catch (error) {
      console.error('AI Certification Check Error:', error);
      toast({
        variant: 'destructive',
        title: 'AI 검토 오류',
        description: 'AI 검토 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      });
    } finally {
      setIsChecking(false);
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
  
  const renderAiCheckResult = () => {
    if (!aiResponse) return null;
    
    const isSufficient = aiResponse.isSufficient;
    
    return (
        <Alert 
          variant={isSufficient ? "default" : "destructive"}
          className={cn(isSufficient && "border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:border-emerald-500/80 dark:bg-emerald-950 dark:text-emerald-200 [&>svg]:text-emerald-500")}
        >
           {isSufficient ? <CircleCheck className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}
           <AlertTitle className="font-bold">{isSufficient ? "인증 가능성이 높아요!" : "인증이 어려워요"}</AlertTitle>
           <AlertDescription className={cn(isSufficient && "dark:text-emerald-200/80")}>
             {aiResponse.reasoning}
           </AlertDescription>
         </Alert>
    );
  };

  return (
    <Dialog onOpenChange={(isOpen) => {
      if (!isOpen) {
        form.reset();
        setAiResponse(null);
      }
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
        
        <Tabs defaultValue="status" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="status">현재 현황</TabsTrigger>
                <TabsTrigger value="submit">증거 제출 & AI 검토</TabsTrigger>
            </TabsList>
            <TabsContent value="status">
                {renderStatus()}
                 <DialogClose asChild>
                    <Button type="button" className="w-full mt-4">확인</Button>
                </DialogClose>
            </TabsContent>
            <TabsContent value="submit">
                <div className="py-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                        <strong>인증 기준:</strong> {requirements}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        아래에 증거 내용을 작성하고 AI에게 내가 인증받을 자격이 있는지 미리 확인해보세요!
                    </p>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleCheckEvidence)} className="space-y-4">
                           <FormField
                              control={form.control}
                              name="evidence"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="sr-only">증거 내용</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="여기에 나의 실천 내용을 자세히 적어주세요. (예: 어떤 책을 읽고 무엇을 느꼈는지, 봉사활동을 통해 무엇을 배우고 실천했는지 등)"
                                      {...field}
                                      rows={5}
                                      disabled={isCertified}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            {isCertified ? (
                                <Alert variant="default" className="border-primary/50 text-primary dark:border-primary/50 [&>svg]:text-primary">
                                    <CircleCheck className="h-4 w-4" />
                                    <AlertTitle>인증 완료!</AlertTitle>
                                    <AlertDescription>
                                        이 영역은 이미 인증을 받았습니다.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Button type="submit" className="w-full" disabled={isChecking}>
                                    {isChecking ? <Loader2 className="animate-spin" /> : <Sparkles className="mr-2"/>}
                                    AI에게 검토 요청하기
                                </Button>
                            )}

                        </form>
                    </Form>
                    
                    {isChecking && (
                        <div className="flex items-center justify-center text-sm text-muted-foreground pt-4">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                            AI가 열심히 검토하고 있어요...
                        </div>
                    )}
                    
                    {aiResponse && renderAiCheckResult()}
                </div>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
