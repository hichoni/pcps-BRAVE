import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { AchievementsProvider } from '@/context/AchievementsContext';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: '장학생 성취 트래커',
  description: '학교장 인증을 향한 진행 상황을 추적하세요.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={cn('font-body antialiased min-h-screen bg-background')}>
        <AchievementsProvider>
          {children}
        </AchievementsProvider>
        <Toaster />
      </body>
    </html>
  );
}
