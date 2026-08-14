import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getVerifiedUserId } from "@/lib/auth/current-user";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeRedirect />
    </Suspense>
  );
}

async function HomeRedirect() {
  const userId = await getVerifiedUserId();

  redirect(userId ? "/dashboard" : "/login");
  return null;
}
