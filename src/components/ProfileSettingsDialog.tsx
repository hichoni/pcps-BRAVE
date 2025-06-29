"use client";

import React, { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, UploadCloud, FileCheck, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AVATAR_OPTIONS } from './PredefinedAvatars';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { uploadFile } from '@/services/client-storage';
import { resizeImage } from '@/lib/image-utils';

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export function ProfileSettingsDialog({ open, onOpenChange }: ProfileSettingsDialogProps) {
  const { user, updateProfileAvatar } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [selectedIconKey, setSelectedIconKey] = useState<string | null>(user?.profileAvatar || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIconSelect = async (key: string) => {
    setSelectedIconKey(key);
    setLoading(true);
    try {
      await updateProfileAvatar(key);
      toast({ title: '성공', description: '프로필 아이콘이 변경되었습니다.' });
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: '오류', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFileName(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: '지원하지 않는 파일 형식',
        description: '이미지 파일(jpg, png, gif 등)만 업로드할 수 있습니다.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast({
        variant: 'destructive',
        title: '파일 크기 초과',
        description: `이미지 파일 크기는 ${MAX_IMAGE_SIZE_MB}MB를 넘을 수 없습니다.`,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    setSelectedFile(file);
    setFileName(file.name);
  };
  
  const handleUploadSubmit = async () => {
    if (!selectedFile || !user) return;
    
    setLoading(true);
    try {
      const resizedFile = await resizeImage(selectedFile, 256); // Max width/height 256px
      const url = await uploadFile(resizedFile, user.username, 'profile');
      await updateProfileAvatar(url);
      toast({ title: '성공', description: '프로필 사진이 변경되었습니다.' });
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: '업로드 오류', description: error.message });
    } finally {
      setLoading(false);
    }
  }
  
  const handleDialogClose = (isOpen: boolean) => {
      if (!isOpen) {
          setSelectedFile(null);
          setFileName(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
      onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>프로필 설정</DialogTitle>
          <DialogDescription>
            원하는 아이콘을 선택하거나, 자신의 사진을 올려 프로필을 꾸며보세요.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="icon" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="icon">아이콘 선택</TabsTrigger>
              <TabsTrigger value="upload">사진 올리기</TabsTrigger>
            </TabsList>
            
            <TabsContent value="icon" className="py-4">
                <div className="grid grid-cols-4 gap-4">
                    {AVATAR_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          onClick={() => handleIconSelect(option.key)}
                          disabled={loading}
                          className={cn(
                            "aspect-square rounded-full flex items-center justify-center p-2 relative ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            selectedIconKey === option.key ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
                          )}
                        >
                            <option.component />
                            {selectedIconKey === option.key && (
                                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                                    <CheckCircle2 className="h-5 w-5 text-primary"/>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </TabsContent>
            
            <TabsContent value="upload" className="py-4 space-y-4">
                <div>
                  <Label htmlFor="photo-upload">프로필 사진 파일</Label>
                  <Input
                    id="photo-upload"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={loading}
                    className="file:text-primary file:font-semibold text-xs h-10 mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {MAX_IMAGE_SIZE_MB}MB 이하의 이미지 파일을 올려주세요. (정사각형으로 잘릴 수 있습니다)
                  </p>
                </div>
                {fileName && (
                    <div className="text-sm p-3 bg-secondary rounded-md text-secondary-foreground flex items-center gap-2">
                        <FileCheck className="h-4 w-4 text-primary" />
                        <span className="font-medium">{fileName}</span>
                    </div>
                )}
                <Button onClick={handleUploadSubmit} disabled={loading || !selectedFile} className="w-full">
                    {loading ? <Loader2 className="animate-spin" /> : <UploadCloud className="mr-2"/>}
                    사진으로 변경하기
                </Button>
            </TabsContent>
        </Tabs>
        
      </DialogContent>
    </Dialog>
  );
}
