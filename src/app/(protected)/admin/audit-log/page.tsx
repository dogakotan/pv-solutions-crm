import { Suspense } from "react";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { TableSkeleton } from "@/components/skeletons";
import { SetHeaderContent } from "@/components/page-header-slot";
import {
  getAuditLogs,
  getAuditLogActors,
  AUDIT_ENTITY_TYPES,
  AUDIT_ENTITY_LABELS,
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
} from "@/lib/data/audit-logs";

const PAGE_SIZE = 50;

function formatValues(values: unknown): string | null {
  if (values === null || values === undefined) return null;
  if (typeof values === "object" && Object.keys(values as object).length === 0) return null;
  return JSON.stringify(values);
}

type AuditLogSearchParams = {
  entityType?: string;
  action?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  offset?: string;
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<AuditLogSearchParams>;
}) {
  await requireRole(["admin"]);
  const params = await searchParams;
  const { entityType, action, actorId, dateFrom, dateTo, q } = params;
  const hasFilters = Boolean(entityType || action || actorId || dateFrom || dateTo || q);

  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">İşlem Kayıtları</h1>
      </SetHeaderContent>

      <p className="text-sm text-muted">
        Lead silme, rol değişikliği, partner yönlendirme kararı gibi hassas işlemlerin denetim kaydı.
      </p>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-card-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor="entity-type" className="text-xs font-medium text-muted">Varlık Türü</label>
          <select
            id="entity-type"
            name="entityType"
            defaultValue={entityType ?? ""}
            className="rounded-lg border border-card-border px-3 py-2 text-sm"
          >
            <option value="">Tümü</option>
            {AUDIT_ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {AUDIT_ENTITY_LABELS[type] ?? type}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="action" className="text-xs font-medium text-muted">İşlem</label>
          <select
            id="action"
            name="action"
            defaultValue={action ?? ""}
            className="rounded-lg border border-card-border px-3 py-2 text-sm"
          >
            <option value="">Tümü</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {AUDIT_ACTION_LABELS[a] ?? a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="actor-id" className="text-xs font-medium text-muted">Kullanıcı</label>
          <Suspense fallback={<div className="h-[38px] w-40 rounded-lg border border-card-border bg-background" />}>
            <ActorFilterSelect actorId={actorId} />
          </Suspense>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="date-from" className="text-xs font-medium text-muted">Başlangıç Tarihi</label>
          <input
            id="date-from"
            type="date"
            name="dateFrom"
            defaultValue={dateFrom ?? ""}
            className="rounded-lg border border-card-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="date-to" className="text-xs font-medium text-muted">Bitiş Tarihi</label>
          <input
            id="date-to"
            type="date"
            name="dateTo"
            defaultValue={dateTo ?? ""}
            className="rounded-lg border border-card-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-xs font-medium text-muted">Gerekçede Ara</label>
          <input
            id="q"
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Gerekçe metni..."
            className="rounded-lg border border-card-border px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Filtrele
        </button>
        {hasFilters && (
          <a href="/admin/audit-log" className="rounded-lg border border-card-border px-4 py-2 text-sm hover:bg-background">
            Temizle
          </a>
        )}
      </form>

      <Suspense fallback={<TableSkeleton rows={10} />}>
        <AuditLogTable {...params} />
      </Suspense>
    </div>
  );
}

async function ActorFilterSelect({ actorId }: { actorId?: string }) {
  const supabase = await createClient();
  const actors = await getAuditLogActors(supabase);

  return (
    <select
      id="actor-id"
      name="actorId"
      defaultValue={actorId ?? ""}
      className="rounded-lg border border-card-border px-3 py-2 text-sm"
    >
      <option value="">Tümü</option>
      {actors.map((actor) => (
        <option key={actor.id} value={actor.id}>
          {actor.fullName}
        </option>
      ))}
    </select>
  );
}

async function AuditLogTable({ entityType, action, actorId, dateFrom, dateTo, q, offset }: AuditLogSearchParams) {
  const supabase = await createClient();
  const currentOffset = Number(offset ?? 0) || 0;
  const { logs, hasMore } = await getAuditLogs(supabase, {
    limit: PAGE_SIZE,
    offset: currentOffset,
    entityType,
    action,
    actorId,
    dateFrom,
    dateTo,
    q,
  });

  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
        Kayıt bulunamadı.
      </div>
    );
  }

  function buildParams(nextOffset: number) {
    const p = new URLSearchParams();
    if (entityType) p.set("entityType", entityType);
    if (action) p.set("action", action);
    if (actorId) p.set("actorId", actorId);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    if (q) p.set("q", q);
    if (nextOffset > 0) p.set("offset", String(nextOffset));
    return p.toString();
  }

  const prevOffset = Math.max(0, currentOffset - PAGE_SIZE);
  const nextParams = buildParams(currentOffset + PAGE_SIZE);
  const prevParams = buildParams(prevOffset);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-card-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Kullanıcı</th>
              <th className="px-4 py-3">İşlem</th>
              <th className="px-4 py-3">Varlık</th>
              <th className="px-4 py-3">Değişiklik</th>
              <th className="px-4 py-3">Gerekçe</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const oldStr = formatValues(log.oldValues);
              const newStr = formatValues(log.newValues);
              return (
                <tr key={log.id} className="border-b border-card-border align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {new Date(log.createdAt).toLocaleString("tr-TR")}
                  </td>
                  <td className="px-4 py-3 text-foreground">{log.actorName ?? "—"}</td>
                  <td className="px-4 py-3 text-foreground">
                    {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {AUDIT_ENTITY_LABELS[log.entityType] ?? log.entityType}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-muted">
                    {oldStr && <p className="truncate" title={oldStr}>Önce: {oldStr}</p>}
                    {newStr && <p className="truncate" title={newStr}>Sonra: {newStr}</p>}
                    {!oldStr && !newStr && "—"}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-muted">{log.reason ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(currentOffset > 0 || hasMore) && (
        <div className="flex items-center justify-center gap-3">
          {currentOffset > 0 && (
            <a
              href={`/admin/audit-log?${prevParams}`}
              className="rounded-lg border border-card-border px-4 py-2 text-sm hover:bg-background"
            >
              ← Önceki Sayfa
            </a>
          )}
          {hasMore && (
            <a
              href={`/admin/audit-log?${nextParams}`}
              className="rounded-lg border border-card-border px-4 py-2 text-sm hover:bg-background"
            >
              Sonraki Sayfa →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
