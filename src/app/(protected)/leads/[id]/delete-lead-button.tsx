"use client";

import { useRef } from "react";

export function DeleteLeadButton({
  leadId,
  deleteAction,
}: {
  leadId: string;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
      >
        Lead&apos;i Sil
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="fixed inset-0 m-auto max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-card-border bg-card p-0 text-foreground backdrop:bg-black/40"
      >
        <form action={deleteAction} className="flex flex-col gap-4 p-6">
          <input type="hidden" name="leadId" value={leadId} />
          <div>
            <h3 className="text-base font-semibold text-foreground">Lead&apos;i sil</h3>
            <p className="mt-1 text-sm text-muted">
              Bu lead arşivlenir (kalıcı olarak silinmez) ve listelerde görünmez olur. Bu işlem
              geri alınamaz.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Gerekçe (opsiyonel)</label>
            <textarea
              name="reason"
              rows={2}
              className="rounded-lg border border-card-border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-lg border border-card-border px-3 py-1.5 text-sm hover:bg-background"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Evet, sil
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
