"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useChallengeConfig, StoredChallengeConfig, StoredAreaConfig } from '@/context/ChallengeConfigContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Settings, ArrowLeft } from 'lucide-react';
import { AreaName, AREAS } from '@/lib/config';


export default function ChallengeConfigPage() {
  const { user, loading: authLoading } = useAuth();
  const { challengeConfig, updateChallengeConfig, loading: configLoading } = useChallengeConfig();
  const router = useRouter();
  const { toast } = useToast();

  const [localConfig, setLocalConfig] = useState<StoredChallengeConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && user?.role !== 'teacher') {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (challengeConfig) {
      // Create a deep copy for local editing, removing the unserializable 'icon' and 'name' properties
      const editableConfig: any = {};
      AREAS.forEach(area => {
        const { icon, name, ...rest } = challengeConfig[area];
        editableConfig[area] = rest;
      })
      setLocalConfig(editableConfig);
    }
  }, [challengeConfig]);

  const handleInputChange = (area: AreaName, field: keyof Omit<StoredAreaConfig, 'goal'>, value: string) => {
    if (!localConfig) return;

    setLocalConfig(prev => {
        if (!prev) return null;
        return {
            ...prev,
            [area]: {
                ...prev[area],
                [field]: value
            }
        };
    });
  };

  const handleGoalChange = (area: AreaName, grade: string, value: string) => {
    if (!localConfig) return;
    const numValue = Number(value);
    if (isNaN(numValue)) return;

    setLocalConfig(prev => {
        if (!prev) return null;
        const newGoals = { ...prev[area].goal, [grade]: numValue };
        return {
            ...prev,
            [area]: {
                ...prev[area],
                goal: newGoals
            }
        };
    });
  };

  const handleSaveChanges = async () => {
    if (!localConfig) return;
    setIsSaving(true);
    try {
      await updateChallengeConfig(localConfig);
      toast({ title: '성공', description: '도전 영역 설정이 저장되었습니다.' });
    } catch (error) {
      toast({ variant: 'destructive', title: '오류', description: '설정 저장에 실패했습니다.' });
    } finally {
        setIsSaving(false);
    }
  };
  
  if (authLoading || configLoading || !user || !localConfig || !challengeConfig) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const GRADES = ['4', '5', '6'];

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex justify-between items-center mb-8 pb-4 border-b">
        <h1 className="text-3xl font-bold font-headline text-primary flex items-center gap-2"><Settings/> 도전 영역 관리</h1>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push('/admin')}>
                <ArrowLeft className="mr-2"/> 관리자 페이지로
            </Button>
            <Button onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>}
                변경사항 저장
            </Button>
        </div>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {AREAS.map(area => (
            <Card key={area}>
                <CardHeader>
                    <CardTitle>{challengeConfig[area].koreanName}</CardTitle>
                    <CardDescription>{challengeConfig[area].name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor={`koreanName-${area}`}>영역 이름 (한국어)</Label>
                        <Input id={`koreanName-${area}`} value={localConfig[area].koreanName} onChange={(e) => handleInputChange(area, 'koreanName', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`challengeName-${area}`}>도전 과제 이름</Label>
                        <Input id={`challengeName-${area}`} value={localConfig[area].challengeName} onChange={(e) => handleInputChange(area, 'challengeName', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>목표량 (학년별)</Label>
                        <div className="grid grid-cols-3 gap-4">
                          {GRADES.map(grade => (
                            <div key={grade} className="space-y-1">
                              <Label htmlFor={`goal-${area}-${grade}`} className="text-sm font-normal">{grade}학년</Label>
                              <Input id={`goal-${area}-${grade}`} type="number" value={localConfig[area].goal[grade] ?? ''} onChange={(e) => handleGoalChange(area, grade, e.target.value)} />
                            </div>
                          ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`unit-${area}`}>단위</Label>
                        <Input id={`unit-${area}`} value={localConfig[area].unit} onChange={(e) => handleInputChange(area, 'unit', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`requirements-${area}`}>인증 기준 설명</Label>
                        <Textarea id={`requirements-${area}`} value={localConfig[area].requirements} onChange={(e) => handleInputChange(area, 'requirements', e.target.value)} rows={4}/>
                    </div>
                </CardContent>
            </Card>
        ))}
      </div>
    </div>
  );
}
