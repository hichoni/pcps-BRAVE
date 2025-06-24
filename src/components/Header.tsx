import React from 'react';
import { GraduationCap } from 'lucide-react';

export function Header() {
  return (
    <header className="py-8 text-center">
      <div className="inline-flex items-center gap-4">
        <GraduationCap className="w-12 h-12 text-primary" />
        <div>
          <h1 className="text-4xl font-bold font-headline text-primary">
            Scholar Achievements Tracker
          </h1>
          <p className="text-lg text-muted-foreground">학교장 인증제 현황</p>
        </div>
      </div>
    </header>
  );
}
