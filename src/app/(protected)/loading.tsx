import { KpiGridSkeleton, TableSkeleton } from "@/components/skeletons";

/**
 * (protected) altındaki tüm sayfalar için otomatik Suspense fallback'i —
 * ama artık her sayfa kendi içinde Suspense sınırı ve kendi şekline
 * uygun bir skeleton kullandığından (bkz. ilgili page.tsx'ler), bu
 * yalnızca sayfanın KENDİ statik kabuğu bile boyanmadan önce devreye
 * girecek son çare — normal koşulda ilgili sayfanın kendi Suspense'i
 * bundan önce devreye girer. Bu yüzden burada sayfaya özel bir şekil
 * hedeflemeye gerek yok, genel bir iskelet yeterli.
 */
export default function ProtectedLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-card" />
      <KpiGridSkeleton count={4} />
      <TableSkeleton rows={5} />
    </div>
  );
}
