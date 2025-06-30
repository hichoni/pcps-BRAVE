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
import { Loader2, Camera, StopCircle, RefreshCcw, Send, VideoOff, SwitchCamera } from 'lucide-react';

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
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [recordingState, setRecordingState] = useState<RecordingState>('initializing');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | undefined>(undefined);
  
  const cleanup = useCallback(() => {
    // Stop recording if active
    if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    // Stop all stream tracks
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }

    // Clear video element
    if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = '';
    }

    // Clear any timeouts
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    
    // Clear blob data
    if (recordedBlob) {
        URL.revokeObjectURL(URL.createObjectURL(recordedBlob));
        setRecordedBlob(null);
    }
  }, [recordedBlob]);


  const initializeCamera = useCallback(async (deviceId?: string) => {
    cleanup();
    setRecordingState('initializing');
    
    if (!navigator.mediaDevices?.getUserMedia) {
        toast({ variant: 'destructive', title: '카메라 미지원', description: '이 브라우저에서는 카메라 기능을 지원하지 않습니다.' });
        setRecordingState('denied');
        return;
    }
    
    try {
        const constraints = {
            audio: true,
            video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" } // Default to front camera
        };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = newStream;

        if (videoRef.current) {
            videoRef.current.srcObject = newStream;
            videoRef.current.muted = true; // MUST be muted for autoplay on mobile
            videoRef.current.playsInline = true; // MUST have for iOS Safari
            await videoRef.current.play();
        }
        
        setRecordingState('idle');
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devices.filter(d => d.kind === 'videoinput');
        setVideoDevices(videoDevs);
        
        const currentTrack = newStream.getVideoTracks()[0];
        const currentTrackSettings = currentTrack.getSettings();
        setCurrentDeviceId(currentTrackSettings.deviceId);

    } catch (err: any) {
        console.error('Error accessing camera/mic:', err);
        let description = '영상 녹화를 사용하려면 브라우저 설정에서 카메라와 마이크 권한을 허용해주세요.';
        if (err.name === 'NotAllowedError') description = '카메라와 마이크 접근 권한이 거부되었습니다. 브라우저 설정에서 권한을 재설정해주세요.';
        else if (err.name === 'NotFoundError') description = '사용 가능한 카메라나 마이크 장치를 찾을 수 없습니다. 장치가 연결되어 있는지 확인해주세요.';
        toast({ variant: 'destructive', title: '카메라/마이크 접근 오류', description, duration: 9000 });
        setRecordingState('denied');
    }
  }, [cleanup, toast]);


  useEffect(() => {
    if (open) {
      initializeCamera();
    } else {
      cleanup();
      setRecordingState('initializing');
    }
    return () => cleanup();
  }, [open, initializeCamera, cleanup]);


  useEffect(() => {
    if (recordingState === 'preview' && recordedBlob && videoRef.current) {
      const url = URL.createObjectURL(recordedBlob);
      videoRef.current.srcObject = null;
      videoRef.current.src = url;
      videoRef.current.muted = false;
      videoRef.current.controls = true;
      videoRef.current.play().catch(e => console.error("Preview playback failed", e));
      return () => URL.revokeObjectURL(url);
    }
  }, [recordingState, recordedBlob]);

  const startRecording = () => {
    if (!streamRef.current) return;
    setRecordingState('recording');
    const recordedChunks: Blob[] = [];
    try {
        const options = [
          { mimeType: 'video/webm; codecs=vp9,opus' },
          { mimeType: 'video/webm; codecs=vp8,opus' },
          { mimeType: 'video/mp4' },
          { mimeType: 'video/webm' },
        ].find(opt => MediaRecorder.isTypeSupported(opt.mimeType));
        
        const recorder = new MediaRecorder(streamRef.current, options);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) recordedChunks.push(event.data);
        };

        recorder.onstop = () => {
            if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
            const blob = new Blob(recordedChunks, { type: recorder.mimeType });
            setRecordedBlob(blob);
            setRecordingState('preview');
        };

        recorder.start();
        recordingTimeoutRef.current = setTimeout(() => {
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        }, RECORDING_DURATION_MS);
    } catch (e) {
        console.error("Recording start failed", e);
        toast({ variant: 'destructive', title: '녹화 시작 실패', description: '이 브라우저에서는 녹화 기능을 지원하지 않을 수 있습니다.' });
        setRecordingState('idle');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (videoRef.current) videoRef.current.controls = false;
  };

  const handleUseVideo = () => {
    if (!recordedBlob) return;
    const mimeType = mediaRecorderRef.current?.mimeType || recordedBlob.type || 'video/webm';
    const extension = mimeType.split(';')[0].split('/')[1] || 'webm';
    const file = new File([recordedBlob], `recorded-video-${Date.now()}.${extension}`, { type: mimeType });
    onVideoRecorded(file);
    onOpenChange(false);
  };
  
  const handleSwitchCamera = () => {
      if(videoDevices.length < 2) return;
      const currentIndex = videoDevices.findIndex(d => d.deviceId === currentDeviceId);
      const nextIndex = (currentIndex + 1) % videoDevices.length;
      const nextDeviceId = videoDevices[nextIndex].deviceId;
      initializeCamera(nextDeviceId);
  };

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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>영상 바로 찍기</DialogTitle>
          <DialogDescription>최대 5분까지 녹화할 수 있습니다.</DialogDescription>
        </DialogHeader>

        <div className="my-4 aspect-video w-full bg-black rounded-md overflow-hidden flex items-center justify-center relative">
          <video ref={videoRef} className="w-full h-full object-cover" />
          {renderContent()}
          {recordingState === 'idle' && videoDevices.length > 1 && (
            <Button size="icon" onClick={handleSwitchCamera} className="absolute bottom-4 right-4 rounded-full h-10 w-10">
              <SwitchCamera />
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
            <Button onClick={stopRecording} variant="destructive" className="w-full">
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
          {recordingState === 'denied' && (
            <Button onClick={() => initializeCamera()} variant="outline" className="w-full">
              <RefreshCcw className="mr-2" /> 권한 다시 요청하기
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
