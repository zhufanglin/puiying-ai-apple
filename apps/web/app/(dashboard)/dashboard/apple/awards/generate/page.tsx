"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GenerateRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/apple/awards/batch");
  }, [router]);

  return null;
}
