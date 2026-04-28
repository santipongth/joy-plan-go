import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Plus, MapPin } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { suggestSimilarPlaces } from "@/server/discover.functions";
import { useT, useLangStore } from "@/lib/i18n";
import { useItineraryStore, makeId } from "@/lib/store";
import { toast } from "sonner";
import type { Place, Itinerary } from "@/lib/types";

export default function SimilarPopover({
  itinerary,
  dayIdx,
  place,
}: {
  itinerary: Itinerary;
  dayIdx: number;
  place: Place;
}) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const fn = useServerFn(suggestSimilarPlaces);
  const addPlace = useItineraryStore((s) => s.addPlace);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<
    { name: string; description: string; type: string; lat: number; lng: number }[]
  >([]);

  async function load() {
    setLoading(true);
    setResults([]);
    try {
      const existing = itinerary.days.flatMap((d) =>
        d.places.map((p) => ({ name: p.name, lat: p.lat, lng: p.lng })),
      );
      const res = await fn({
        data: {
          destination: itinerary.destination,
          reference: { name: place.name, lat: place.lat, lng: place.lng, type: place.type },
          existing,
          radiusKm: 3,
          lang,
        },
      });
      if (res.error) {
        if (res.error === "RATE_LIMIT") toast.error(t("aiRateLimit"));
        else if (res.error === "PAYMENT_REQUIRED") toast.error(t("aiPaymentRequired"));
        else toast.error(t("aiError"));
        return;
      }
      setResults(res.places);
      if (res.places.length === 0) toast.info(t("noSuggestions"));
    } finally {
      setLoading(false);
    }
  }

  function add(p: (typeof results)[number]) {
    addPlace(itinerary.id, dayIdx, {
      id: makeId(),
      name: p.name,
      description: p.description,
      type: p.type,
      lat: p.lat,
      lng: p.lng,
      kind: "attraction",
    });
    toast.success(p.name);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && results.length === 0 && !loading) load();
      }}
    >
      <PopoverTrigger asChild>
        <button
          className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity p-1"
          aria-label={t("moreLikeThis")}
          title={t("moreLikeThis")}
        >
          <Sparkles className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t("moreLikeThis")}
          </h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            disabled={loading}
            className="h-6 text-[10px]"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              t("regenerate" as any) || "↻"
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mb-2">{t("moreLikeThisHint")}</p>
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && results.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">
            {t("noSuggestions")}
          </p>
        )}
        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className="rounded-md border p-2 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{r.name}</p>
                  {r.type && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {r.type}
                    </span>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                    {r.description}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 inline-flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5" />
                    {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => add(r)} className="h-7 px-2">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
