import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Framework varsayılanı ("warning") her Page/Default segmentini örtük
  // doğruluyor — bu projede henüz her sayfa Suspense/`use cache` ile
  // "instant nav" için tasarlanmadığından (örn. (protected) layout'unun
  // kullanıcıya özel header'ı), bu her sayfada aynı dev-only konsol
  // uyarısını üretiyordu. "manual-warning" yalnızca `instant` export'unu
  // AÇIKÇA tanımlayan segmentleri doğrular — bkz. (protected)/layout.tsx
  // (instant = false). İleride belirli sayfaları `instant = true` ile
  // opt-in edip tek tek sıkılaştırabiliriz.
  experimental: {
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
};

export default nextConfig;
