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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Info, Download, FileText } from 'lucide-react';
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDownloadExample = () => {
    const csvHeader = "학년,반,번호,이름";
    const csvExample = "4,1,1,김철수\n4,1,2,이영희\n5,2,3,박바둑";
    const csvContent = `${csvHeader}\n${csvExample}`;
    // Add BOM for Excel to recognize UTF-8 encoding correctly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "학생_일괄등록_예시.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      if (file.type !== 'text/csv') {
        toast({ variant: 'destructive', title: '파일 형식 오류', description: 'CSV 파일만 업로드할 수 있습니다.' });
        event.target.value = ''; // Reset file input
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
        toast({ variant: 'destructive', title: '파일 오류', description: '업로드할 CSV 파일을 선택해주세요.' });
        return;
    }

    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target?.result as string;
        if (!text) {
            toast({ variant: 'destructive', title: '파일 오류', description: '파일 내용을 읽을 수 없습니다.' });
            setLoading(false);
            return;
        }

        const lines = text.trim().split(/\r\n|\n/);
        // Remove header row if it exists
        if (lines[0] && lines[0].includes('학년')) {
            lines.shift();
        }

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

        setSelectedFile(null);
        onOpenChange(false);
        setLoading(false);
    };

    reader.onerror = () => {
        toast({ variant: 'destructive', title: '파일 오류', description: '파일을 읽는 중에 오류가 발생했습니다.' });
        setLoading(false);
    };

    reader.readAsText(selectedFile, 'UTF-8');
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
        setSelectedFile(null);
    }
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>학생 일괄 등록</DialogTitle>
          <DialogDescription>
            CSV 파일을 업로드하여 여러 학생을 한 번에 등록합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>파일 형식 안내</AlertTitle>
                <AlertDescription>
                    <p>예시 파일을 다운로드하여 형식을 확인해주세요. 파일은 쉼표(,)로 구분된 CSV 형식이어야 합니다.</p>
                </AlertDescription>
            </Alert>
            
            <Button variant="outline" onClick={handleDownloadExample} className="w-full">
                <Download className="mr-2" /> 예시 CSV 파일 다운로드
            </Button>

            <div className="space-y-2">
                <Label htmlFor="student-file">CSV 파일 업로드</Label>
                <Input 
                    id="student-file" 
                    type="file" 
                    accept=".csv"
                    onChange={handleFileChange}
                    disabled={loading}
                    className="file:font-semibold file:text-primary"
                />
                {selectedFile && (
                    <div className="text-sm text-muted-foreground flex items-center gap-2 pt-2">
                        <FileText className="h-4 w-4"/>
                        <span>{selectedFile.name}</span>
                    </div>
                )}
            </div>
        </div>
        <DialogFooter>
            <DialogClose asChild>
                <Button variant="outline" disabled={loading}>취소</Button>
            </DialogClose>
          <Button onClick={handleSubmit} disabled={loading || !selectedFile}>
            {loading ? <Loader2 className="animate-spin mr-2" /> : <Upload className="mr-2" />}
            등록하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
