"use client";

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, ShieldAlert } from 'lucide-react';

interface BulkDeleteStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkDeleteStudentsDialog({ open, onOpenChange }: BulkDeleteStudentsDialogProps) {
  const { bulkDeleteUsers, users } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState(''); // 'all', '4', '5', '6'
  const [confirmationText, setConfirmationText] = useState('');
  const CONFIRMATION_PHRASE = "학생정보삭제";

  const studentUsers = users.filter(u => u.role === 'student');
  const availableGrades = [...new Set(studentUsers.map(u => u.grade))].sort((a,b) => (a ?? 0) - (b ?? 0));

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setScope('');
      setConfirmationText('');
      setLoading(false);
    }
    onOpenChange(isOpen);
  };

  const handleDelete = async () => {
    if (confirmationText !== CONFIRMATION_PHRASE) {
      toast({ variant: 'destructive', title: '확인 문구 불일치', description: `삭제를 원하시면 '${CONFIRMATION_PHRASE}'를 정확하게 입력해주세요.` });
      return;
    }
    if (!scope) {
        toast({ variant: 'destructive', title: '삭제 범위 미선택', description: '삭제할 범위를 선택해주세요.' });
        return;
    }

    setLoading(true);
    try {
      const gradeToDelete = scope === 'all' ? undefined : parseInt(scope, 10);
      const result = await bulkDeleteUsers({ grade: gradeToDelete });

      toast({ title: '삭제 완료', description: `${result.deletedCount}명의 학생 정보가 삭제되었습니다.` });
      handleOpenChange(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: '오류', description: error.message });
      setLoading(false);
    }
  };

  const getTargetDescription = () => {
    if (!scope) return "선택되지 않음";
    if (scope === 'all') return `모든 학년 (${studentUsers.length}명)`;
    const gradeCount = studentUsers.filter(u => u.grade === parseInt(scope, 10)).length;
    return `${scope}학년 전체 (${gradeCount}명)`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>학생 일괄 삭제</DialogTitle>
          <DialogDescription>
            선택한 범위의 모든 학생 정보를 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="delete-scope">삭제 범위 선택</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger id="delete-scope">
                <SelectValue placeholder="삭제할 범위를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 학생</SelectItem>
                {availableGrades.map(grade => (
                  grade != null && <SelectItem key={grade} value={String(grade)}>{grade}학년 전체</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>경고: 되돌릴 수 없는 작업</AlertTitle>
            <AlertDescription>
              삭제 대상: <span className="font-bold">{getTargetDescription()}</span>.
              <br/>
              해당 학생들의 모든 성취 기록과 갤러리 게시물도 함께 영구적으로 삭제됩니다.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="confirmation-text">확인 문구 입력</Label>
            <p className="text-sm text-muted-foreground">
              삭제를 진행하려면 아래 칸에 <strong className="text-destructive">{CONFIRMATION_PHRASE}</strong> 라고 정확히 입력해주세요.
            </p>
            <Input 
              id="confirmation-text" 
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder={CONFIRMATION_PHRASE}
              disabled={!scope}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>취소</Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={loading || confirmationText !== CONFIRMATION_PHRASE || !scope}
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : <Trash2 className="mr-2" />}
            삭제 실행
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
