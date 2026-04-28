import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  suggestTransport,
  type AITransportLeg,
} from "@/server/suggest-transport.functions";
import { useItineraryStore } from "@/lib/store";
import { useT, useLangStore } from "@/lib/i18n";
import type { DayPlan, Itinerary, TransportLeg, TransportMode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Bus,
  Car,
  Footprints,
  Loader2,
  Route,
  Ship,
  Train,
  TramFront,
  X,
  Bike,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { resolveAnchor } from "@/lib/route-utils";
import { toast } from "sonner";

const MODE_ICONS: Record<TransportMode, typeof Bus> = {
  walk: Footprints,
  transit: TramFront,
  subway: TramFront,
  bus: Bus,
  train: Train,
  taxi: Car,
  rideshare: Car,
  ferry: Ship,
  bike: Bike,
  car: Car,
};

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

const TRAVELMODE_FOR_GMAPS: Partial<Record<TransportMode, string>> = {
  walk: "walking",
  bike: "bicycling",
  transit: "transit",
  subway: "transit",
  bus: "transit",
  train: "transit",
  ferry: "transit",
  taxi: "driving",
  rideshare: "driving",
  car: "driving",
};

function buildDirectionsUrl(
  from: { lat?: number; lng?: number; label?: string } | undefined,
  to: { lat?: number; lng?: number; label?: string },
  mode: TransportMode,
): string | null {
  const toQ =
    typeof to.lat === "number" && typeof to.lng === "number"
      ? `${to.lat},${to.lng}`
      : to.label || "";
  if (!toQ) return null;
  const fromQ =
    from && typeof from.lat === "number" && typeof from.lng === "number"
      ? `${from.lat},${from.lng}`
      : from?.label || "";
  const params = new URLSearchParams({
    api: "1",
    destination: toQ,
    travelmode: TRAVELMODE_FOR_GMAPS[mode] || "transit",
  });
  if (fromQ) params.set("origin", fromQ);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export default function DayTransportPanel({
  itinerary,
  day,
  dayIdx,
}: {
  itinerary: Itinerary;
  day: DayPlan;
  dayIdx: number;
}) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const setDayTransport = useItineraryStore((s) => s.setDayTransport);
  const fn = useServerFn(suggestTransport);
  const [loading, setLoading] = useState(false);

  const legs = day.transport ?? [];
  const canRun = day.places.length >= 2;
  const anchor = resolveAnchor(day.startPoint, day.places);

  async function run() {
    if (!canRun) return;
    setLoading(true);
    try {
      const res = await fn({
        data: {
          destination: itinerary.destination,
          startLabel: day.startPoint?.label,
          startLat: anchor?.lat,
          startLng: anchor?.lng,
          places: day.places.map((p) => ({
            id: p.id,
            name: p.name,
            lat: p.lat,
            lng: p.lng,
          })),
          preferredMode:
            (day.travelMode ?? itinerary.travelMode ?? "any") as
              | "any"
              | "walking"
              | "transit"
              | "mixed",
          lang,
        },
      });
      if (res.error) {
        if (res.error === "RATE_LIMIT") toast.error(t("rateLimit"));
        else if (res.error === "PAYMENT_REQUIRED") toast.error(t("paymentRequired"));
        else toast.error(t("aiError"));
        return;
      }
      const mapped = mapLegs(res.legs, day, anchor != null);
      setDayTransport(itinerary.id, dayIdx, mapped);
    } catch {
      toast.error(t("aiError"));
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setDayTransport(itinerary.id, dayIdx, undefined);
  }

  return (
    <div className="mb-3 rounded-lg border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("transportSuggest")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {legs.length > 0 && (
            <Button size="sm" variant="ghost" onClick={clear} className="h-7 px-2">
              <X className="h-3 w-3 mr-1" />
              {t("transportClear")}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={run}
            disabled={!canRun || loading}
            className="h-7 px-2"
            title={canRun ? undefined : t("transportNoPlacesYet")}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1" />
            )}
            {loading ? t("transportSuggesting") : t("transportSuggest")}
          </Button>
        </div>
      </div>

      {!canRun && (
        <p className="text-[11px] text-muted-foreground">{t("transportNoPlacesYet")}</p>
      )}

      {canRun && legs.length === 0 && !loading && (
        <p className="text-[11px] text-muted-foreground">{t("transportNoLegs")}</p>
      )}

      {legs.length > 0 && (
        <ol className="space-y-1.5">
          {legs.map((leg, i) => (
            <LegItem key={leg.id} leg={leg} day={day} index={i} t={t} />
          ))}
        </ol>
      )}
    </div>
  );
}

function LegItem({
  leg,
  day,
  index,
  t,
}: {
  leg: TransportLeg;
  day: DayPlan;
  index: number;
  t: (k: any) => string;
}) {
  const [open, setOpen] = useState(false);
  const Icon = MODE_ICONS[leg.mode] || Car;
  const fromName =
    leg.fromPlaceId === ""
      ? day.startPoint?.label || t("startPoint")
      : day.places.find((p) => p.id === leg.fromPlaceId)?.name || "?";
  const toName = day.places.find((p) => p.id === leg.toPlaceId)?.name || "?";

  return (
    <li className="rounded-md border bg-background text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-2 flex items-center gap-2"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-medium truncate">{fromName}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium truncate">{toName}</span>
          </div>
          <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2">
            <span>{t(`transportMode_${leg.mode}` as any)}</span>
            {typeof leg.durationMin === "number" && (
              <span>· {leg.durationMin} {t("transportDuration")}</span>
            )}
            {typeof leg.distanceKm === "number" && (
              <span>· {leg.distanceKm.toFixed(1)} {t("transportDistance")}</span>
            )}
            {typeof leg.costEstimate === "number" && (
              <span>
                · {leg.costEstimate.toLocaleString()} {leg.currency || ""}
              </span>
            )}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          {t("transportLeg")} {index + 1}
        </span>
      </button>
      {open && (leg.instructions || (leg.alternatives && leg.alternatives.length > 0)) && (
        <div className="px-2 pb-2 pt-0 space-y-1.5">
          {leg.instructions && (
            <p className="text-[11px] text-muted-foreground border-l-2 border-primary/30 pl-2">
              {leg.instructions}
            </p>
          )}
          {leg.alternatives && leg.alternatives.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                {t("transportAlternatives")}
              </div>
              <ul className="space-y-1">
                {leg.alternatives.map((alt, j) => {
                  const AltIcon = MODE_ICONS[alt.mode] || Car;
                  return (
                    <li key={j} className="flex items-center gap-2 text-[11px]">
                      <AltIcon className="h-3 w-3 text-muted-foreground" />
                      <span>{t(`transportMode_${alt.mode}` as any)}</span>
                      {typeof alt.durationMin === "number" && (
                        <span className="text-muted-foreground">
                          · {alt.durationMin} {t("transportDuration")}
                        </span>
                      )}
                      {typeof alt.costEstimate === "number" && (
                        <span className="text-muted-foreground">
                          · {alt.costEstimate.toLocaleString()}
                        </span>
                      )}
                      {alt.note && (
                        <span className="text-muted-foreground">— {alt.note}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function mapLegs(
  aiLegs: AITransportLeg[],
  day: DayPlan,
  hasAnchor: boolean,
): TransportLeg[] {
  const out: TransportLeg[] = [];
  for (const l of aiLegs) {
    const toIdx = l.toIndex;
    const to = day.places[toIdx];
    if (!to) continue;
    let fromPlaceId: string;
    if (l.fromIndex < 0) {
      if (!hasAnchor) continue;
      fromPlaceId = "";
    } else {
      const from = day.places[l.fromIndex];
      if (!from) continue;
      fromPlaceId = from.id;
    }
    out.push({
      id: genId(),
      fromPlaceId,
      toPlaceId: to.id,
      mode: l.mode,
      durationMin: l.durationMin,
      distanceKm: l.distanceKm,
      costEstimate: l.costEstimate,
      currency: l.currency,
      instructions: l.instructions,
      alternatives: l.alternatives,
    });
  }
  return out;
}
