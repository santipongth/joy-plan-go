import { useEffect, useMemo, useState } from "react";
import type { Itinerary } from "@/lib/types";
import { fetchWeather, isForecastable, weatherIcon, type DailyWeather } from "@/lib/weather";
import { useT, useLangStore } from "@/lib/i18n";
import { Cloud, MapPin, Search } from "lucide-react";
import { useWeatherAnchorStore } from "@/lib/weather-anchor-store";
import { useMapBoundsStore } from "@/lib/map-bounds-store";
import { searchInBounds, type NominatimPlace } from "@/lib/nominatim";
import { format, addDays, parseISO } from "date-fns";
import { th, enUS } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  itinerary: Itinerary;
}

interface AnchorOption {
  id: string;
  label: string;
  dayLabel: string;
  lat: number;
  lng: number;
}

function buildOptions(it: Itinerary): AnchorOption[] {
  const out: AnchorOption[] = [];
  it.days.forEach((d) => {
    d.places.forEach((p) => {
      if (typeof p.lat === "number" && typeof p.lng === "number") {
        out.push({
          id: p.id,
          label: p.name,
          dayLabel: `Day ${d.day}`,
          lat: p.lat,
          lng: p.lng,
        });
      }
    });
  });
  return out;
}

export default function WeatherStrip({ itinerary }: Props) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const locale = lang === "th" ? th : enUS;
  const [data, setData] = useState<DailyWeather[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const anchors = useWeatherAnchorStore((s) => s.anchors);
  const setAnchor = useWeatherAnchorStore((s) => s.setAnchor);
  const bounds = useMapBoundsStore((s) => s.bounds);

  // map-pin nearby state (custom anchor)
  const [customAnchor, setCustomAnchor] = useState<{ id: string; label: string; lat: number; lng: number } | null>(null);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [nearbyQuery, setNearbyQuery] = useState("");
  const [nearbyResults, setNearbyResults] = useState<NominatimPlace[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const options = useMemo(() => buildOptions(itinerary), [itinerary]);
  const selected = anchors[itinerary.id] ?? "auto";

  const active = useMemo(() => {
    if (selected === "custom" && customAnchor) return customAnchor;
    if (selected === "auto") return options[0] ?? null;
    return options.find((o) => o.id === selected) ?? options[0] ?? null;
  }, [selected, options, customAnchor]);

  useEffect(() => {
    if (!itinerary.startDate) return;
    if (!isForecastable(itinerary.startDate, itinerary.durationDays)) return;
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWeather({
      lat: active.lat,
      lng: active.lng,
      startDate: itinerary.startDate,
      days: itinerary.durationDays,
    })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [itinerary.id, itinerary.startDate, itinerary.durationDays, active?.lat, active?.lng]);

  async function runNearbySearch() {
    if (!bounds) return;
    setNearbyLoading(true);
    try {
      const results = await searchInBounds(nearbyQuery, bounds, lang);
      setNearbyResults(results);
    } finally {
      setNearbyLoading(false);
    }
  }

  function pickNearby(p: NominatimPlace) {
    const lat = parseFloat(p.lat);
    const lng = parseFloat(p.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const label = p.name || p.display_name.split(",")[0];
    setCustomAnchor({ id: `custom-${p.place_id}`, label, lat, lng });
    setAnchor(itinerary.id, "custom");
    setNearbyOpen(false);
  }

  if (!itinerary.startDate) return null;
  if (!isForecastable(itinerary.startDate, itinerary.durationDays)) return null;
  if (!active) return null;

  const dateFmt = lang === "th" ? "d MMM" : "MMM d";
  const startD = (() => {
    try {
      return parseISO(itinerary.startDate!);
    } catch {
      return null;
    }
  })();

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-1 flex-wrap">
        <MapPin className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">{t("weatherAnchor")}:</span>
        <Select
          value={selected}
          onValueChange={(v) => setAnchor(itinerary.id, v)}
        >
          <SelectTrigger className="h-7 text-xs px-2 w-auto min-w-[140px] max-w-[260px]">
            <SelectValue>
              {selected === "custom" && customAnchor ? customAnchor.label : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">{t("weatherAnchorAuto")}</SelectItem>
            {customAnchor && (
              <SelectItem value="custom">📍 {customAnchor.label}</SelectItem>
            )}
            {options.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[10px]">{t("places")}</SelectLabel>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    <span className="text-muted-foreground mr-1">{o.dayLabel}·</span>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <Popover open={nearbyOpen} onOpenChange={setNearbyOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1">
              <Search className="h-3 w-3" />
              {t("weatherAnchorNearby")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2 space-y-2" align="start">
            {!bounds ? (
              <p className="text-xs text-muted-foreground p-2">{t("weatherAnchorMoveMap")}</p>
            ) : (
              <>
                <div className="flex gap-1">
                  <Input
                    value={nearbyQuery}
                    onChange={(e) => setNearbyQuery(e.target.value)}
                    placeholder={t("weatherAnchorSearch")}
                    className="h-7 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") runNearbySearch();
                    }}
                  />
                  <Button size="sm" className="h-7" onClick={runNearbySearch} disabled={nearbyLoading}>
                    <Search className="h-3 w-3" />
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-0.5">
                  {nearbyLoading && (
                    <p className="text-xs text-muted-foreground p-2">…</p>
                  )}
                  {!nearbyLoading && nearbyResults.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">—</p>
                  )}
                  {nearbyResults.map((p) => (
                    <button
                      key={p.place_id}
                      type="button"
                      onClick={() => pickNearby(p)}
                      className="w-full text-left text-xs p-1.5 rounded hover:bg-muted line-clamp-2"
                      title={p.display_name}
                    >
                      <span className="font-medium">{p.name || p.display_name.split(",")[0]}</span>
                      <span className="block text-[10px] text-muted-foreground line-clamp-1">
                        {p.display_name}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </PopoverContent>
        </Popover>
      </div>
      {loading && !data ? (
        <div className="text-xs text-muted-foreground flex items-center gap-2 px-1 py-2">
          <Cloud className="h-3 w-3 animate-pulse" /> {t("loadingWeather")}
        </div>
      ) : error || !data ? null : (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" aria-label={t("weatherForecast")}>
          {data.map((w, i) => {
            const wi = weatherIcon(w.weatherCode);
            const wet = w.precipProb >= 60;
            const dateLabel = startD
              ? format(addDays(startD, i), dateFmt, { locale })
              : `${t("day")} ${i + 1}`;
            return (
              <div
                key={w.date}
                className={`min-w-[88px] rounded-lg border px-2 py-1.5 text-center bg-card ${
                  wet ? "border-primary/60" : "border-border/60"
                }`}
                title={`${wi.label} · ${Math.round(w.tempMin)}° – ${Math.round(w.tempMax)}° · ${w.precipProb}%`}
              >
                <div className="text-[11px] font-semibold text-foreground">{dateLabel}</div>
                <div className="text-[10px] text-muted-foreground -mt-0.5">
                  {t("day")} {i + 1}
                </div>
                <div className="text-xl leading-tight">{wi.icon}</div>
                <div className="text-[11px] font-medium">
                  {Math.round(w.tempMin)}° / {Math.round(w.tempMax)}°
                </div>
                <div className={`text-[10px] ${wet ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                  💧 {w.precipProb}%
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
