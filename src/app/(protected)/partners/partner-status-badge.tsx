import type { PartnerStatus } from "@/types/partner";

export const PARTNER_STATUS_STYLES: Record<PartnerStatus, { label: string; className: string }> = {
  candidate: { label: "Aday", className: "bg-neutral-100 text-neutral-600" },
  active: { label: "Aktif", className: "bg-green-50 text-green-700" },
  suspended: { label: "Askıda", className: "bg-amber-50 text-amber-700" },
  inactive: { label: "Pasif", className: "bg-red-50 text-red-700" },
};

export function PartnerStatusBadge({ status }: { status: PartnerStatus }) {
  const { label, className } = PARTNER_STATUS_STYLES[status];

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
