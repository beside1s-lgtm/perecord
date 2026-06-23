import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: '체육 성장 기록 시스템',
  description: '체육 수업 결과 기록 및 분석 시스템',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/200x200.png" type="image/png" />
        <link rel="apple-touch-icon" href="/200x200.png" />
        <meta name="theme-color" content="#4a55a2" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={cn('font-body antialiased', 'min-h-screen bg-background font-sans watermark-bg')}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
