
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useChallengeConfig, ChallengeConfig } from '@/context/ChallengeConfigContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Settings, ArrowLeft, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { AreaName, StoredAreaConfig } from '@/lib/config';
import { AddEditAreaDialog } from '@/components/AddEditAreaDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

function ChallengeList() {
  const { challengeConfig, deleteArea, loading } = useChallengeConfig();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<{ id: AreaName, config: StoredAreaConfig } | null>(null);
  const [deletingArea, setDeletingArea] = useState<{ id: AreaName, config: StoredAreaConfig } | null>(null);

  const handleEdit = (areaId: AreaName, areaConfig: StoredAreaConfig) => {
    setEditingArea({ id: areaId, config: areaConfig });
    setDialogOpen(true);
  };
  
  const handleAddNew = () => {
    setEditingArea(null);
    setDialogOpen(true);
  };
  
  const handleDelete = async () => {
    if (!deletingArea) return;
    try {
      await deleteArea(deletingArea.id);
      toast({ title: '성공', description: '도전 영역이 삭제되었습니다.' });
    } catch (error) {
      toast({ variant: 'destructive', title: '오류', description: '삭제에 실패했습니다.' });
    } finally {
      setDeletingArea(null);
    }
  };

  if (loading || !challengeConfig) {
      return <div className="flex h-64 w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  const challengeAreaKeys = Object.keys(challengeConfig).sort();

  return (
    <AlertDialog onOpenChange={(open) => !open && setDeletingArea(null)}>
      <div className="flex justify-end mb-6">
        <Button onClick={handleAddNew}>
          <PlusCircle className="mr-2" /> 새 도전 영역 추가
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {challengeAreaKeys.map(areaId => {
            const areaConfig = challengeConfig[areaId];
            if (!areaConfig) return null;
            const { icon, name, ...storedConfig } = areaConfig;

            return (
              <Card key={areaId} className="shadow-md border hover:shadow-lg transition-shadow">
                  <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle>{areaConfig.koreanName}</CardTitle>
                        <div className="flex gap-2">
                           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleEdit(areaId, storedConfig)}>
                                <Edit className="h-4 w-4" />
                           </Button>
                           <AlertDialogTrigger asChild>
                               <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => setDeletingArea({ id: areaId, config: storedConfig })}>
                                   <Trash2 className="h-4 w-4" />
                               </Button>
                           </AlertDialogTrigger>
                        </div>
                      </div>
                      <CardDescription>{areaConfig.challengeName}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                      <p><strong>유형:</strong> {areaConfig.goalType === 'numeric' ? '숫자 목표형' : '객관식 선택형'}</p>
                      {areaConfig.goalType === 'numeric' ? (
                        <p><strong>학년별 목표:</strong> {Object.entries(areaConfig.goal).map(([grade, g]) => `${grade}학년(${g}${areaConfig.unit})`).join(', ')}</p>
                      ) : (
                        <p><strong>선택지:</strong> {areaConfig.options?.join(', ')}</p>
                      )}
                      <p><strong>인증 기준:</strong> {areaConfig.requirements}</p>
                  </CardContent>
              </Card>
            )
        })}
      </div>
      <AddEditAreaDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        area={editingArea}
      />
      
      <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                    {deletingArea && `'${deletingArea.config.koreanName}'`} 도전 영역을 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없으며, 학생들의 관련 성취 데이터도 더 이상 표시되지 않을 수 있습니다.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                    삭제
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
  );
}

export default function ChallengeConfigPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !authLoading) {
      if (user?.role !== 'teacher') {
        router.push('/login');
      } else if (user.areaName) {
        toast({
            variant: 'destructive',
            title: '접근 불가',
            description: '이 페이지는 마스터 관리자만 접근할 수 있습니다.',
        });
        router.push('/admin');
      }
    }
  }, [user, authLoading, router, isClient, toast]);

  if (!isClient || authLoading || !user || user.areaName) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b">
        <h1 className="text-2xl sm:text-3xl font-bold font-headline text-primary flex items-center gap-2"><Settings/> 도전 영역 관리</h1>
        <Button variant="outline" onClick={() => router.push('/admin')} className="self-end sm:self-auto">
            <ArrowLeft className="mr-2"/> 학생 관리로
        </Button>
      </header>
      <ChallengeList />
    </div>
  );
}
