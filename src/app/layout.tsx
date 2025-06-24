import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { AchievementsProvider } from '@/context/AchievementsContext';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'Scholar Achievements Tracker',
  description: 'Track your progress towards school-wide certification.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
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
