"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Camera, StopCircle, RefreshCcw, Send } from 'lucide-react';
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
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    // Stop camera/mic stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);

    // Stop media recorder if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    // Clear timeout
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
    recordingTimeoutRef.current = null;

    // Revoke object URL
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
    }
    setRecordedVideoUrl(null);
    recordedChunksRef.current = [];
    
    // Reset state
    setRecordingState('idle');
  }, [stream, recordedVideoUrl]);

  // Effect to handle dialog open/close
  useEffect(() => {
    if (open) {
      const initializeCamera = async () => {
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          setStream(newStream);
        } catch (error) {
          console.error('Error accessing camera/mic:', error);
          toast({
            variant: 'destructive',
            title: '카메라/마이크 접근 거부됨',
            description: '영상 녹화를 사용하려면 브라우저 설정에서 카메라와 마이크 권한을 허용해주세요.',
            duration: 9000,
          });
          onOpenChange(false);
        }
      };
      initializeCamera();
    } else {
      cleanup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Effect to attach stream to video element when available
  useEffect(() => {
    if (stream && videoRef.current && recordingState === 'idle') {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Video play failed:", e));
    }
  }, [stream, recordingState]);

  const stopRecording = useCallback(() => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);
  
  const startRecording = useCallback(() => {
    if (!stream) return;
    
    setRecordingState('recording');
    recordedChunksRef.current = [];
    
    try {
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener('stop', () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setRecordingState('preview');
        
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        setStream(null);
      });

      recorder.start();
      recordingTimeoutRef.current = setTimeout(stopRecording, 5 * 60 * 1000);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: '녹화 시작 실패',
        description: '이 브라우저에서는 녹화 기능을 지원하지 않습니다.',
      });
      setRecordingState('idle');
    }
  }, [stream, toast, stopRecording]);
  
  const handleRetake = () => {
    cleanup();
    onOpenChange(true); // Re-triggers the open effect to get a new stream
  };

  const handleUseVideo = useCallback(() => {
    if (!recordedVideoUrl) return;

    const mimeType = mediaRecorderRef.current?.mimeType || 'video/webm';
    const getFileExtension = (type: string) => {
      const parts = type.split(';')[0].split('/');
      return parts[1] || 'webm';
    }
    const extension = getFileExtension(mimeType);
    
    const blob = new Blob(recordedChunksRef.current, { type: mimeType });
    const file = new File([blob], `recorded-video-${Date.now()}.${extension}`, { type: mimeType });
    onVideoRecorded(file);
  }, [recordedVideoUrl, onVideoRecorded]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>영상 바로 찍기</DialogTitle>
          <DialogDescription>
            최대 5분까지 녹화할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-4 aspect-video w-full bg-black rounded-md overflow-hidden flex items-center justify-center relative">
            <video 
              ref={videoRef}
              className="w-full h-full object-cover" 
              autoPlay={recordingState !== 'preview'}
              muted={recordingState !== 'preview'}
              playsInline
              controls={recordingState === 'preview'}
              src={recordedVideoUrl || undefined}
            />
          {recordingState === 'idle' && !stream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-4 bg-black/50">
                  <Loader2 className="animate-spin mb-2 h-6 w-6" />
                  <p>카메라를 시작하고 있습니다...</p>
              </div>
          )}
        </div>
        
        <DialogFooter>
          {recordingState === 'idle' && (
            <Button onClick={startRecording} disabled={!stream} className="w-full">
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
