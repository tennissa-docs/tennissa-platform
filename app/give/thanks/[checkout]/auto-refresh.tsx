"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-reads the page every 3 seconds for up to a minute while a payment is being confirmed. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      if (++n > 20) return clearInterval(id);
      router.refresh();
    }, 3000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
