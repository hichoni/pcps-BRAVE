import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { AchievementsProvider } from '@/context/AchievementsContext';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import { ChallengeConfigProvider } from '@/context/ChallengeConfigContext';

export const metadata: Metadata = {
  title: '풍천풍서초등학교 학교장 인증제',
  description: '도전! 꿈 성취 학교장 인증제를 통해 나의 성장을 기록하고 인증받아보세요.',
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
        <AuthProvider>
          <ChallengeConfigProvider>
            <AchievementsProvider>
              {children}
            </AchievementsProvider>
          </ChallengeConfigProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
