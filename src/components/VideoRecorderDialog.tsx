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
import { Loader2, Camera, StopCircle, RefreshCcw, Send, VideoOff, CameraReverse } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoRecorderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVideoRecorded: (file: File) => void;
}

type RecordingState = 'idle' | 'recording' | 'preview' | 'initializing' | 'denied';
const RECORDING_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function VideoRecorderDialog({ open, onOpenChange, onVideoRecorded }: VideoRecorderDialogProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [recordingState, setRecordingState] = useState<RecordingState>('initializing');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | undefined>(undefined);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    recordedChunksRef.current = [];
    if (videoRef.current && videoRef.current.src.startsWith('blob:')) {
      URL.revokeObjectURL(videoRef.current.src);
    }
    if (videoRef.current) {
        videoRef.current.src = "";
        videoRef.current.srcObject = null;
    }
  }, []);

  const initializeCamera = useCallback(async (deviceId?: string) => {
    cleanup();
    setRecordingState('initializing');
    
    if (!navigator.mediaDevices?.getUserMedia) {
        toast({ variant: 'destructive', title: '카메라 미지원', description: '이 브라우저에서는 카메라 기능을 지원하지 않습니다.' });
        setRecordingState('denied');
        return;
    }
    
    try {
      const constraints: MediaStreamConstraints = {
        video: { deviceId: deviceId ? { exact: deviceId } : undefined, facingMode: 'user' },
        audio: true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.controls = false;
        await videoRef.current.play();
      }

      // Enumerate devices to allow switching
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setVideoDevices(videoInputs);
      
      const currentTrack = stream.getVideoTracks()[0];
      setCurrentDeviceId(currentTrack.getSettings().deviceId);
      
      setRecordingState('idle');
    } catch (error: any) {
      console.error('Error accessing camera/mic:', error);
      let description = '영상 녹화를 사용하려면 브라우저 설정에서 카메라와 마이크 권한을 허용해주세요.';
      if (error.name === 'NotAllowedError') description = '카메라와 마이크 접근 권한이 거부되었습니다. 브라우저 설정에서 권한을 재설정해주세요.';
      else if (error.name === 'NotFoundError') description = '사용 가능한 카메라나 마이크 장치를 찾을 수 없습니다. 장치가 연결되어 있는지 확인해주세요.';
      
      toast({ variant: 'destructive', title: '카메라/마이크 접근 오류', description, duration: 9000 });
      setRecordingState('denied');
    }
  }, [cleanup, toast]);

  useEffect(() => {
    if (open) {
      initializeCamera();
    } else {
      cleanup();
    }
    return () => cleanup();
  }, [open]);

  const handleSwitchCamera = useCallback(async () => {
    if (videoDevices.length < 2) return;
    const currentIndex = videoDevices.findIndex(d => d.deviceId === currentDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    const nextDeviceId = videoDevices[nextIndex].deviceId;
    await initializeCamera(nextDeviceId);
  }, [videoDevices, currentDeviceId, initializeCamera]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) {
      toast({ variant: 'destructive', title: '오류', description: '카메라를 사용할 수 없습니다. 다시 시도해주세요.' });
      return;
    }
    
    setRecordingState('recording');
    recordedChunksRef.current = [];
    
    try {
      const options = [
        { mimeType: 'video/webm; codecs=vp9' },
        { mimeType: 'video/webm; codecs=vp8' },
        { mimeType: 'video/mp4' },
        { mimeType: 'video/webm' },
      ].find(opt => MediaRecorder.isTypeSupported(opt.mimeType));

      const recorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        cleanup();

        if (videoRef.current) {
            videoRef.current.srcObject = null;
            videoRef.current.src = url;
            videoRef.current.muted = false;
            videoRef.current.controls = true;
            videoRef.current.play().catch(e => console.error("Preview playback error", e));
        }

        setRecordingState('preview');
      };

      recorder.start();
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
      }, RECORDING_DURATION_MS);

    } catch (e) {
      console.error("Recording start failed", e);
      toast({ variant: 'destructive', title: '녹화 시작 실패', description: '이 브라우저에서는 녹화 기능을 지원하지 않을 수 있습니다.' });
      setRecordingState('idle');
    }
  }, [toast, cleanup]);

  const handleUseVideo = useCallback(() => {
    if (!videoRef.current?.src) return;

    const mimeType = mediaRecorderRef.current?.mimeType || 'video/webm';
    const getFileExtension = (type: string) => {
      const parts = type.split(';')[0].split('/');
      return parts[1] || 'webm';
    }
    const extension = getFileExtension(mimeType);
    
    const blob = new Blob(recordedChunksRef.current, { type: mimeType });
    const file = new File([blob], `recorded-video-${Date.now()}.${extension}`, { type: mimeType });
    onVideoRecorded(file);
  }, [onVideoRecorded]);

  const renderContent = () => {
      switch (recordingState) {
          case 'initializing':
              return (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-4 bg-black/50">
                    <Loader2 className="animate-spin mb-2 h-6 w-6" />
                    <p>카메라를 시작하고 있습니다...</p>
                </div>
              );
          case 'denied':
              return (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-4 bg-black/50">
                    <VideoOff className="mb-2 h-8 w-8" />
                    <p className="font-semibold">카메라 접근 불가</p>
                    <p className="text-sm">브라우저 설정에서 권한을 확인해주세요.</p>
                </div>
              );
          default:
              return null;
      }
  }
  
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
              playsInline
            />
            {renderContent()}
            {recordingState === 'idle' && videoDevices.length > 1 && (
                <Button
                    size="icon"
                    variant="outline"
                    onClick={handleSwitchCamera}
                    className="absolute bottom-4 right-4 rounded-full h-10 w-10 bg-black/30 hover:bg-black/50 border-white/50 text-white hover:text-white"
                >
                    <CameraReverse />
                </Button>
            )}
        </div>
        
        <DialogFooter>
          {recordingState === 'idle' && (
            <Button onClick={startRecording} className="w-full">
              <Camera className="mr-2" /> 녹화 시작
            </Button>
          )}
          {recordingState === 'recording' && (
            <Button onClick={() => mediaRecorderRef.current?.stop()} variant="destructive" className="w-full">
              <StopCircle className="mr-2 animate-pulse" /> 녹화 중지
            </Button>
          )}
          {recordingState === 'preview' && (
            <div className="w-full flex gap-2">
              <Button onClick={() => initializeCamera(currentDeviceId)} variant="outline" className="flex-1">
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
