
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
import { Loader2, Camera, StopCircle, RefreshCcw, Send, VideoOff } from 'lucide-react';

interface VideoRecorderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVideoRecorded: (file: File) => void;
}

type RecordingState = 'initializing' | 'denied' | 'idle' | 'recording' | 'preview';
const RECORDING_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function VideoRecorderDialog({ open, onOpenChange, onVideoRecorded }: VideoRecorderDialogProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [recordingState, setRecordingState] = useState<RecordingState>('initializing');
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  
  const cleanup = useCallback(() => {
    // Stop all media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    // Stop recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    
    // Clear timeout
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    
    // Revoke blob URL to free memory
    if (videoBlobUrl) {
      URL.revokeObjectURL(videoBlobUrl);
      setVideoBlobUrl(null);
    }
    
    // Reset video element
    if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = "";
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
    }
  }, [videoBlobUrl]);

  useEffect(() => {
    if (open) {
      let isCancelled = false;

      const initializeCamera = async () => {
        setRecordingState('initializing');
        cleanup();

        if (!navigator.mediaDevices?.getUserMedia) {
          toast({ variant: 'destructive', title: '카메라 미지원', description: '이 브라우저에서는 카메라 기능을 지원하지 않습니다.' });
          if (!isCancelled) setRecordingState('denied');
          return;
        }
        
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          if (isCancelled || !videoRef.current) {
              stream.getTracks().forEach(t => t.stop());
              return;
          }

          streamRef.current = stream;
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          videoRef.current.controls = false;
          await videoRef.current.play();
          
          if (!isCancelled) setRecordingState('idle');

        } catch (err: any) {
          if (isCancelled) return;
          
          console.error('Error accessing camera/mic:', err);
          let description = '영상 녹화를 사용하려면 브라우저 설정에서 카메라와 마이크 권한을 허용해주세요.';
          if (err.name === 'NotAllowedError') description = '카메라와 마이크 접근 권한이 거부되었습니다. 브라우저 설정에서 권한을 재설정해주세요.';
          else if (err.name === 'NotFoundError') description = '사용 가능한 카메라나 마이크 장치를 찾을 수 없습니다. 장치가 연결되어 있는지 확인해주세요.';
          
          toast({ variant: 'destructive', title: '카메라/마이크 접근 오류', description, duration: 9000 });
          setRecordingState('denied');
        }
      };

      initializeCamera();

      return () => {
        isCancelled = true;
        cleanup();
      };
    }
  }, [open, cleanup, toast]);

  const startRecording = () => {
    if (!streamRef.current || recordingState !== 'idle') return;

    recordedChunksRef.current = [];
    const mimeTypes = ['video/mp4; codecs="avc1.42E01E, mp4a.40.2"', 'video/webm; codecs=vp9,opus', 'video/webm; codecs=vp8,opus', 'video/webm'];
    const foundMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
    
    try {
        const recorder = new MediaRecorder(streamRef.current, { mimeType: foundMimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunksRef.current.push(event.data);
            }
        };
        
        recorder.onerror = (event: any) => {
            console.error('MediaRecorder error:', event.error);
            toast({ variant: 'destructive', title: '녹화 오류', description: `녹화 중 오류가 발생했습니다: ${event.error.message}` });
            handleReset();
        };

        recorder.onstop = () => {
            if (recordedChunksRef.current.length === 0) {
                toast({ variant: 'destructive', title: '녹화 오류', description: '녹화된 데이터가 없습니다. 다시 시도해주세요.'});
                handleReset();
                return;
            }
            try {
                const blob = new Blob(recordedChunksRef.current, { type: foundMimeType });
                const url = URL.createObjectURL(blob);
                
                if (videoRef.current) {
                  videoRef.current.srcObject = null;
                  videoRef.current.src = url;
                  videoRef.current.muted = false;
                  videoRef.current.controls = true;
                  videoRef.current.play().catch(e => console.error("Preview playback failed", e));
                }

                setVideoBlobUrl(url);
                setRecordingState('preview');

            } catch (e: any) {
                console.error("Error in onstop handler:", e);
                toast({ variant: 'destructive', title: '녹화 처리 오류', description: '녹화된 영상을 처리하는 중 문제가 발생했습니다.' });
                handleReset();
            }
        };
        
        recorder.start();
        setRecordingState('recording');

        recordingTimeoutRef.current = setTimeout(() => {
            if (mediaRecorderRef.current?.state === 'recording') {
                stopRecording();
            }
        }, RECORDING_DURATION_MS);

    } catch (e: any) {
        console.error("Recording start failed", e);
        toast({ variant: 'destructive', title: '녹화 시작 실패', description: `녹화 기능을 시작할 수 없습니다: ${e.message}` });
        setRecordingState('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
        if(recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
    }
  };
  
  const handleUseVideo = () => {
    if (!videoBlobUrl || !mediaRecorderRef.current) return;
    const mimeType = mediaRecorderRef.current.mimeType;
    fetch(videoBlobUrl)
        .then(res => res.blob())
        .then(blob => {
            const extension = mimeType.split('/')[1]?.split(';')[0] || 'webm';
            const file = new File([blob], `recorded-video-${Date.now()}.${extension}`, { type: mimeType });
            onVideoRecorded(file);
        })
        .catch(err => {
            console.error("Failed to create file from blob", err);
            toast({ variant: 'destructive', title: '파일 생성 오류', description: '녹화된 영상으로 파일을 만드는 데 실패했습니다.' });
        });
  };
  
  const handleReset = useCallback(() => {
    setRecordingState('initializing');
  }, []);

  const renderFooter = () => {
    switch (recordingState) {
      case 'idle':
        return <Button onClick={startRecording} className="w-full"><Camera className="mr-2" /> 녹화 시작</Button>;
      case 'recording':
        return <Button onClick={stopRecording} variant="destructive" className="w-full"><StopCircle className="mr-2 animate-pulse" /> 녹화 중지</Button>;
      case 'preview':
        return (
            <div className="w-full flex gap-2">
              <Button onClick={handleReset} variant="outline" className="flex-1"><RefreshCcw className="mr-2" /> 다시 찍기</Button>
              <Button onClick={handleUseVideo} className="flex-1"><Send className="mr-2" /> 이 영상 사용하기</Button>
            </div>
        );
      case 'denied':
        return <Button onClick={handleReset} variant="outline" className="w-full"><RefreshCcw className="mr-2" /> 권한 다시 요청하기</Button>;
      default:
        return <Button disabled className="w-full"><Loader2 className="animate-spin mr-2" /> 준비 중...</Button>;
    }
  };

  const renderVideoOverlay = () => {
      if (recordingState === 'initializing') {
        return (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-4 bg-black/50">
            <Loader2 className="animate-spin mb-2 h-6 w-6" />
            <p>카메라를 시작하고 있습니다...</p>
          </div>
        );
      }
      if (recordingState === 'denied') {
        return (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-4 bg-black/50">
            <VideoOff className="mb-2 h-8 w-8" />
            <p className="font-semibold">카메라 접근 불가</p>
            <p className="text-sm">브라우저 설정에서 권한을 확인해주세요.</p>
          </div>
        );
      }
      return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>영상 바로 찍기</DialogTitle>
          <DialogDescription>최대 5분까지 녹화할 수 있습니다.</DialogDescription>
        </DialogHeader>

        <div className="my-4 aspect-video w-full bg-black rounded-md overflow-hidden flex items-center justify-center relative">
          <video ref={videoRef} className="w-full h-full object-cover" />
          {renderVideoOverlay()}
        </div>

        <DialogFooter>
          {renderFooter()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
