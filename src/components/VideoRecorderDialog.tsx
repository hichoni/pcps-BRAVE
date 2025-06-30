
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

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const cleanupRecorder = useCallback(() => {
     if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (videoBlobUrl) {
      URL.revokeObjectURL(videoBlobUrl);
      setVideoBlobUrl(null);
    }
  }, [videoBlobUrl]);

  const cleanup = useCallback(() => {
    cleanupStream();
    cleanupRecorder();
  }, [cleanupStream, cleanupRecorder]);
  
  const initializeCamera = useCallback(async () => {
    let isCancelled = false;

    const start = async () => {
        cleanup();
        setRecordingState('initializing');
        if (!navigator.mediaDevices?.getUserMedia) {
            toast({ variant: 'destructive', title: '카메라 미지원', description: '이 브라우저에서는 카메라 기능을 지원하지 않습니다.' });
            if (!isCancelled) setRecordingState('denied');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (isCancelled) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.muted = true;
                videoRef.current.playsInline = true; // Essential for iOS
                videoRef.current.controls = false;
                await videoRef.current.play();
            }
            if (!isCancelled) setRecordingState('idle');

        } catch (err: any) {
            if (isCancelled) return;
            console.error('Error accessing camera/mic:', err);
            let description = '영상 녹화를 사용하려면 브라우저 설정에서 카메라와 마이크 권한을 허용해주세요.';
            if (err.name === 'NotAllowedError') description = '카메라와 마이크 접근 권한이 거부되었습니다. 브라우저 설정에서 권한을 재설정해주세요.';
            else if (err.name === 'NotFoundError') description = '사용 가능한 카메라나 마이크 장치를 찾을 수 없습니다. 장치가 연결되어 있는지 확인해주세요.';
            
            toast({ variant: 'destructive', title: '카메라/마이크 접근 오류', description, duration: 9000 });
            if (!isCancelled) setRecordingState('denied');
        }
    }
    
    start();

    return () => {
        isCancelled = true;
    }
  }, [cleanup, toast]);

  useEffect(() => {
    let cancelCameraInit: (() => void) | undefined;
    if (open) {
      cancelCameraInit = initializeCamera();
    } else {
      cleanup();
    }
    return () => {
      cleanup();
      if (cancelCameraInit) cancelCameraInit();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startRecording = () => {
    if (!streamRef.current || mediaRecorderRef.current) return;

    recordedChunksRef.current = [];
    const mimeTypes = ['video/webm; codecs=vp9,opus', 'video/webm; codecs=vp8,opus', 'video/webm', 'video/mp4'];
    const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
    
    if (!supportedMimeType) {
        toast({ variant: 'destructive', title: '녹화 오류', description: '이 브라우저에서 지원하는 녹화 형식을 찾을 수 없습니다.' });
        return;
    }

    try {
        const recorder = new MediaRecorder(streamRef.current, { mimeType: supportedMimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunksRef.current.push(event.data);
            }
        };

        recorder.onstop = () => {
            if (recordedChunksRef.current.length > 0) {
              const blob = new Blob(recordedChunksRef.current, { type: supportedMimeType });
              const url = URL.createObjectURL(blob);
              setVideoBlobUrl(url);
              setRecordingState('preview');
            } else {
              toast({ variant: 'destructive', title: '녹화 오류', description: '녹화된 영상 데이터가 없습니다. 다시 시도해주세요.'});
              initializeCamera();
            }
        };
        
        recorder.start();
        setRecordingState('recording');

        recordingTimeoutRef.current = setTimeout(() => {
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        }, RECORDING_DURATION_MS);

    } catch (e) {
        console.error("Recording start failed", e);
        toast({ variant: 'destructive', title: '녹화 시작 실패', description: '녹화 기능을 시작할 수 없습니다.' });
        initializeCamera();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
  };

  const handleUseVideo = () => {
    if (!videoBlobUrl) return;
    fetch(videoBlobUrl)
        .then(res => res.blob())
        .then(blob => {
            const mimeType = blob.type || 'video/webm';
            const extension = mimeType.split(';')[0].split('/')[1] || 'webm';
            const file = new File([blob], `recorded-video-${Date.now()}.${extension}`, { type: mimeType });
            onVideoRecorded(file);
            onOpenChange(false);
        })
        .catch(err => {
            console.error("Failed to create file from blob", err);
            toast({ variant: 'destructive', title: '파일 생성 오류', description: '녹화된 영상으로 파일을 만드는 데 실패했습니다.' });
        });
  };
  
  const handleReset = () => {
    cleanupRecorder();
    initializeCamera();
  }

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
        return <Button onClick={initializeCamera} variant="outline" className="w-full"><RefreshCcw className="mr-2" /> 권한 다시 요청하기</Button>;
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
  
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (recordingState === 'preview' && videoBlobUrl) {
        cleanupStream();
        videoElement.src = videoBlobUrl;
        videoElement.srcObject = null;
        videoElement.muted = false;
        videoElement.controls = true;
        videoElement.play().catch(e => console.error("Preview playback failed", e));
    } else if (streamRef.current) {
        videoElement.src = '';
        videoElement.srcObject = streamRef.current;
        videoElement.muted = true;
        videoElement.controls = false;
        videoElement.play().catch(e => console.error("Live playback failed", e));
    }
  }, [recordingState, videoBlobUrl, cleanupStream]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>영상 바로 찍기</DialogTitle>
          <DialogDescription>최대 5분까지 녹화할 수 있습니다.</DialogDescription>
        </DialogHeader>

        <div className="my-4 aspect-video w-full bg-black rounded-md overflow-hidden flex items-center justify-center relative">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline />
          {renderVideoOverlay()}
        </div>

        <DialogFooter>
          {renderFooter()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
