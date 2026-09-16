"use client";

import { useActionState, useRef } from "react";
import { OfferVersionStatusBadge } from "@/components/offer-badges";
import type { OfferVersionItem } from "@/lib/data/offers";
import type { ActionFormState } from "@/app/(protected)/leads/[id]/actions";

type RowAction = (prevState: ActionFormState, formData: FormData) => Promise<ActionFormState>;

const noopAction: RowAction = async () => ({});

function SubmitButton({
  pending,
  className,
  children,
}: {
  pending: boolean;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-50`}>
      {children}
    </button>
  );
}

// Kabul edilmiş bir revizyon silinemez — bu, delete_offer_version RPC'sinin
// de uyguladığı kısıt, burada yalnızca butonu göstermemek için tekrarlanıyor.
const NON_DELETABLE_STATUSES = new Set(["accepted"]);

export function OfferVersionRow({
  version,
  excelHref,
  canDelete,
  deleteAction,
  canRespond,
  respondAction,
  hiddenFields,
}: {
  version: OfferVersionItem;
  excelHref: string;
  canDelete: boolean;
  deleteAction: RowAction;
  canRespond?: boolean;
  respondAction?: RowAction;
  hiddenFields: Record<string, string>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // İki ayrı useActionState — accept/reject'in pending/hata durumu delete'i
  // (veya tam tersini) etkilemesin diye. Kabul/Reddet aynı state'i paylaşıyor
  // çünkü ikisi de respond_to_offer'ı çağırıyor ve tek seferde yalnızca biri
  // gönderilebilir (çift tıklama koruması RPC'nin kendi atomik UPDATE'inde).
  const [respondState, respondFormAction, respondPending] = useActionState(respondAction ?? noopAction, {});
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteAction, {});
  const showDeleteButton = canDelete && !NON_DELETABLE_STATUSES.has(version.status);
  const showRespondButtons = canRespond && respondAction && version.status === "sent";

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-card-border p-3 text-left hover:bg-background sm:p-4"
      >
        <div>
          <p className="text-sm font-medium text-foreground">
            Rev.{version.revisionNo}
          </p>
          <p className="text-sm text-muted">
            {version.amount.toLocaleString("tr-TR")} {version.currency}
            {version.vatIncluded ? " (KDV dahil)" : " (KDV hariç)"}
          </p>
        </div>
        <OfferVersionStatusBadge status={version.status} />
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="fixed inset-0 m-auto max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-card-border bg-card p-0 text-foreground backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Rev.{version.revisionNo}</h3>
              <p className="mt-1 text-sm text-muted">
                {version.amount.toLocaleString("tr-TR")} {version.currency}
                {version.vatIncluded ? " (KDV dahil)" : " (KDV hariç)"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <OfferVersionStatusBadge status={version.status} />
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label="Kapat"
                className="rounded-lg border border-card-border px-2 py-1 text-sm text-muted hover:bg-background"
              >
                ✕
              </button>
            </div>
          </div>

          <dl className="flex flex-col gap-2 text-sm">
            {version.validUntil && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Geçerlilik Tarihi</dt>
                <dd className="text-foreground">
                  {new Date(version.validUntil).toLocaleDateString("tr-TR")}
                </dd>
              </div>
            )}
            {version.paymentMethod && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Ödeme Şekli</dt>
                <dd className="text-foreground">{version.paymentMethod}</dd>
              </div>
            )}
            {version.shippingTerms && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Nakliye</dt>
                <dd className="text-foreground">{version.shippingTerms}</dd>
              </div>
            )}
          </dl>

          {version.scopeSummary && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Kapsam Özeti</p>
              <p className="text-sm text-foreground">{version.scopeSummary}</p>
            </div>
          )}

          {version.items.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Ürün Kalemleri</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted">
                    <tr>
                      <th className="py-1 pr-2">Ürün Kodu</th>
                      <th className="py-1 pr-2">Ürün</th>
                      <th className="py-1 pr-2 text-right">Adet</th>
                      <th className="py-1 pr-2 text-right">Birim Fiyat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {version.items.map((item) => (
                      <tr key={item.id} className="border-t border-card-border">
                        <td className="py-1 pr-2">{item.productCode || "—"}</td>
                        <td className="py-1 pr-2">{item.productName}</td>
                        <td className="py-1 pr-2 text-right">{item.quantity}</td>
                        <td className="py-1 pr-2 text-right">{item.unitPrice.toLocaleString("tr-TR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-card-border pt-4">
            <a
              href={excelHref}
              className="rounded-lg border border-card-border px-3 py-1.5 text-xs hover:bg-background"
            >
              Excel İndir
            </a>
            {showRespondButtons && (
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                  <form action={respondFormAction}>
                    {Object.entries(hiddenFields).map(([name, value]) => (
                      <input key={name} type="hidden" name={name} value={value} />
                    ))}
                    <input type="hidden" name="decision" value="accept" />
                    <SubmitButton
                      pending={respondPending}
                      className="rounded-lg border border-green-200 px-3 py-1.5 text-xs text-green-700 hover:bg-green-50"
                    >
                      Kabul Et
                    </SubmitButton>
                  </form>
                  <form action={respondFormAction}>
                    {Object.entries(hiddenFields).map(([name, value]) => (
                      <input key={name} type="hidden" name={name} value={value} />
                    ))}
                    <input type="hidden" name="decision" value="reject" />
                    <SubmitButton
                      pending={respondPending}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      Reddet
                    </SubmitButton>
                  </form>
                </div>
                {respondState.error && <p className="text-xs text-red-600">{respondState.error}</p>}
              </div>
            )}
            {showDeleteButton && (
              <form action={deleteFormAction} className="flex flex-col items-start gap-1">
                {Object.entries(hiddenFields).map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ))}
                <SubmitButton
                  pending={deletePending}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                >
                  Sil
                </SubmitButton>
                {deleteState.error && <p className="text-xs text-red-600">{deleteState.error}</p>}
              </form>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
