import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "데니 투자연구소",
  description: "10억 프로젝트 자문 시스템",
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
