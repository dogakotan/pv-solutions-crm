import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/require-role";
import { getDefaultRouteForRole } from "@/lib/auth/roles";

export default async function DashboardPage() {
  const { appRole } = await getCurrentUserRole();
  redirect(getDefaultRouteForRole(appRole));
}
