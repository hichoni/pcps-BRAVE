import React from 'react';
import Image from 'next/image';

export function Header() {
  return (
    <header className="py-8 text-center border-b-2 border-primary/10 mb-8">
        <div className="inline-flex items-center gap-6">
            <Image
              src="https://placehold.co/72x72.png"
              alt="풍천풍서초등학교 로고"
              width={72}
              height={72}
              data-ai-hint="school logo"
              className="rounded-full shadow-md"
            />
            <div>
                <p className="text-lg font-semibold text-muted-foreground">풍천풍서초등학교</p>
                <h1 className="text-4xl font-bold font-headline text-primary">
                    도전! 꿈 성취 학교장 인증제
                </h1>
            </div>
             <div className="text-4xl font-bold font-headline text-primary/70 flex flex-col tracking-wider">
                <span>2</span>
                <span>0</span>
                <span>2</span>
                <span>5</span>
             </div>
        </div>
    </header>
  );
}
