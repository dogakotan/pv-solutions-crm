import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/require-role";

export default async function FirstCallLayout({ children }: { children: ReactNode }) {
  await requireRole(["admin", "first_call"]);
  return <>{children}</>;
}
