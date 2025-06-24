"use client";

import React from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/button';
import { LogOut } from 'lucide-react';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="py-8 border-b-2 border-primary/10 mb-8 flex justify-between items-center">
        <div className="flex items-center gap-6">
            <Image
              src="/icon-main.png"
              alt="풍천풍서초등학교 로고"
              width={72}
              height={72}
              className="rounded-full shadow-md"
            />
            <div>
                <p className="text-lg font-semibold text-muted-foreground">2025학년도</p>
                <h1 className="text-4xl font-bold font-headline text-primary">
                    도전! 꿈 성취 학교장 인증제
                </h1>
            </div>
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{user.name}님</span>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="로그아웃">
              <LogOut className="h-5 w-5"/>
            </Button>
          </div>
        )}
    </header>
  );
}
