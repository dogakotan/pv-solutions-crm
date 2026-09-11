"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

type SearchResult = {
  entityType: "lead" | "partner" | "offer";
  entityId: string;
  primaryLabel: string;
  secondaryLabel: string | null;
  tertiaryLabel: string | null;
};

const GROUP_LABELS: Record<SearchResult["entityType"], string> = {
  lead: "Lead'ler",
  partner: "Partnerler",
  offer: "Teklifler",
};

function resultHref(result: SearchResult): string {
  switch (result.entityType) {
    case "lead":
      return `/leads/${result.entityId}`;
    case "partner":
      return `/partners/${result.entityId}`;
    case "offer":
      return `/offers/${result.entityId}`;
  }
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      setResults([]);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal, cache: "no-store" })
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((data) => setResults(data.results ?? []))
        .catch((err) => {
          if (err.name !== "AbortError") setResults([]);
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const trimmedQuery = query.trim();
  const showDropdown = open && trimmedQuery.length >= 2;
  const groups: Array<[SearchResult["entityType"], SearchResult[]]> = (["lead", "partner", "offer"] as const)
    .map((type) => [type, results.filter((r) => r.entityType === type)] as [SearchResult["entityType"], SearchResult[]])
    .filter(([, items]) => items.length > 0);

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Lead, partner, teklif ara..."
          aria-label="Genel arama"
          className="w-56 rounded-lg border border-card-border py-2 pl-8 pr-3 text-sm outline-none focus:w-72 focus:border-brand focus:ring-1 focus:ring-brand"
        />
      </div>

      {showDropdown && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-card-border bg-card shadow-lg">
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-muted">Aranıyor...</p>
            ) : groups.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">Sonuç bulunamadı</p>
            ) : (
              groups.map(([type, items]) => (
                <div key={type} className="border-b border-card-border last:border-0">
                  <p className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted">
                    {GROUP_LABELS[type]}
                  </p>
                  {items.map((item) => (
                    <Link
                      key={`${item.entityType}-${item.entityId}`}
                      href={resultHref(item)}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2 hover:bg-background"
                    >
                      <p className="truncate text-sm font-medium text-foreground">{item.primaryLabel}</p>
                      <p className="truncate text-xs text-muted">
                        {[item.secondaryLabel, item.tertiaryLabel].filter(Boolean).join(" · ")}
                      </p>
                    </Link>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
