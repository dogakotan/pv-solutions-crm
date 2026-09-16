"use client";

import { startTransition, useRef, useState } from "react";
import Link from "next/link";
import { LeadStageBadge, LeadScoreBadge } from "@/components/lead-badges";
import type { AssignableLead } from "@/lib/data/assignments";

export type AssigneeOption = {
  id: string;
  label: string;
  openLeadCount?: number;
};

export function LeadAssignmentQueue({
  leads,
  assignees,
  assignAction,
  bulkAssignAction,
  selectName,
  selectPlaceholder,
  title,
  emptyMessage,
}: {
  leads: AssignableLead[];
  assignees: AssigneeOption[];
  assignAction: (formData: FormData) => Promise<{ error?: string }>;
  bulkAssignAction?: (leadIds: string[], assigneeId: string) => Promise<{ error?: string }>;
  selectName: string;
  selectPlaceholder: string;
  title: string;
  emptyMessage: string;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const rowSelectRefs = useRef<Record<string, HTMLSelectElement | null>>({});

  const canSuggest = assignees.some((a) => a.openLeadCount !== undefined);
  const allSelected = leads.length > 0 && selectedIds.size === leads.length;

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(leads.map((l) => l.id)));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function suggestFor(leadId: string) {
    const best = [...assignees].sort((a, b) => (a.openLeadCount ?? 0) - (b.openLeadCount ?? 0))[0];
    if (!best) return;
    const el = rowSelectRefs.current[leadId];
    if (el) el.value = best.id;
  }

  function handleRowAssign(leadId: string, formData: FormData) {
    setPendingLeadId(leadId);
    setRowError(null);
    // Server Action'ı bir <form action> prop'u yerine doğrudan bir event
    // handler'dan çağırırken startTransition ile sarmak Next.js'in
    // dokümante ettiği desen. Bundan bağımsız olarak, bu action'lar
    // önceden hata durumunda throw ediyordu — cacheComponents: true
    // altında, production build'de (dev'de değil) bu, gerçek hata mesajı
    // yerine React'ın kendi iç hatasının ("Minified React error #441")
    // görünmesine yol açıyordu. Hata artık throw yerine dönüş değeriyle
    // taşınıyor, bu da bu üretim-özel React/Flight sorununu tamamen atlıyor.
    startTransition(async () => {
      try {
        const result = await assignAction(formData);
        if (result.error) {
          setRowError({ id: leadId, message: result.error });
        }
      } catch (err) {
        setRowError({ id: leadId, message: err instanceof Error ? err.message : "Atama başarısız oldu." });
      } finally {
        setPendingLeadId(null);
      }
    });
  }

  function handleBulkAssign() {
    if (!bulkAssignAction || selectedIds.size === 0 || !bulkAssigneeId) return;
    setBulkPending(true);
    setBulkError(null);
    startTransition(async () => {
      try {
        const result = await bulkAssignAction([...selectedIds], bulkAssigneeId);
        if (result.error) {
          setBulkError(result.error);
        } else {
          setSelectedIds(new Set());
          setBulkAssigneeId("");
        }
      } catch (err) {
        setBulkError(err instanceof Error ? err.message : "Toplu atama başarısız oldu.");
      } finally {
        setBulkPending(false);
      }
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-foreground">
        {title} ({leads.length})
      </h2>

      {leads.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-card p-8 text-center text-sm text-muted shadow-sm">
          {emptyMessage}
        </div>
      ) : (
        <>
          {bulkAssignAction && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-card-border bg-card p-3 shadow-sm">
              <span className="text-sm text-muted">{selectedIds.size} seçili</span>
              <select
                value={bulkAssigneeId}
                onChange={(e) => setBulkAssigneeId(e.target.value)}
                className="rounded-lg border border-card-border px-2 py-1 text-sm"
              >
                <option value="">{selectPlaceholder}</option>
                {assignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBulkAssign}
                disabled={selectedIds.size === 0 || !bulkAssigneeId || bulkPending}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {bulkPending ? "Atanıyor..." : "Seçilenleri Ata"}
              </button>
              {bulkError && <span className="text-xs text-red-600">{bulkError}</span>}
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-card-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
                <tr>
                  {bulkAssignAction && (
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label="Tümünü seç"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3">Lead No</th>
                  <th className="px-4 py-3">Müşteri</th>
                  <th className="px-4 py-3">Şehir</th>
                  <th className="px-4 py-3">Puan</th>
                  <th className="px-4 py-3">Aşama</th>
                  <th className="px-4 py-3">Ata</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-card-border last:border-0">
                    {bulkAssignAction && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(lead.id)}
                          onChange={() => toggleOne(lead.id)}
                          aria-label={`${lead.customerName} seç`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Link href={`/leads/${lead.id}`} className="font-medium text-brand hover:underline">
                        {lead.leadNo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      <Link href={`/leads/${lead.id}`} className="hover:underline">
                        {lead.customerName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{lead.city}</td>
                    <td className="px-4 py-3">
                      <LeadScoreBadge score={lead.leadScore} />
                    </td>
                    <td className="px-4 py-3">
                      <LeadStageBadge stage={lead.stage} />
                    </td>
                    <td className="px-4 py-3">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleRowAssign(lead.id, new FormData(e.currentTarget));
                        }}
                        className="flex flex-col items-start gap-1"
                      >
                        <div className="flex items-center gap-2">
                          <input type="hidden" name="leadId" value={lead.id} />
                          <select
                            ref={(el) => {
                              rowSelectRefs.current[lead.id] = el;
                            }}
                            name={selectName}
                            defaultValue=""
                            required
                            className="rounded-lg border border-card-border px-2 py-1 text-sm"
                          >
                            <option value="" disabled>
                              {selectPlaceholder}
                            </option>
                            {assignees.map((assignee) => (
                              <option key={assignee.id} value={assignee.id}>
                                {assignee.label}
                              </option>
                            ))}
                          </select>
                          {canSuggest && (
                            <button
                              type="button"
                              onClick={() => suggestFor(lead.id)}
                              className="rounded-lg border border-card-border px-2 py-1 text-xs hover:bg-background"
                            >
                              Öner
                            </button>
                          )}
                          <button
                            type="submit"
                            disabled={pendingLeadId === lead.id}
                            className="rounded-lg border border-card-border px-2 py-1 text-xs hover:bg-background disabled:opacity-50"
                          >
                            {pendingLeadId === lead.id ? "Atanıyor..." : "Ata"}
                          </button>
                        </div>
                        {rowError?.id === lead.id && (
                          <span className="text-xs text-red-600">{rowError.message}</span>
                        )}
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
