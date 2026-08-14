const RAY_COUNT = 8;

/**
 * Ekran görüntüsündeki marka konseptine yakın basit bir ikon + yazı.
 * Gerçek marka dosyası (SVG/PNG) geldiğinde bu bileşenin içeriği
 * değiştirilecek, kullanım yerleri (Logo import'u) aynı kalabilir.
 */
export function Logo({
  withSubtitle = true,
  iconOnly = false,
}: {
  withSubtitle?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
        <circle cx="16" cy="16" r="6.5" fill="var(--brand)" />
        {Array.from({ length: RAY_COUNT }).map((_, i) => (
          <rect
            key={i}
            x="14.5"
            y="2.5"
            width="3"
            height="7"
            rx="1.5"
            fill="var(--brand)"
            opacity={0.9}
            transform={`rotate(${(i * 360) / RAY_COUNT} 16 16)`}
          />
        ))}
      </svg>
      {!iconOnly && (
        <div className="leading-tight">
          <span className="text-lg font-bold tracking-tight">
            <span className="text-foreground">pv</span>{" "}
            <span className="font-semibold text-muted">solutions</span>
          </span>
          {withSubtitle && <p className="text-xs text-muted">Partner Lead CRM</p>}
        </div>
      )}
    </div>
  );
}
