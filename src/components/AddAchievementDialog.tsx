"use client";

import { useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAchievements } from '@/context/AchievementsContext';
import { AreaName, AREAS_CONFIG } from '@/lib/config';
import { useToast } from '@/hooks/use-toast';
import { certificationCheck, CertificationCheckOutput } from '@/ai/flows/certification-checker';
import { Loader2, FileUp, CheckCircle, AlertTriangle } from 'lucide-react';

const formSchema = z.object({
  description: z.string().min(10, { message: '설명은 최소 10자 이상이어야 합니다.' }),
  evidence: z.any().refine(file => file instanceof FileList && file.length > 0, '증빙 자료 파일은 필수입니다.'),
});

type FormValues = z.infer<typeof formSchema>;

type AiState = 'idle' | 'loading' | 'success' | 'error';

export function AddAchievementDialog({ areaName }: { areaName: AreaName }) {
  const [open, setOpen] = useState(false);
  const [aiState, setAiState] = useState<AiState>('idle');
  const [aiResponse, setAiResponse] = useState<CertificationCheckOutput | null>(null);
  const { addAchievement } = useAchievements();
  const { toast } = useToast();
  const areaConfig = AREAS_CONFIG[areaName];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { description: '', evidence: undefined },
  });

  const evidenceFile = watch('evidence');

  const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const onSubmit = async (data: FormValues) => {
    setAiState('loading');
    setAiResponse(null);
    try {
      const file = data.evidence[0];
      const evidenceDataUri = await fileToDataUri(file);

      const result = await certificationCheck({
        area: areaName,
        achievementDescription: data.description,
        certificationRequirements: areaConfig.requirements,
        evidenceDataUri,
      });

      setAiResponse(result);

      if (result.meetsRequirements) {
        setAiState('success');
        addAchievement(areaName, {
          id: new Date().toISOString(),
          description: data.description,
          date: new Date().toLocaleDateString(),
          evidenceDataUri: '', // Not storing large data URI in local storage
        });
        toast({
          title: '✅ 성취 인증 완료!',
          description: `${areaConfig.koreanName} 영역의 성취가 승인되었습니다.`,
        });
        setTimeout(() => {
          setOpen(false);
        }, 1500);
      } else {
        setAiState('error');
        toast({
          variant: 'destructive',
          title: '인증 거부됨',
          description: result.reasoning,
        });
      }
    } catch (error) {
      console.error('Certification check failed:', error);
      setAiState('error');
      setAiResponse({ meetsRequirements: false, reasoning: "예기치 않은 오류가 발생했습니다. 다시 시도해주세요." });
      toast({
        variant: 'destructive',
        title: '오류',
        description: '인증 확인에 실패했습니다. 나중에 다시 시도해주세요.',
      });
    }
  };
  
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      reset();
      setAiState('idle');
      setAiResponse(null);
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full font-bold">
          <FileUp className="mr-2 h-4 w-4" /> 인증 제출
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl">{areaConfig.koreanName} 영역 인증 제출</DialogTitle>
            <DialogDescription>{areaConfig.requirements}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="grid gap-2">
              <Label htmlFor="description">성취 설명</Label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => <Textarea id="description" placeholder="성취에 대해 자세히 설명해주세요..." {...field} />}
              />
              {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="evidence">증빙 자료</Label>
              <Controller
                name="evidence"
                control={control}
                render={({ field: { onChange, ...field } }) => (
                  <Input 
                    id="evidence" 
                    type="file" 
                    accept="image/*,application/pdf"
                    onChange={(e) => onChange(e.target.files)}
                    ref={fileInputRef}
                    {...field}
                  />
                )}
              />
              {evidenceFile?.[0] && <p className="text-sm text-muted-foreground">선택된 파일: {evidenceFile[0].name}</p>}
              {errors.evidence && <p className="text-sm text-destructive">{errors.evidence.message as string}</p>}
            </div>
            {aiState !== 'idle' && aiResponse && (
               <div className={`p-4 rounded-md flex items-start gap-4 ${aiState === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-destructive/10 text-destructive'}`}>
                {aiState === 'success' ? <CheckCircle className="w-5 h-5 mt-1" /> : <AlertTriangle className="w-5 h-5 mt-1" />}
                <div>
                  <h4 className="font-bold">{aiState === 'success' ? '인증 승인됨' : '인증 거부됨'}</h4>
                  <p className="text-sm">{aiResponse.reasoning}</p>
                </div>
               </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">취소</Button>
            </DialogClose>
            <Button type="submit" disabled={aiState === 'loading'}>
              {aiState === 'loading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              인증 확인
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
