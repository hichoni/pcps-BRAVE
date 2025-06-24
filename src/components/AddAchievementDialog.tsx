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
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  evidence: z.any().refine(file => file instanceof FileList && file.length > 0, 'Evidence file is required.'),
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
          title: '✅ Achievement Certified!',
          description: `Your achievement in ${areaConfig.koreanName} has been approved.`,
        });
        setTimeout(() => {
          setOpen(false);
        }, 1500);
      } else {
        setAiState('error');
        toast({
          variant: 'destructive',
          title: 'Certification Denied',
          description: result.reasoning,
        });
      }
    } catch (error) {
      console.error('Certification check failed:', error);
      setAiState('error');
      setAiResponse({ meetsRequirements: false, reasoning: "An unexpected error occurred. Please try again." });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to check certification. Please try again later.',
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
              <Label htmlFor="description">Achievement Description</Label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => <Textarea id="description" placeholder="Describe your achievement in detail..." {...field} />}
              />
              {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="evidence">Evidence</Label>
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
              {evidenceFile?.[0] && <p className="text-sm text-muted-foreground">Selected: {evidenceFile[0].name}</p>}
              {errors.evidence && <p className="text-sm text-destructive">{errors.evidence.message as string}</p>}
            </div>
            {aiState !== 'idle' && aiResponse && (
               <div className={`p-4 rounded-md flex items-start gap-4 ${aiState === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-destructive/10 text-destructive'}`}>
                {aiState === 'success' ? <CheckCircle className="w-5 h-5 mt-1" /> : <AlertTriangle className="w-5 h-5 mt-1" />}
                <div>
                  <h4 className="font-bold">{aiState === 'success' ? 'Certification Approved' : 'Certification Denied'}</h4>
                  <p className="text-sm">{aiResponse.reasoning}</p>
                </div>
               </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={aiState === 'loading'}>
              {aiState === 'loading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Check Certification
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
