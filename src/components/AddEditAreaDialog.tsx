
"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, Save, Info } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from './ui/form';
import { ICONS, AreaName, StoredAreaConfig } from '@/lib/config';
import { Checkbox } from './ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  id: z.string().refine(val => /^[a-zA-Z0-9-_]+$/.test(val), {
    message: 'ID는 영문, 숫자, 하이픈(-), 밑줄(_)만 사용할 수 있습니다.',
  }),
  koreanName: z.string().min(1, '영역 이름은 필수입니다.'),
  challengeName: z.string().min(1, '도전 과제 이름은 필수입니다.'),
  iconName: z.string().min(1, '아이콘을 선택해주세요.'),
  requirements: z.string().min(1, '인증 기준 설명은 필수입니다.'),
  goalType: z.enum(['numeric', 'objective']),
  unit: z.string().min(1, '단위는 필수입니다.'),
  goal: z.object({
    '4': z.coerce.number().optional(),
    '5': z.coerce.number().optional(),
    '6': z.coerce.number().optional(),
  }),
  options: z.array(z.object({ value: z.string().min(1, '옵션 값은 비워둘 수 없습니다.') })),
  externalUrl: z.string().url({ message: "올바른 URL 형식을 입력해주세요." }).optional().or(z.literal('')),
  mediaRequired: z.boolean().optional(),
  autoApprove: z.boolean().optional(),
  showInGallery: z.boolean().optional(),
  aiVisionCheck: z.boolean().optional(),
  aiVisionPrompt: z.string().optional(),
}).refine(data => {
    if (data.goalType === 'numeric') {
        return data.goal['4'] !== undefined && data.goal['5'] !== undefined && data.goal['6'] !== undefined;
    }
    return true;
}, { message: '숫자 목표형은 모든 학년의 목표량을 입력해야 합니다.', path: ['goal'] })
.refine(data => {
    if (data.goalType === 'objective') {
        return data.options.length > 0;
    }
    return true;
}, { message: '객관식 선택형은 최소 1개 이상의 옵션이 필요합니다.', path: ['options'] });

type FormValues = z.infer<typeof formSchema>;

interface AddEditAreaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  area: { id: AreaName, config: StoredAreaConfig } | null;
}

export function AddEditAreaDialog({ open, onOpenChange, area }: AddEditAreaDialogProps) {
  const { challengeConfig, addArea, updateArea } = useChallengeConfig();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: '',
      koreanName: '',
      challengeName: '',
      iconName: '',
      requirements: '',
      goalType: 'numeric',
      unit: '',
      goal: { '4': 0, '5': 0, '6': 0 },
      options: [],
      externalUrl: '',
      mediaRequired: false,
      autoApprove: false,
      showInGallery: true,
      aiVisionCheck: false,
      aiVisionPrompt: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'options'
  });

  const goalType = form.watch('goalType');
  const autoApproveEnabled = form.watch('autoApprove');
  const aiVisionEnabled = form.watch('aiVisionCheck');
  const isEditMode = !!area;

  useEffect(() => {
    if (area) {
      form.reset({
        id: area.id,
        koreanName: area.config.koreanName,
        challengeName: area.config.challengeName,
        iconName: area.config.iconName,
        requirements: area.config.requirements,
        goalType: area.config.goalType,
        unit: area.config.unit,
        goal: area.config.goal,
        options: area.config.options?.map(o => ({ value: o })) || [],
        externalUrl: area.config.externalUrl || '',
        mediaRequired: area.config.mediaRequired || false,
        autoApprove: area.config.autoApprove || false,
        showInGallery: area.config.showInGallery ?? true,
        aiVisionCheck: area.config.aiVisionCheck ?? false,
        aiVisionPrompt: area.config.aiVisionPrompt ?? '',
      });
    } else {
      form.reset({
        id: '',
        koreanName: '',
        challengeName: '',
        iconName: '',
        requirements: '',
        goalType: 'numeric',
        unit: '',
        goal: { '4': 0, '5': 0, '6': 0 },
        options: [{ value: '' }],
        externalUrl: '',
        mediaRequired: false,
        autoApprove: false,
        showInGallery: true,
        aiVisionCheck: false,
        aiVisionPrompt: '',
      });
    }
  }, [area, form, open]);

  useEffect(() => {
    if (!autoApproveEnabled) {
      form.setValue('aiVisionCheck', false);
    }
  }, [autoApproveEnabled, form]);
  
  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    const areaId = data.id.trim();

    if (!isEditMode && challengeConfig && challengeConfig[areaId]) {
      toast({ variant: 'destructive', title: '오류', description: '이미 사용 중인 ID입니다. 다른 ID를 사용해주세요.' });
      setLoading(false);
      return;
    }

    const newConfigData: StoredAreaConfig = {
      koreanName: data.koreanName,
      challengeName: data.challengeName,
      iconName: data.iconName,
      requirements: data.requirements,
      goalType: data.goalType,
      unit: data.unit,
      goal: data.goalType === 'numeric' ? data.goal : {},
      options: data.goalType === 'objective' ? data.options.map(o => o.value) : [],
      externalUrl: data.externalUrl || undefined,
      mediaRequired: data.mediaRequired,
      autoApprove: data.autoApprove,
      showInGallery: data.showInGallery,
      aiVisionCheck: data.aiVisionCheck,
      aiVisionPrompt: data.aiVisionPrompt,
    };
    
    try {
        if (isEditMode) {
            await updateArea(areaId, newConfigData);
            toast({ title: '성공', description: '도전 영역이 수정되었습니다.' });
        } else {
            await addArea(areaId, newConfigData);
            toast({ title: '성공', description: '새로운 도전 영역이 추가되었습니다.' });
        }
        onOpenChange(false);
    } catch (error) {
         toast({ variant: 'destructive', title: '오류', description: '저장에 실패했습니다.' });
    } finally {
        setLoading(false);
    }
  };

  const IconKeys = Object.keys(ICONS);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? '도전 영역 수정' : '새 도전 영역 추가'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? '도전 영역의 세부 정보를 수정합니다.' : '새로운 도전 영역을 만들고 설정을 입력합니다.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                      control={form.control}
                      name="id"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>영역 ID (영문)</FormLabel>
                              <FormControl>
                                  <Input placeholder="예: English-Reading" {...field} disabled={isEditMode} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="koreanName"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>영역 이름 (한글)</FormLabel>
                              <FormControl>
                                  <Input placeholder="예: 영어 독서" {...field} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                   <FormField
                      control={form.control}
                      name="challengeName"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>도전 과제 이름</FormLabel>
                              <FormControl>
                                  <Input placeholder="예: 영어책 10권 읽기" {...field} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="iconName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>아이콘</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="아이콘 선택" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {IconKeys.map(iconKey => {
                                const Icon = ICONS[iconKey];
                                return <SelectItem key={iconKey} value={iconKey}><div className="flex items-center gap-2"><Icon className="h-4 w-4"/> {iconKey}</div></SelectItem>
                              })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
              </div>
              <FormField
                  control={form.control}
                  name="requirements"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>인증 기준 설명</FormLabel>
                          <FormControl>
                              <Textarea placeholder="학생에게 보여질 인증 기준을 설명해주세요." {...field} />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="goalType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>목표 유형</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="목표 유형 선택" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="numeric">학생 입력형 (숫자 목표)</SelectItem>
                            <SelectItem value="objective">교사 입력형 (선택형)</SelectItem>
                          </SelectContent>
                        </Select>
                         <FormDescription className="text-xs">
                          {goalType === 'numeric' ? '학생이 활동을 제출하고, 승인 시 카운트가 올라갑니다.' : '교사가 관리자 페이지에서 직접 등급 등을 선택합니다.'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                      control={form.control}
                      name="unit"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>단위</FormLabel>
                              <FormControl>
                                  <Input placeholder={goalType === 'numeric' ? "예: 권, 시간, 회" : "예: 등급, 레벨"} {...field} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
              </div>

              {goalType === 'numeric' && (
                <div className="space-y-2 p-4 border rounded-md">
                    <Label>학년별 목표량</Label>
                    <div className="grid grid-cols-3 gap-4">
                        {['4', '5', '6'].map(grade => (
                             <FormField
                                key={grade}
                                control={form.control}
                                name={`goal.${grade as '4'|'5'|'6'}`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-normal">{grade}학년</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} onChange={event => field.onChange(+event.target.value)} />
                                        </FormControl>
                                         <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ))}
                    </div>
                </div>
              )}

              {goalType === 'objective' && (
                <div className="space-y-2 p-4 border rounded-md">
                    <Label>선택지 목록</Label>
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-2">
                           <FormField
                                control={form.control}
                                name={`options.${index}.value`}
                                render={({ field }) => (
                                    <FormItem className="flex-grow">
                                        <FormControl>
                                            <Input placeholder={`옵션 ${index + 1}`} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                                <Trash2 className="h-4 w-4"/>
                            </Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ value: '' })}>
                        <PlusCircle className="mr-2"/> 옵션 추가
                    </Button>
                </div>
              )}

              <FormField
                  control={form.control}
                  name="externalUrl"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>바로가기 URL (선택)</FormLabel>
                          <FormControl>
                              <Input type="url" placeholder="https://... (비워두면 삭제됨)" {...field} />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )}
              />
              
              <div className="p-4 border rounded-md space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">세부 설정</h4>
                  {goalType === 'numeric' &&
                  <>
                  <FormField
                    control={form.control}
                    name="showInGallery"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                         <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            도전 갤러리에 활동 내용 공개
                          </FormLabel>
                          <FormDescription className="text-xs">이 옵션을 끄면, 학생 제출물은 교사만 검토할 수 있고 갤러리에는 표시되지 않습니다.</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mediaRequired"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                         <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            미디어(사진/영상) 제출 필수
                          </FormLabel>
                          <FormDescription className="text-xs">학생이 활동 내용을 제출할 때 사진이나 영상 첨부를 필수로 만듭니다.</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="autoApprove"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                         <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            AI 자동 인증 활성화
                          </FormLabel>
                           <FormDescription className="text-xs">AI가 학생의 제출 내용을 분석하여 자동으로 승인/반려합니다.</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="aiVisionCheck"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                         <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={!autoApproveEnabled}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className={cn(!autoApproveEnabled && "text-muted-foreground")}>
                            AI Vision으로 사진/영상 분석
                          </FormLabel>
                           <FormDescription className={cn("text-xs", !autoApproveEnabled && "text-muted-foreground/50")}>
                            AI가 제출된 미디어를 직접 보고 내용을 판단합니다.
                           </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  {aiVisionEnabled && autoApproveEnabled && (
                     <FormField
                        control={form.control}
                        name="aiVisionPrompt"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>AI Vision 판단 기준</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="AI에게 미디어를 보고 판단할 기준을 자세히 설명해주세요. 예: 타자 연습 결과 화면에서 '현재 타수'가 200 이상인지 확인해주세요." {...field} />
                                </FormControl>
                                <Alert variant="default" className="mt-2">
                                  <Info className="h-4 w-4" />
                                  <AlertTitle className="text-xs font-semibold">작성 팁!</AlertTitle>
                                  <AlertDescription className="text-xs">
                                    AI가 무엇을, 어떻게, 어떤 기준으로 판단해야 할지 명확하고 구체적으로 작성할수록 정확도가 올라갑니다.
                                  </AlertDescription>
                                </Alert>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                  )}
                  </>
                  }
                  {goalType !== 'numeric' &&
                    <p className="text-sm text-muted-foreground">교사 입력형은 교사가 직접 관리하므로 추가 설정이 필요 없습니다.</p>
                  }
              </div>
                
              <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">취소</Button></DialogClose>
                  <Button type="submit" disabled={loading}>
                      {loading ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>}
                      저장하기
                  </Button>
              </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
