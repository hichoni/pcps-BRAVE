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
import { Loader2, PlusCircle, Trash2, Save } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { ICONS, AreaName, StoredAreaConfig } from '@/lib/config';

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
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'options'
  });

  const goalType = form.watch('goalType');
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
        options: area.config.options?.map(o => ({ value: o })) || []
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
      });
    }
  }, [area, form, open]);
  
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? '도전 영역 수정' : '새 도전 영역 추가'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? '도전 영역의 세부 정보를 수정합니다.' : '새로운 도전 영역을 만들고 설정을 입력합니다.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              <FormField
                control={form.control}
                name="goalType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>목표 유형</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="목표 유형 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="numeric">숫자 목표형</SelectItem>
                        <SelectItem value="objective">객관식 선택형</SelectItem>
                      </SelectContent>
                    </Select>
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
