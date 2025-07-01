
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: '풍천풍서초등학교 학교장 인증제',
  description: '도전! 꿈 성취 학교장 인증제를 통해 나의 성장을 기록하고 인증받아보세요.',
  themeColor: 'hsl(221 27% 40%)',
};

export const viewport: Viewport = {
  themeColor: 'hsl(221 27% 40%)',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // PWA 캐시 문제를 방지하기 위한 간단한 버전 번호
  const PWA_VERSION = "1.0.3";

  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap"
          rel="stylesheet"
        />
        {/* PWA 캐시 문제를 완화하기 위해 수동으로 버전이 명시된 링크를 추가합니다. */}
        <link rel="manifest" href={`/manifest.json?v=${PWA_VERSION}`} />
      </head>
      <body className={cn('font-body antialiased min-h-screen bg-background')}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
