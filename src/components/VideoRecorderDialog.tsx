"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Video, Camera, Mic, StopCircle, RefreshCcw, Send } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { cn } from '@/lib/utils';

interface VideoRecorderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVideoRecorded: (file: File) => void;
}

type RecordingState = 'idle' | 'recording' | 'preview';

export function VideoRecorderDialog({ open, onOpenChange, onVideoRecorded }: VideoRecorderDialogProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [hasPermission, setHasPermission] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);

  const cleanup = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
    }
    recordedChunksRef.current = [];
    setRecordingState('idle');
  };
  
  const setupStream = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast({ variant: 'destructive', title: '카메라 기능 미지원', description: '사용 중인 브라우저에서 카메라 녹화 기능을 지원하지 않습니다.' });
        return;
      }
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasPermission(true);
      } catch (error) {
        console.error('Error accessing camera/mic:', error);
        setHasPermission(false);
        toast({
          variant: 'destructive',
          title: '카메라/마이크 접근 거부됨',
          description: '영상 녹화를 사용하려면 브라우저 설정에서 카메라와 마이크 권한을 허용해주세요.',
          duration: 9000,
        });
        onOpenChange(false);
      }
    };
  
  useEffect(() => {
    if (open && recordingState === 'idle') {
      setupStream();
    }
    
    // Cleanup on unmount or close
    return () => {
      if (open) {
        cleanup();
      }
    };
  }, [open, recordingState]);


  const startRecording = () => {
    if (!videoRef.current?.srcObject) return;
    
    recordedChunksRef.current = [];
    const stream = videoRef.current.srcObject as MediaStream;
    // Attempt to use a common format if possible
    const options = { mimeType: 'video/webm; codecs=vp9' };
    try {
        mediaRecorderRef.current = new MediaRecorder(stream, options);
    } catch(e) {
        console.warn("video/webm; codecs=vp9 not supported, falling back.");
        mediaRecorderRef.current = new MediaRecorder(stream);
    }

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordedVideoUrl(url);
      setRecordingState('preview');
    };

    mediaRecorderRef.current.start();
    setRecordingState('recording');
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };
  
  const handleRetake = () => {
    cleanup();
    setupStream();
  };

  const handleUseVideo = () => {
    if (!recordedVideoUrl) return;
    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
    const file = new File([blob], `recorded-video-${Date.now()}.webm`, { type: 'video/webm' });
    onVideoRecorded(file);
    cleanup();
  };
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) cleanup(); onOpenChange(isOpen); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>영상 바로 찍기</DialogTitle>
          <DialogDescription>
            활동 내용을 영상으로 녹화하여 바로 제출합니다.
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-4 aspect-video w-full bg-black rounded-md overflow-hidden flex items-center justify-center">
            <video 
                ref={videoRef} 
                className={cn("w-full h-full object-cover", recordingState === 'preview' && 'hidden')} 
                autoPlay 
                muted 
                playsInline
            />
            {recordingState === 'preview' && recordedVideoUrl && (
                <video 
                    src={recordedVideoUrl} 
                    className="w-full h-full object-cover" 
                    controls 
                    autoPlay
                />
            )}
             {!hasPermission && recordingState === 'idle' && (
                <div className="text-white text-center p-4">
                    <Loader2 className="animate-spin mb-2" />
                    <p>카메라 권한을 확인하고 있습니다...</p>
                </div>
            )}
        </div>
        
        <DialogFooter>
          {recordingState === 'idle' && (
            <Button onClick={startRecording} disabled={!hasPermission} className="w-full">
              <Camera className="mr-2" /> 녹화 시작
            </Button>
          )}
          {recordingState === 'recording' && (
            <Button onClick={stopRecording} variant="destructive" className="w-full">
              <StopCircle className="mr-2 animate-pulse" /> 녹화 중지
            </Button>
          )}
          {recordingState === 'preview' && (
            <div className="w-full flex gap-2">
              <Button onClick={handleRetake} variant="outline" className="flex-1">
                <RefreshCcw className="mr-2" /> 다시 찍기
              </Button>
              <Button onClick={handleUseVideo} className="flex-1">
                <Send className="mr-2" /> 이 영상 사용하기
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
