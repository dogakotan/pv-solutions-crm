import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-6">
      <Logo />
      <div className="w-full max-w-sm rounded-2xl border border-card-border bg-card p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}
