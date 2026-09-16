"use client";

import { startTransition, useMemo, useState } from "react";
import type { StaffUser } from "@/lib/data/users";
import type { DbRole } from "@/lib/auth/roles";

const inputClass =
  "rounded-lg border border-card-border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

export function UsersTable({
  users,
  roleOptions,
  updateRoleAction,
  updateActiveAction,
}: {
  users: StaffUser[];
  roleOptions: [DbRole, string][];
  updateRoleAction: (formData: FormData) => Promise<{ error?: string }>;
  updateActiveAction: (formData: FormData) => Promise<{ error?: string }>;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesQuery =
        query === "" ||
        (user.fullName ?? "").toLowerCase().includes(query) ||
        (user.email ?? "").toLowerCase().includes(query);
      return matchesRole && matchesQuery;
    });
  }, [users, search, roleFilter]);

  function handleRoleSubmit(userId: string, formData: FormData) {
    setPendingId(userId);
    setRowError(null);
    startTransition(async () => {
      try {
        const result = await updateRoleAction(formData);
        if (result.error) {
          setRowError({ id: userId, message: result.error });
        }
      } catch (err) {
        setRowError({ id: userId, message: err instanceof Error ? err.message : "Rol güncellenemedi." });
      } finally {
        setPendingId(null);
      }
    });
  }

  function handleActiveSubmit(userId: string, formData: FormData) {
    setPendingId(userId);
    setRowError(null);
    startTransition(async () => {
      try {
        const result = await updateActiveAction(formData);
        if (result.error) {
          setRowError({ id: userId, message: result.error });
        }
      } catch (err) {
        setRowError({ id: userId, message: err instanceof Error ? err.message : "Durum güncellenemedi." });
      } finally {
        setPendingId(null);
      }
    });
  }

  if (users.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
        Henüz kullanıcı bulunmuyor.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ad veya e-posta ara..."
          className={`${inputClass} sm:w-72`}
        />
        <select
          aria-label="Role göre filtrele"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className={`${inputClass} sm:ml-auto sm:w-56`}
        >
          <option value="all">Tüm roller</option>
          {roleOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-card-border bg-card p-12 text-center text-sm text-muted shadow-sm">
          Arama/filtre kriterlerine uyan kullanıcı bulunamadı.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-card-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Ad Soyad</th>
                <th className="px-4 py-3">E-posta</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Durum</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="border-b border-card-border align-top last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{user.fullName || "—"}</td>
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3">
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleRoleSubmit(user.id, new FormData(event.currentTarget));
                      }}
                      className="flex flex-col gap-1"
                    >
                      <div className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <select
                          name="role"
                          defaultValue={user.role ?? ""}
                          className="rounded-lg border border-card-border px-2 py-1 text-sm"
                        >
                          <option value="" disabled>
                            Rol seç
                          </option>
                          {roleOptions.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          disabled={pendingId === user.id}
                          className="rounded-lg border border-card-border px-2 py-1 text-xs hover:bg-background disabled:opacity-50"
                        >
                          {pendingId === user.id ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                      </div>
                      {rowError?.id === user.id && (
                        <span className="text-xs text-red-600">{rowError.message}</span>
                      )}
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleActiveSubmit(user.id, new FormData(event.currentTarget));
                      }}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="isActive" value={String(!user.isActive)} />
                      <span
                        className={
                          user.isActive
                            ? "inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700"
                            : "inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
                        }
                      >
                        {user.isActive ? "Aktif" : "Pasif"}
                      </span>
                      <button
                        type="submit"
                        disabled={pendingId === user.id}
                        className="rounded-lg border border-card-border px-2 py-1 text-xs hover:bg-background disabled:opacity-50"
                      >
                        {pendingId === user.id ? "..." : user.isActive ? "Pasif yap" : "Aktif yap"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
