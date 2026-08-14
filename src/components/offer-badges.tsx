import type { OfferStatus, OfferVersionStatus } from "@/types/offer";

const OFFER_STATUS_STYLES: Record<OfferStatus, { label: string; className: string }> = {
  open: { label: "Açık", className: "bg-blue-50 text-blue-700" },
  accepted: { label: "Kabul Edildi", className: "bg-green-50 text-green-700" },
  rejected: { label: "Reddedildi", className: "bg-red-50 text-red-700" },
  closed: { label: "Kapandı", className: "bg-neutral-100 text-neutral-600" },
};

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  const style = OFFER_STATUS_STYLES[status];

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}

const VERSION_STATUS_STYLES: Record<OfferVersionStatus, { label: string; className: string }> = {
  draft: { label: "Taslak", className: "bg-neutral-100 text-neutral-600" },
  sent: { label: "Gönderildi", className: "bg-blue-50 text-blue-700" },
  superseded: { label: "Eski Revizyon", className: "bg-neutral-100 text-neutral-600" },
  accepted: { label: "Kabul Edildi", className: "bg-green-50 text-green-700" },
  rejected: { label: "Reddedildi", className: "bg-red-50 text-red-700" },
  expired: { label: "Süresi Doldu", className: "bg-red-50 text-red-700" },
};

export function OfferVersionStatusBadge({ status }: { status: OfferVersionStatus }) {
  const style = VERSION_STATUS_STYLES[status];

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}
