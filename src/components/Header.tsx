"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/button';
import { LogOut, Pencil } from 'lucide-react';
import { ProfileSettingsDialog } from './ProfileSettingsDialog';
import { UserAvatar } from './UserAvatar';

function ProfileButton() {
    const { user } = useAuth();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    if (!user) return null;

    return (
        <>
            <Button
              onClick={() => setIsDialogOpen(true)}
              title="프로필 설정"
              variant="ghost"
              size="icon"
              className="relative rounded-full group"
            >
                <UserAvatar user={user} className="h-8 w-8" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Pencil className="h-4 w-4 text-white" />
                </div>
            </Button>
            <ProfileSettingsDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
        </>
    );
}

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="py-6 border-b border-border mb-12 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
            <Image
              src="https://placehold.co/72x72.png"
              data-ai-hint="school logo"
              alt="풍천풍서초등학교 로고"
              width={72}
              height={72}
              className="rounded-full shadow-md w-14 h-14 sm:w-[72px] sm:h-[72px]"
            />
            <div>
                <p className="text-sm sm:text-lg font-semibold text-muted-foreground">2025학년도</p>
                <h1 className="text-2xl sm:text-4xl font-bold font-headline text-primary">
                    도전! 꿈 성취 학교장 인증제
                </h1>
            </div>
        </div>
        {user && (
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <span className="text-xs sm:text-sm font-semibold text-right">
              {user.role === 'student'
                ? `${user.grade}학년 ${user.classNum}반 ${user.studentNum}번 ${user.name} 학생`
                : `${user.name}님`}
            </span>
            {user.role === 'student' && <ProfileButton />}
            <Button variant="ghost" size="icon" onClick={logout} aria-label="로그아웃">
              <LogOut className="h-5 w-5"/>
            </Button>
          </div>
        )}
    </header>
  );
}
