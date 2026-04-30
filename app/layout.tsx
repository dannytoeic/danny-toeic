import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Danny Toeic',
  description: '데니토익 수강생 전용 학습 페이지',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}