"use client";

import { ToastProvider } from "@/components/ui/ToastProvider";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
