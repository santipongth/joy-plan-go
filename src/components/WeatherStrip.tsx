import { useEffect, useState } from "react";
import type { Itinerary } from "@/lib/types";
import { fetchWeather, isForecastable, weatherIcon, type DailyWeather } from "@/lib/weather";
import { useT } from "@/lib/i18n";
import { Cloud } from "lucide-react";

interface Props {
  itinerary: Itinerary;
}

/** Picks the lat/lng of the itinerary's first place as the destination anchor. */
function pickAnchor(it: Itinerary): { lat: number; lng: number } | null {
  for (const d of it.days) {
    for (const p of d.places) {
      if (typeof p.lat === "number" && typeof p.lng === "number") return { lat: p.lat, lng: p.lng };
    }
  }
  return null;
}

export default function WeatherStrip({ itinerary }: Props) {
  const t = useT();
  const [data, setData] = useState<DailyWeather[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itinerary.startDate) return;
    if (!isForecastable(itinerary.startDate, itinerary.durationDays)) return;
    const anchor = pickAnchor(itinerary);
    if (!anchor) return;
    let cancelled = false;
    setLoading(true);
    fetchWeather({
      lat: anchor.lat,
      lng: anchor.lng,
      startDate: itinerary.startDate,
      days: itinerary.durationDays,
    })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [itinerary.id, itinerary.startDate, itinerary.durationDays]);

  if (!itinerary.startDate) return null;
  if (!isForecastable(itinerary.startDate, itinerary.durationDays)) return null;
  if (loading && !data) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-2 px-1 py-2">
        <Cloud className="h-3 w-3 animate-pulse" /> {t("loadingWeather")}
      </div>
    );
  }
  if (error || !data) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" aria-label={t("weatherForecast")}>
      {data.map((w, i) => {
        const wi = weatherIcon(w.weatherCode);
        const wet = w.precipProb >= 60;
        return (
          <div
            key={w.date}
            className={`min-w-[88px] rounded-lg border px-2 py-1.5 text-center bg-card ${
              wet ? "border-primary/60" : "border-border/60"
            }`}
            title={`${wi.label} · ${Math.round(w.tempMin)}° – ${Math.round(w.tempMax)}° · ${w.precipProb}%`}
          >
            <div className="text-[10px] text-muted-foreground font-medium">
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
  );
}
