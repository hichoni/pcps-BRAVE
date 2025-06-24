
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
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
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
        let text = e.target?.result as string;
        if (!text) {
            toast({ variant: 'destructive', title: '파일 오류', description: '파일 내용을 읽을 수 없습니다.' });
            setLoading(false);
            return;
        }

        // Remove BOM (Byte Order Mark) if present
        if (text.charCodeAt(0) === 0xFEFF) {
            text = text.substring(1);
        }
        
        // Normalize line endings, then split into lines and filter out empty ones
        const lines = text.replace(/\r\n|\r/g, '\n').split('\n');
        const dataLines = lines.filter(line => line.trim() !== '');

        if (dataLines.length === 0) {
            toast({ variant: 'destructive', title: '파일 오류', description: '파일이 비어있거나 내용이 없습니다.' });
            setLoading(false);
            return;
        }
        
        let headerIndex = -1;
        if (dataLines[0].includes('학년')) {
            headerIndex = 0;
        }
        const studentDataLines = headerIndex === 0 ? dataLines.slice(1) : dataLines;
        
        if (studentDataLines.length === 0) {
            toast({ variant: 'destructive', title: '데이터 오류', description: '헤더만 있고 학생 데이터가 없습니다.' });
            setLoading(false);
            return;
        }

        const delimiter = studentDataLines[0].includes(';') ? ';' : ',';

        const studentsToAdd: StudentData[] = [];
        const parseErrors: string[] = [];

        studentDataLines.forEach((line, index) => {
            const lineNumber = headerIndex === 0 ? index + 2 : index + 1;
            const parts = line.split(delimiter).map(p => p.trim().replace(/^"|"$/g, ''));
            
            if (parts.length !== 4) {
                parseErrors.push(`[${lineNumber}번째 줄] 형식 오류: '학년,반,번호,이름' 4개 항목이 필요합니다. (입력된 내용: "${line}")`);
                return;
            }

            const [gradeStr, classNumStr, studentNumStr, name] = parts;
            const grade = parseInt(gradeStr, 10);
            const classNum = parseInt(classNumStr, 10);
            const studentNum = parseInt(studentNumStr, 10);

            if (isNaN(grade) || isNaN(classNum) || isNaN(studentNum) || !name.trim()) {
                parseErrors.push(`[${lineNumber}번째 줄] 데이터 오류: 학년, 반, 번호가 숫자인지, 이름이 비어있지 않은지 확인해주세요. (입력된 내용: "${line}")`);
                return;
            }
            
            studentsToAdd.push({ grade, classNum, studentNum, name });
        });

        if (parseErrors.length > 0) {
            toast({
                variant: 'destructive',
                title: '입력 데이터 오류',
                duration: 15000,
                description: (
                    <div className="text-sm">
                        <p>CSV 파일 처리 중 오류가 발생했습니다. 아래 내용을 수정 후 다시 시도해주세요:</p>
                        <ul className="list-disc pl-5 mt-2 max-h-40 overflow-y-auto font-mono text-xs">
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
                description: '추가할 학생 정보가 없습니다. 파일 내용을 확인해주세요.'
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
                duration: 15000,
                description: (
                     <div className="text-sm">
                        <p>일부 학생 등록에 실패했습니다:</p>
                        <ul className="list-disc pl-5 mt-2 max-h-32 overflow-y-auto font-mono text-xs">
                            {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                    </div>
                )
             });
           }, 500)
        }

        setSelectedFile(null);
        if (document.getElementById('student-file')) {
            (document.getElementById('student-file') as HTMLInputElement).value = '';
        }
        if (result.successCount > 0) {
            onOpenChange(false);
        }
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
        if (document.getElementById('student-file')) {
            (document.getElementById('student-file') as HTMLInputElement).value = '';
        }
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
                    <p>엑셀, 구글 시트 등에서 예시 파일과 같이 4개 열(학년, 반, 번호, 이름)을 작성한 후, CSV 형식으로 저장하여 업로드해주세요.</p>
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
                    accept=".csv,text/csv"
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
