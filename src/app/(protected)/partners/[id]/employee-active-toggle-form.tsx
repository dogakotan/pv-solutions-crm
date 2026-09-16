"use client";

import { useActionState } from "react";

export function EmployeeActiveToggleForm({
  action,
  userId,
  isActive,
}: {
  action: (prevState: { error?: string }, formData: FormData) => Promise<{ error?: string }>;
  userId: string;
  isActive: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="isActive" value={(!isActive).toString()} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-card-border px-2 py-1 text-xs hover:bg-background disabled:opacity-50"
        >
          {isActive ? "Pasifleştir" : "Aktifleştir"}
        </button>
      </form>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </div>
  );
}
