import { useEffect, useState } from "react";
import { searchPlaces, type NominatimPlace } from "@/lib/nominatim";
import { useLangStore } from "@/lib/i18n";
import { Input } from "@/components/ui/input";

interface Props {
  value: string;
  onChange: (val: string, place?: NominatimPlace) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}

export function PlaceAutocomplete({ value, onChange, placeholder, icon }: Props) {
  const lang = useLangStore((s) => s.lang);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<NominatimPlace[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!value || value.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await searchPlaces(value, lang);
      setResults(r);
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [value, lang]);

  return (
    <div className="relative">
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</div>}
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className={icon ? "pl-9" : ""}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-popover shadow-lg">
          {loading && <div className="px-3 py-2 text-sm text-muted-foreground">...</div>}
          {results.map((r) => (
            <button
              type="button"
              key={r.place_id}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(r.display_name.split(",")[0], r);
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-accent"
            >
              <div className="font-medium truncate">{r.display_name.split(",")[0]}</div>
              <div className="text-xs text-muted-foreground truncate">{r.display_name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
