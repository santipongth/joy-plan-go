import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { suggestMeals, type MealSuggestion } from "@/server/discover.functions";
import { useItineraryStore, makeId } from "@/lib/store";
import { useT, useLangStore } from "@/lib/i18n";
import type { Itinerary, Place, MealType } from "@/lib/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Replace } from "lucide-react";
import { toast } from "sonner";
import MealCard from "./MealCard";
import { Skeleton } from "@/components/ui/skeleton";

function timeToMealType(time?: string): MealType | undefined {
  if (!time) return undefined;
  const m = time.match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return undefined;
  const h = parseInt(m[1], 10);
  if (isNaN(h)) return undefined;
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 22) return "dinner";
  return "snack";
}

export default function MealReplacePopover({
  itinerary,
  dayIdx,
  place,
  trigger,
}: {
  itinerary: Itinerary;
  dayIdx: number;
  place: Place;
  trigger?: React.ReactNode;
}) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const suggestFn = useServerFn(suggestMeals);
  const replacePlace = useItineraryStore((s) => s.replacePlace);

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [results, setResults] = useState<MealSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const day = itinerary.days[dayIdx];

  async function load(getMore = false) {
    if (!day) return;
    setPhase("loading");
    setError(null);
    try {
      const mt = timeToMealType(place.time);
      const res = await suggestFn({
        data: {
          destination: itinerary.destination,
          dayPlaces: day.places.map((p) => ({
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            kind: p.kind,
            time: p.time,
          })),
          lang,
          mealTypes: mt ? [mt] : ["lunch"],
          count: 3,
          preferences: itinerary.mealPreferences
            ? {
                cuisines: itinerary.mealPreferences.cuisines,
                diet: itinerary.mealPreferences.diet,
                priceTier: itinerary.mealPreferences.priceTier,
              }
            : undefined,
          budget: itinerary.budget,
          travelers: itinerary.travelers,
          excludeNames: getMore
            ? [place.name, ...results.map((r) => r.name)]
            : [place.name],
          nearLat: place.lat,
          nearLng: place.lng,
        },
      });
      if (res.error) {
        setError(res.error === "RATE_LIMIT" ? t("rateLimit") : t("aiError"));
        setPhase("error");
        return;
      }
      if (!res.meals.length) {
        setError(t("mealNoResults"));
        setPhase("error");
        return;
      }
      setResults(res.meals);
      setPhase("done");
    } catch {
      setError(t("aiError"));
      setPhase("error");
    }
  }

  function handleOpen(v: boolean) {
    setOpen(v);
    if (v && phase === "idle") void load(false);
    if (!v) {
      setTimeout(() => {
        setPhase("idle");
        setResults([]);
      }, 200);
    }
  }

  function pick(m: MealSuggestion) {
    const replacement: Place = {
      id: makeId(),
      name: m.name,
      description: m.description,
      time: place.time ?? m.time,
      type: m.cuisine || "food",
      lat: m.lat,
      lng: m.lng,
      kind: "meal",
      cuisine: m.cuisine,
      priceRange: m.priceRange,
      rating: m.rating,
      openHours: m.openHours,
      mealType: m.mealType,
      slot: place.slot,
    };
    replacePlace(itinerary.id, dayIdx, place.id, replacement);
    toast.success(t("mealReplaceConfirm"));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
            <Replace className="h-3 w-3 mr-1" />
            {t("mealReplaceAction")}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="end">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold">{t("mealReplaceTitle")}</h4>
          {phase === "done" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-[10px]"
              onClick={() => void load(true)}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>

        {phase === "loading" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("mealLoading")}
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        )}

        {phase === "error" && (
          <div className="text-xs text-destructive py-3 text-center">{error}</div>
        )}

        {phase === "done" && (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {results.map((m, i) => (
              <MealCard
                key={`${m.name}-${i}`}
                meal={m}
                compact
                onAdd={() => pick(m)}
              />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
