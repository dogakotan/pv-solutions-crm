"use client";

import { useState } from "react";

export function MarkReadButton({
  action,
  label,
  pendingLabel,
  className,
}: {
  action: () => Promise<void>;
  label: string;
  pendingLabel: string;
  className: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız oldu.");
    } finally {
      setPending(false);
    }
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
