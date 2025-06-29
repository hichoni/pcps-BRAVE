"use client";

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ExternalLink } from 'lucide-react';

interface ExternalUrlDialogProps {
  url: string;
  areaName: string;
}

export function ExternalUrlDialog({ url, areaName }: ExternalUrlDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" title={`${areaName} 관련 사이트 바로가기`}>
          <ExternalLink className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-2 sm:p-4">
        <DialogHeader className="p-4 pb-2 shrink-0">
          <DialogTitle className="font-headline text-xl sm:text-2xl">{areaName} 바로가기</DialogTitle>
          <DialogDescription>
            아래 창이 보이지 않으면,{' '}
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
              새 탭에서 열기
            </a>
            를 눌러주세요.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow rounded-lg overflow-hidden border">
          <iframe
            src={url}
            title={areaName}
            className="w-full h-full"
            allow="camera; microphone;"
          />
        </div>
        <DialogFooter className="p-4 pt-2">
          <DialogClose asChild>
              <Button type="button" className="w-full">닫기</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
