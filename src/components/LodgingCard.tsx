import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { suggestLodging } from "@/server/suggest-lodging.functions";
import { useItineraryStore, makeId } from "@/lib/store";
import type { Itinerary, Lodging } from "@/lib/types";
import { useT, useLangStore } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BedDouble,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function buildBookingUrl(name: string, lat: number, lng: number) {
  const params = new URLSearchParams({
    ss: name,
    latitude: lat.toFixed(6),
    longitude: lng.toFixed(6),
  });
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}
function buildMapUrl(lat: number, lng: number, name: string) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${encodeURIComponent(name)}`;
}

function dayCenter(itinerary: Itinerary): { lat?: number; lng?: number } {
  const pts = itinerary.days.flatMap((d) =>
    d.places
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => ({ lat: p.lat, lng: p.lng })),
  );
  if (pts.length === 0) return {};
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  return { lat, lng };
}

export default function LodgingCard({ itinerary }: { itinerary: Itinerary }) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const addLodging = useItineraryStore((s) => s.addLodging);
  const removeLodging = useItineraryStore((s) => s.removeLodging);
  const setLodgingDays = useItineraryStore((s) => s.setLodgingDays);
  const suggestFn = useServerFn(suggestLodging);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedKeyRef = useRef<string | null>(null);

  const lodgings = itinerary.lodgings ?? [];
  const budget = itinerary.budget ?? "medium";
  const nights = Math.max(1, itinerary.durationDays - 1);

  async function run(force = false) {
    const key = `${itinerary.destination}|${budget}|${lang}`;
    if (!force && fetchedKeyRef.current === key) return;
    fetchedKeyRef.current = key;
    setLoading(true);
    setError(null);
    try {
      const center = dayCenter(itinerary);
      const res = await suggestFn({
        data: {
          destination: itinerary.destination,
          centerLat: center.lat,
          centerLng: center.lng,
          budget,
          travelers: itinerary.travelers,
          nights,
          preferences: [],
          lang,
        },
      });
      if (res.error) {
        if (res.error === "RATE_LIMIT") setError(t("rateLimit"));
        else if (res.error === "PAYMENT_REQUIRED") setError(t("paymentRequired"));
        else setError(t("aiError"));
        return;
      }
      if (!res.lodgings.length) {
        setError(t("lodgingNoResults"));
        return;
      }
      // Auto-add suggestions directly into saved lodgings (skip duplicates by name)
      const existingNames = new Set((itinerary.lodgings ?? []).map((l) => l.name.toLowerCase()));
      for (const l of res.lodgings) {
        if (existingNames.has(l.name.toLowerCase())) continue;
        const lodging: Lodging = {
          id: makeId(),
          name: l.name,
          type: l.type,
          lat: l.lat,
          lng: l.lng,
          address: l.address,
          pricePerNight: l.pricePerNight,
          currency: l.currency,
          rating: l.rating,
          description: l.description,
          amenities: l.amenities,
          priceTier: budget,
          bookingUrl: buildBookingUrl(l.name, l.lat, l.lng),
          createdAt: Date.now(),
        };
        addLodging(itinerary.id, lodging);
      }
    } catch {
      setError(t("aiError"));
    } finally {
      setLoading(false);
    }
  }

  // Auto-fetch once on mount / when destination/budget/lang changes
  useEffect(() => {
    void run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itinerary.destination, budget, lang]);

  return (
    <section className="rounded-xl border bg-card text-card-foreground shadow-sm p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-2 min-w-0">
          <BedDouble className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="font-semibold text-sm">{t("lodgingAutoTitle")}</h3>
            <p className="text-[11px] text-muted-foreground">
              {t("lodgingAutoSubtitle")}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 flex-shrink-0"
          onClick={() => void run(true)}
          disabled={loading}
          title={t("lodgingRefresh")}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 rounded p-2 mb-2">{error}</div>
      )}

      {loading && lodgings.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("lodgingSuggesting")}
        </div>
      )}

      {lodgings.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {lodgings.map((l) => {
            const dayIdxs = l.dayIndexes ?? [];
            const bookingHref = l.bookingUrl || buildBookingUrl(l.name, l.lat, l.lng);
            const mapHref = buildMapUrl(l.lat, l.lng, l.name);
            return (
              <div key={l.id} className="rounded-md border bg-background p-2.5 text-xs space-y-1.5 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm break-words">{l.name}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {t(`lodgingType_${l.type}` as any)}
                      </Badge>
                      {typeof l.rating === "number" && (
                        <span className="inline-flex items-center gap-0.5 text-amber-500">
                          <Star className="h-3 w-3 fill-current" />
                          {l.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {l.address && (
                      <p className="text-[11px] text-muted-foreground break-words">{l.address}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeLodging(itinerary.id, l.id)}
                    className="text-muted-foreground hover:text-destructive p-1 flex-shrink-0"
                    title={t("lodgingRemove")}
                    aria-label={t("lodgingRemove")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                        {t("lodgingApplyToDays")}
                        {dayIdxs.length > 0 && (
                          <span className="ml-1 text-muted-foreground">({dayIdxs.length})</span>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel className="text-xs">{t("days")}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {itinerary.days.map((d, idx) => {
                        const checked = dayIdxs.includes(idx);
                        return (
                          <DropdownMenuCheckboxItem
                            key={d.day}
                            checked={checked}
                            onCheckedChange={(v) => {
                              const next = v
                                ? Array.from(new Set([...dayIdxs, idx])).sort((a, b) => a - b)
                                : dayIdxs.filter((x) => x !== idx);
                              setLodgingDays(itinerary.id, l.id, next);
                            }}
                          >
                            {t("day")} {d.day}
                            {d.title ? ` — ${d.title}` : ""}
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="flex items-center gap-1">
                    <a
                      href={mapHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t("lodgingViewMap")}
                      className="inline-flex items-center gap-1 h-7 px-2 rounded-md border bg-background text-[11px] hover:bg-muted"
                    >
                      <MapPin className="h-3 w-3" />
                    </a>
                    <a
                      href={bookingHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t("lodgingBookOn")}
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
