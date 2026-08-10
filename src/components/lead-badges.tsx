import type { LeadStage, LeadScore, PartnerReferralStatus } from "@/types/lead";

export const STAGE_STYLES: Record<LeadStage, { label: string; className: string }> = {
  new: { label: "Yeni", className: "bg-neutral-100 text-neutral-600" },
  contacted: { label: "İletişime Geçildi", className: "bg-blue-50 text-blue-700" },
  referred: { label: "Yönlendirildi", className: "bg-indigo-50 text-indigo-700" },
  survey_scheduled: { label: "Keşif Planlandı", className: "bg-amber-50 text-amber-700" },
  survey_completed: { label: "Keşif Tamamlandı", className: "bg-amber-50 text-amber-700" },
  proposal_preparing: { label: "Teklif Hazırlanıyor", className: "bg-purple-50 text-purple-700" },
  proposal_sent: { label: "Teklif Gönderildi", className: "bg-purple-50 text-purple-700" },
  negotiation: { label: "Pazarlık", className: "bg-orange-50 text-orange-700" },
  won: { label: "Kazanıldı", className: "bg-green-50 text-green-700" },
  lost: { label: "Kaybedildi", className: "bg-red-50 text-red-700" },
  sale_registered: { label: "Satış Kaydedildi", className: "bg-green-50 text-green-700" },
};

export function LeadStageBadge({ stage }: { stage: LeadStage }) {
  const style = STAGE_STYLES[stage] ?? { label: stage, className: "bg-neutral-100 text-neutral-600" };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}

const SCORE_STYLES: Record<LeadScore, { label: string; className: string }> = {
  hot: { label: "Sıcak", className: "bg-red-50 text-red-700" },
  warm: { label: "Ilık", className: "bg-orange-50 text-orange-700" },
  mid: { label: "Orta", className: "bg-amber-50 text-amber-700" },
  cold: { label: "Soğuk", className: "bg-blue-50 text-blue-700" },
};

export function LeadScoreBadge({ score }: { score: LeadScore | null }) {
  if (!score) {
    return <span className="text-xs text-muted">—</span>;
  }

  const style = SCORE_STYLES[score] ?? { label: score, className: "bg-neutral-100 text-neutral-600" };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}

const REFERRAL_STATUS_STYLES: Record<PartnerReferralStatus, { label: string; className: string }> = {
  pending: { label: "Bekliyor", className: "bg-amber-50 text-amber-700" },
  accepted: { label: "Kabul Edildi", className: "bg-blue-50 text-blue-700" },
  rejected: { label: "Reddedildi", className: "bg-red-50 text-red-700" },
  cancelled: { label: "İptal Edildi", className: "bg-neutral-100 text-neutral-600" },
  completed: { label: "Tamamlandı", className: "bg-green-50 text-green-700" },
  expired: { label: "Süresi Doldu", className: "bg-red-50 text-red-700" },
};

export function ReferralStatusBadge({ status }: { status: PartnerReferralStatus }) {
  const style = REFERRAL_STATUS_STYLES[status] ?? { label: status, className: "bg-neutral-100 text-neutral-600" };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}
