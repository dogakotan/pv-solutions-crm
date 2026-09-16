export const inputClass =
  "rounded-lg border border-card-border px-3 py-2 outline-none focus:border-brand focus:ring-1 focus:ring-brand";

export const SCORE_OPTIONS = [
  { value: "", label: "Puanlanmadı" },
  { value: "hot", label: "Sıcak" },
  { value: "warm", label: "Ilık" },
  { value: "mid", label: "Orta" },
  { value: "cold", label: "Soğuk" },
];

export const INTEREST_OPTIONS = [
  { value: "", label: "Belirtilmedi" },
  { value: "yes", label: "Evet" },
  { value: "no", label: "Hayır" },
  { value: "considering", label: "Değerlendiriyor" },
];

export const COMPETITOR_OPTIONS = [
  { value: "", label: "Belirtilmedi" },
  { value: "none", label: "Yok" },
  { value: "exists", label: "Var" },
  { value: "unknown", label: "Bilinmiyor" },
];

export function InterestField({
  name,
  label,
  defaultValue,
  value,
  onChange,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const controlledProps =
    value !== undefined
      ? { value, onChange: (e: { target: { value: string } }) => onChange?.(e.target.value) }
      : { defaultValue: defaultValue ?? "" };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <select name={name} className={inputClass} {...controlledProps}>
        {INTEREST_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
