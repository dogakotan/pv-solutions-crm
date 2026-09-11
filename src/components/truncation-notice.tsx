export function TruncationNotice({ totalCount, shown }: { totalCount: number; shown: number }) {
  if (totalCount <= shown) return null;
  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
      Toplam {totalCount} lead var, en yeni {shown} tanesi gösteriliyor.
    </p>
  );
}
