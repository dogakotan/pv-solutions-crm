"use client";

import { startTransition, useState } from "react";

export function MarkReadButton({
  action,
  label,
  pendingLabel,
  className,
}: {
  action: () => Promise<{ error?: string }>;
  label: string;
  pendingLabel: string;
  className: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setPending(true);
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) {
          setError(result.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "İşlem başarısız oldu.");
      } finally {
        setPending(false);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={handleClick} disabled={pending} className={className}>
        {pending ? pendingLabel : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
