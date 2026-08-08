import { useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";

const SWATCHES = [
  "#0B0B0F", "#2B2D33", "#6B7280", "#FAF8F5", "#FFFFFF",
  "#C4993B", "#E4B363", "#D64545", "#F26A4B", "#E2557C",
  "#8B5CF6", "#4F46E5", "#2563EB", "#0EA5A4", "#16A34A",
];

const normalise = (v: string) => {
  let s = v.trim();
  if (!s.startsWith("#")) s = `#${s}`;
  return s.toUpperCase();
};

const isValid = (v: string) => /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v);

interface ColorPickerFieldProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

const ColorPickerField = ({ label, value, onChange }: ColorPickerFieldProps) => {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const commit = (raw: string) => {
    const hex = normalise(raw);
    if (isValid(hex)) onChange(hex);
    else setDraft(value);
  };

  return (
    <div className="space-y-2">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Pick ${label} colour`}
            className="h-20 w-full rounded-xl border border-border overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow hover:shadow-flat"
            style={{ backgroundColor: value }}
          />
        </PopoverTrigger>
        <PopoverContent align="center" className="w-[248px] p-3 space-y-3">
          <HexColorPicker
            color={value}
            onChange={onChange}
            style={{ width: "100%", height: 150 }}
          />
          <div className="grid grid-cols-5 gap-1.5">
            {SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={hex}
                onClick={() => onChange(hex)}
                className="h-7 w-full rounded-md border border-border grid place-items-center"
                style={{ backgroundColor: hex }}
              >
                {value.toUpperCase() === hex && (
                  <Check className="h-3.5 w-3.5" style={{ color: hex === "#FFFFFF" || hex === "#FAF8F5" ? "#2B2D33" : "#FFFFFF" }} />
                )}
              </button>
            ))}
          </div>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit((e.target as HTMLInputElement).value);
              }
            }}
            spellCheck={false}
            className="h-9 font-mono text-xs uppercase text-center"
            aria-label={`${label} hex value`}
          />
        </PopoverContent>
      </Popover>
      <span className="block text-center text-[11px] font-mono text-muted-foreground">
        {value.toUpperCase()}
      </span>
    </div>
  );
};

export default ColorPickerField;
