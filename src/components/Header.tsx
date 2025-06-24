"use client";

import React from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/button';
import { LogOut } from 'lucide-react';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="py-6 border-b border-border mb-12 flex justify-between items-center">
        <div className="flex items-center gap-6">
            <Image
              src="/icon-main.png?v=2"
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
            <span className="text-sm font-semibold">
              {user.role === 'student'
                ? `${user.grade}학년 ${user.classNum}반 ${user.studentNum}번 ${user.name} 학생`
                : `${user.name}님`}
            </span>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="로그아웃">
              <LogOut className="h-5 w-5"/>
            </Button>
          </div>
        )}
    </header>
  );
}
