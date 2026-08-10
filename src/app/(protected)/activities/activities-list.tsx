"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ActivityFeedItem } from "@/lib/data/activities";
import type { ActivityType } from "@/types/activity";
import { ACTIVITY_TYPE_LABELS } from "@/types/activity";
import { ActivityTypeBadge, ActivityVisibilityBadge } from "@/components/activity-badges";

const PAGE_SIZE = 10;

const inputClass =
  "rounded-lg border border-card-border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

export function ActivitiesList({
  activities,
  canOpenLead,
}: {
  activities: ActivityFeedItem[];
  canOpenLead: boolean;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ActivityType | "all">("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activities.filter((activity) => {
      const matchesType = typeFilter === "all" || activity.activityType === typeFilter;
      const matchesQuery =
        query === "" ||
        activity.leadNo.toLowerCase().includes(query) ||
        activity.customerName.toLowerCase().includes(query) ||
        activity.title.toLowerCase().includes(query);
      return matchesType && matchesQuery;
    });
  }, [activities, search, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageActivities = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Lead no, müşteri veya başlık ara..."
          className={`${inputClass} sm:w-72`}
        />
        <select
          aria-label="Türe göre filtrele"
          value={typeFilter}
          onChange={(event) => {
            setTypeFilter(event.target.value as ActivityType | "all");
            setPage(1);
          }}
          className={`${inputClass} sm:w-56`}
        >
          <option value="all">Tüm türler</option>
          {Object.entries(ACTIVITY_TYPE_LABELS).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
          Arama/filtre kriterlerine uyan aktivite bulunamadı.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {pageActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex flex-col gap-2 rounded-2xl border border-card-border bg-card p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <ActivityTypeBadge type={activity.activityType} />
                    <ActivityVisibilityBadge visibility={activity.visibility} />
                  </div>
                  <p className="text-sm font-medium text-foreground">{activity.title}</p>
                  {activity.description && (
                    <p className="mt-1 text-sm text-muted">{activity.description}</p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {canOpenLead ? (
                      <Link href={`/leads/${activity.leadId}`} className="text-brand hover:underline">
                        {activity.leadNo}
                      </Link>
                    ) : (
                      activity.leadNo
                    )}
                    {" — "}
                    {activity.customerName} · {activity.createdByName}
                    {activity.occurredAt && ` — ${new Date(activity.occurredAt).toLocaleString("tr-TR")}`}
                  </p>
                </div>
                {activity.nextFollowUpAt && (
                  <p className="whitespace-nowrap text-xs text-muted">
                    Sonraki takip: {new Date(activity.nextFollowUpAt).toLocaleString("tr-TR")}
                  </p>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                Sayfa {currentPage} / {totalPages} — {filtered.length} aktivite
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-card-border px-3 py-1.5 hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Önceki
                </button>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-card-border px-3 py-1.5 hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sonraki
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
