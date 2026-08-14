"use client";

import { useRouter } from "next/navigation";

export function BackLink({ fallbackHref, label }: { fallbackHref: string; label: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className="text-left text-sm text-muted hover:text-brand"
    >
      ← {label}
    </button>
  );
}
