"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useChallengeConfig, StoredChallengeConfig, StoredAreaConfig, ChallengeConfig } from '@/context/ChallengeConfigContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Settings, ArrowLeft } from 'lucide-react';
import { AreaName, AREAS } from '@/lib/config';

// This is the editor component that only renders when the config is fully loaded.
function ChallengeConfigEditor({ initialConfig }: { initialConfig: ChallengeConfig }) {
  const router = useRouter();
  const { updateChallengeConfig } = useChallengeConfig();
  const { toast } = useToast();
  
  const [localConfig, setLocalConfig] = useState<StoredChallengeConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Use an effect to safely initialize and sync the local state from props.
  // This is a more robust pattern than using a complex function in a useState initializer,
  // and it helps prevent potential server-client hydration mismatches.
  useEffect(() => {
    if (initialConfig) {
      const editableConfig: any = {};
      AREAS.forEach(area => {
        const config = initialConfig[area];
        if (config) {
          const { icon, name, ...rest } = config;
          // The `...rest` will contain everything from AreaConfig except icon and name,
          // which matches the structure needed for StoredChallengeConfig (since iconName is part of the spread)
          editableConfig[area] = rest;
        }
      });
      setLocalConfig(editableConfig);
    }
  }, [initialConfig]);

  const handleInputChange = (area: AreaName, field: keyof Omit<StoredAreaConfig, 'goal'>, value: string) => {
    setLocalConfig(prev => {
        if (!prev) return null;
        const areaConf = prev[area] || {};
        return {
            ...prev,
            [area]: { ...areaConf, [field]: value }
        }
    });
  };

  const handleGoalChange = (area: AreaName, grade: string, value: string) => {
    const numValue = Number(value);
    if (isNaN(numValue)) return;

    setLocalConfig(prev => {
        if (!prev) return null;
        const areaConf = prev[area];
        if (!areaConf) return prev;
        const newGoals = { ...areaConf.goal, [grade]: numValue };
        return { ...prev, [area]: { ...areaConf, goal: newGoals } };
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

  // The parent component already shows a loader, but we add this as an extra guard
  // to ensure localConfig is initialized before rendering the form. Returning null is safe
  // because the parent loader will be visible.
  if (!localConfig) {
    return null; 
  }

  const GRADES = ['4', '5', '6'];

  return (
    <>
      <header className="flex justify-between items-center mb-8 pb-4 border-b">
        <h1 className="text-2xl sm:text-3xl font-bold font-headline text-primary flex items-center gap-2"><Settings/> 도전 영역 관리</h1>
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
        {AREAS.map(area => {
            const areaConfig = initialConfig[area];
            const localAreaConfig = localConfig?.[area];
            if (!areaConfig || !localAreaConfig) return null;

            return (
              <Card key={area} className="shadow-md border hover:shadow-lg transition-shadow">
                  <CardHeader>
                      <CardTitle>{areaConfig.koreanName}</CardTitle>
                      <CardDescription>{areaConfig.name}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="space-y-2">
                          <Label htmlFor={`koreanName-${area}`}>영역 이름 (한국어)</Label>
                          <Input id={`koreanName-${area}`} value={localAreaConfig.koreanName || ''} onChange={(e) => handleInputChange(area, 'koreanName', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor={`challengeName-${area}`}>도전 과제 이름</Label>
                          <Input id={`challengeName-${area}`} value={localAreaConfig.challengeName || ''} onChange={(e) => handleInputChange(area, 'challengeName', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label>목표량 (학년별)</Label>
                          <div className="grid grid-cols-3 gap-4">
                            {GRADES.map(grade => (
                              <div key={grade} className="space-y-1">
                                <Label htmlFor={`goal-${area}-${grade}`} className="text-sm font-normal">{grade}학년</Label>
                                <Input id={`goal-${area}-${grade}`} type="number" value={localAreaConfig.goal?.[grade] ?? ''} onChange={(e) => handleGoalChange(area, grade, e.target.value)} />
                              </div>
                            ))}
                          </div>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor={`unit-${area}`}>단위</Label>
                          <Input id={`unit-${area}`} value={localAreaConfig.unit || ''} onChange={(e) => handleInputChange(area, 'unit', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor={`requirements-${area}`}>인증 기준 설명</Label>
                          <Textarea id={`requirements-${area}`} value={localAreaConfig.requirements || ''} onChange={(e) => handleInputChange(area, 'requirements', e.target.value)} rows={4}/>
                      </div>
                  </CardContent>
              </Card>
            )
        })}
      </div>
    </>
  );
}

export default function ChallengeConfigPage() {
  const { user, loading: authLoading } = useAuth();
  const { challengeConfig, loading: configLoading } = useChallengeConfig();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !authLoading && user?.role !== 'teacher') {
      router.push('/login');
    }
  }, [user, authLoading, router, isClient]);

  if (!isClient || authLoading || configLoading || !user || !challengeConfig) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <ChallengeConfigEditor initialConfig={challengeConfig} />
    </div>
  );
}
