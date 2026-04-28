import { useEffect, useMemo, useState } from "react";
import type { Itinerary } from "@/lib/types";
import { fetchWeather, isForecastable, weatherIcon, type DailyWeather } from "@/lib/weather";
import { useT, useLangStore } from "@/lib/i18n";
import { Cloud } from "lucide-react";
import { useWeatherAnchorStore } from "@/lib/weather-anchor-store";
import { format, addDays, parseISO } from "date-fns";
import { th, enUS } from "date-fns/locale";

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

  const options = useMemo(() => buildOptions(itinerary), [itinerary]);
  const selected = anchors[itinerary.id] ?? "auto";

  const active = useMemo(() => {
    if (selected === "auto") return options[0] ?? null;
    return options.find((o) => o.id === selected) ?? options[0] ?? null;
  }, [selected, options]);

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
