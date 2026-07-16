import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "培英中学 AI 数智化平台",
  description: "Apple 子系统 — 奖状奖学金 / 财务收支 / 资产盘点 / 学生事务",
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
