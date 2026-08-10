import type { ActivityType, ActivityVisibility } from "@/types/activity";
import { ACTIVITY_TYPE_LABELS } from "@/types/activity";

export function ActivityTypeBadge({ type }: { type: ActivityType }) {
  return (
    <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
      {ACTIVITY_TYPE_LABELS[type] ?? type}
    </span>
  );
}

export function ActivityVisibilityBadge({ visibility }: { visibility: ActivityVisibility }) {
  if (visibility === "pv_internal") {
    return <span className="text-xs text-muted">İç kayıt</span>;
  }

  return (
    <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
      Partnerle paylaşıldı
    </span>
  );
}
