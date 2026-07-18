import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "培英中學 AI 數智化平台",
  description: "Apple 子系統 — 獎狀獎學金 / 財務收支 / 資產盤點 / 學生事務",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
