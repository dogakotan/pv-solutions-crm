import { Suspense } from "react";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { TableSkeleton } from "@/components/skeletons";
import { SetHeaderContent } from "@/components/page-header-slot";
import {
  getAuditLogs,
  AUDIT_ENTITY_TYPES,
  AUDIT_ENTITY_LABELS,
  AUDIT_ACTION_LABELS,
} from "@/lib/data/audit-logs";

function formatValues(values: unknown): string | null {
  if (values === null || values === undefined) return null;
  if (typeof values === "object" && Object.keys(values as object).length === 0) return null;
  return JSON.stringify(values);
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string }>;
}) {
  await requireRole(["admin"]);
  const { entityType } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <SetHeaderContent>
        <h1 className="truncate text-lg font-semibold text-foreground">İşlem Kayıtları</h1>
      </SetHeaderContent>

      <p className="text-sm text-muted">
        Lead silme, rol değişikliği, partner yönlendirme kararı gibi hassas işlemlerin denetim
        kaydı. Son 100 kayıt gösterilir.
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
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Filtrele
        </button>
        {entityType && (
          <a href="/admin/audit-log" className="rounded-lg border border-card-border px-4 py-2 text-sm hover:bg-background">
            Temizle
          </a>
        )}
      </form>

      <Suspense fallback={<TableSkeleton rows={10} />}>
        <AuditLogTable entityType={entityType} />
      </Suspense>
    </div>
  );
}

async function AuditLogTable({ entityType }: { entityType?: string }) {
  const supabase = await createClient();
  const logs = await getAuditLogs(supabase, { entityType });

  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
        Kayıt bulunamadı.
      </div>
    );
  }

  return (
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
  );
}
