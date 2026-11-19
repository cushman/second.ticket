"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function Countdown({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const end = new Date(expiresAt).getTime();
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const ms = end - Date.now();
      setLeft(Math.max(0, ms));
      if (ms <= 0) router.refresh();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [end, router]);

  if (left === null) return <strong>10:00</strong>;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <strong aria-live={left < 60000 ? "polite" : "off"}>
      {m}:{String(s).padStart(2, "0")}
    </strong>
  );
}
