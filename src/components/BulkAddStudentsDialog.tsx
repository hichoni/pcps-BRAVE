"use client";

import { useState } from 'react';
import { useAuth, User } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface BulkAddStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type StudentData = Pick<User, 'grade' | 'classNum' | 'studentNum' | 'name'>;

export function BulkAddStudentsDialog({ open, onOpenChange }: BulkAddStudentsDialogProps) {
  const { bulkAddUsers } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [csvData, setCsvData] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    
    const lines = csvData.trim().split('\n');
    const studentsToAdd: StudentData[] = [];
    const parseErrors: string[] = [];

    lines.forEach((line, index) => {
        if (line.trim() === '') return;
        const parts = line.split(',').map(p => p.trim());
        if (parts.length !== 4) {
            parseErrors.push(`${index + 1}번째 줄: 형식이 올바르지 않습니다 (학년,반,번호,이름).`);
            return;
        }

        const [gradeStr, classNumStr, studentNumStr, name] = parts;
        const grade = parseInt(gradeStr, 10);
        const classNum = parseInt(classNumStr, 10);
        const studentNum = parseInt(studentNumStr, 10);

        if (isNaN(grade) || isNaN(classNum) || isNaN(studentNum) || !name) {
            parseErrors.push(`${index + 1}번째 줄: 데이터가 유효하지 않습니다.`);
            return;
        }
        
        studentsToAdd.push({ grade, classNum, studentNum, name });
    });

    if (parseErrors.length > 0) {
        toast({
            variant: 'destructive',
            title: '입력 데이터 오류',
            duration: 8000,
            description: (
                <div className="text-sm">
                    <p>데이터 파싱 중 오류가 발생했습니다:</p>
                    <ul className="list-disc pl-5 mt-2 max-h-20 overflow-y-auto">
                        {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                </div>
            )
        });
        setLoading(false);
        return;
    }

    if (studentsToAdd.length === 0) {
        toast({
            variant: 'destructive',
            title: '오류',
            description: '추가할 학생 정보가 없습니다.'
        });
        setLoading(false);
        return;
    }

    const result = await bulkAddUsers(studentsToAdd);

    toast({
        title: '일괄 등록 완료',
        description: `성공: ${result.successCount}명, 실패: ${result.failCount}명.`
    });

    if (result.errors.length > 0) {
       setTimeout(() => {
         toast({
            variant: 'destructive',
            title: '등록 실패 상세',
            duration: 8000,
            description: (
                 <div className="text-sm">
                    <p>일부 학생 등록에 실패했습니다:</p>
                    <ul className="list-disc pl-5 mt-2 max-h-20 overflow-y-auto">
                        {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                </div>
            )
         });
       }, 500)
    }

    setCsvData('');
    onOpenChange(false);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>학생 일괄 등록</DialogTitle>
          <DialogDescription>
            아래 형식에 맞춰 학생 정보를 입력해주세요. 한 줄에 한 명씩 추가됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>입력 형식 안내</AlertTitle>
                <AlertDescription>
                    <p className="font-mono text-sm">학년,반,번호,이름</p>
                    <p>예시: 4,1,15,홍길동</p>
                </AlertDescription>
            </Alert>

            <Textarea
                placeholder="4,1,1,김철수&#10;4,1,2,이영희&#10;5,2,3,박바둑"
                rows={8}
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                disabled={loading}
            />
        </div>
        <DialogFooter>
            <DialogClose asChild>
                <Button variant="outline" disabled={loading}>취소</Button>
            </DialogClose>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="animate-spin mr-2" /> : <Upload className="mr-2" />}
            등록하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
