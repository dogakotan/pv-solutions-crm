"use client";

export function ExportCsvButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  function handleExport() {
    const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="rounded-lg border border-card-border px-3 py-1.5 text-xs text-foreground hover:bg-background"
    >
      CSV İndir
    </button>
  );
}
