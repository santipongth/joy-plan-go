import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { suggestMeals, type MealSuggestion } from "@/server/discover.functions";
import { useItineraryStore, makeId } from "@/lib/store";
import { useT, useLangStore } from "@/lib/i18n";
import type { Itinerary, MealPreferences, MealType, BudgetTier, DietTag } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Loader2, Sparkles, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import MealCard from "./MealCard";
import { Skeleton } from "@/components/ui/skeleton";
import { haversineMeters } from "@/lib/route-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const CUISINE_OPTIONS: { value: string; key: string }[] = [
  { value: "thai", key: "cuisineThai" },
  { value: "japanese", key: "cuisineJapanese" },
  { value: "chinese", key: "cuisineChinese" },
  { value: "korean", key: "cuisineKorean" },
  { value: "western", key: "cuisineWestern" },
  { value: "cafe", key: "cuisineCafe" },
  { value: "street", key: "cuisineStreet" },
  { value: "seafood", key: "cuisineSeafood" },
  { value: "dessert", key: "cuisineDessert" },
];
const DIET_OPTIONS: { value: DietTag; key: string }[] = [
  { value: "vegetarian", key: "dietVegetarian" },
  { value: "vegan", key: "dietVegan" },
  { value: "halal", key: "dietHalal" },
  { value: "gluten-free", key: "dietGlutenFree" },
];

export default function MealSuggestDialog({
  itinerary,
  dayIdx,
  open,
  onOpenChange,
  presetMealTypes,
}: {
  itinerary: Itinerary;
  dayIdx: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  presetMealTypes?: MealType[];
}) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const suggestFn = useServerFn(suggestMeals);
  const addPlace = useItineraryStore((s) => s.addPlace);
  const setMealPreferences = useItineraryStore((s) => s.setMealPreferences);

  const day = itinerary.days[dayIdx];
  const savedPrefs = itinerary.mealPreferences;

  // Configure state
  const [mealTypes, setMealTypes] = useState<MealType[]>(
    presetMealTypes ?? ["lunch", "dinner"],
  );
  const [cuisines, setCuisines] = useState<string[]>(savedPrefs?.cuisines ?? []);
  const [diet, setDiet] = useState<DietTag[]>(savedPrefs?.diet ?? []);
  const [priceTier, setPriceTier] = useState<BudgetTier>(
    savedPrefs?.priceTier ?? itinerary.budget ?? "medium",
  );
  const [count, setCount] = useState(4);
  const [nearLodging, setNearLodging] = useState(true);

  // Result state
  const [phase, setPhase] = useState<"configure" | "loading" | "preview" | "error">(
    "configure",
  );
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MealSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Quick filters in preview phase
  const [filterPrices, setFilterPrices] = useState<Set<"$" | "$$" | "$$$">>(new Set());
  const [filterExcludeCuisines, setFilterExcludeCuisines] = useState<Set<string>>(new Set());
  type SortKey = "relevance" | "distance" | "priceMatch" | "rating";
  const [sortKey, setSortKey] = useState<SortKey>("relevance");

  useEffect(() => {
    if (!open) {
      setPhase("configure");
      setResults([]);
      setSelected(new Set());
      setError(null);
      setMealTypes(presetMealTypes ?? ["lunch", "dinner"]);
      setFilterPrices(new Set());
      setFilterExcludeCuisines(new Set());
      setSortKey("relevance");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const lodgingForDay = useMemo(() => {
    const list = itinerary.lodgings ?? [];
    return list.find((l) => (l.dayIndexes ?? []).includes(dayIdx));
  }, [itinerary.lodgings, dayIdx]);

  const excludeNames = useMemo(() => {
    return itinerary.days
      .flatMap((d) => d.places)
      .filter((p) => p.kind === "meal")
      .map((p) => p.name);
  }, [itinerary.days]);

  const excludeCuisines = useMemo(() => {
    const past = new Set<string>();
    for (const d of itinerary.days) {
      for (const p of d.places) {
        if (p.kind === "meal" && p.cuisine) past.add(p.cuisine.toLowerCase());
      }
    }
    return Array.from(past);
  }, [itinerary.days]);

  function toggleInArray<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  async function run(getMore = false) {
    if (!day) return;
    setPhase("loading");
    setError(null);
    try {
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
          mealTypes,
          count,
          preferences: {
            cuisines,
            diet,
            priceTier,
          },
          budget: itinerary.budget,
          travelers: itinerary.travelers,
          lodgingLocation:
            nearLodging && lodgingForDay
              ? { lat: lodgingForDay.lat, lng: lodgingForDay.lng, name: lodgingForDay.name }
              : undefined,
          excludeNames: getMore
            ? [...excludeNames, ...results.map((r) => r.name)]
            : excludeNames,
          excludeCuisines,
        },
      });
      if (res.error) {
        if (res.error === "RATE_LIMIT") setError(t("rateLimit"));
        else if (res.error === "PAYMENT_REQUIRED") setError(t("paymentRequired"));
        else setError(t("aiError"));
        setPhase("error");
        return;
      }
      if (!res.meals.length) {
        setError(t("mealNoResults"));
        setPhase("error");
        return;
      }
      setResults(res.meals);
      setSelected(new Set(res.meals.map((_, i) => i)));
      setFilterPrices(new Set());
      setFilterExcludeCuisines(new Set());
      setSortKey("relevance");
      setPhase("preview");
    } catch {
      setError(t("aiError"));
      setPhase("error");
    }
  }

  function toggleSel(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function applySelected() {
    const picked = results.filter((m, i) => {
      if (!selected.has(i)) return false;
      if (filterPrices.size > 0 && (!m.priceRange || !filterPrices.has(m.priceRange))) return false;
      if (filterExcludeCuisines.size > 0) {
        const c = (m.cuisine || "").trim().toLowerCase();
        if (c && filterExcludeCuisines.has(c)) return false;
      }
      return true;
    });
    for (const m of picked) {
      addPlace(itinerary.id, dayIdx, {
        id: makeId(),
        name: m.name,
        description: m.description,
        time: m.time,
        type: m.cuisine || "food",
        lat: m.lat,
        lng: m.lng,
        kind: "meal",
        cuisine: m.cuisine,
        priceRange: m.priceRange,
        rating: m.rating,
        openHours: m.openHours,
        mealType: m.mealType,
      });
    }
    toast.success(t("mealsAdded").replace("{n}", String(picked.length)));
    onOpenChange(false);
  }

  function savePref() {
    const prefs: MealPreferences = { cuisines, diet, priceTier };
    setMealPreferences(itinerary.id, prefs);
    toast.success(t("mealPrefSaved"));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("mealDialogTitle")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("mealDialogSubtitle")}
          </DialogDescription>
        </DialogHeader>

        {/* Configure */}
        {phase === "configure" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t("mealTypesLabel")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_MEAL_TYPES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMealTypes(toggleInArray(mealTypes, m))}
                    className={`px-2.5 py-1 rounded-full text-xs border transition ${
                      mealTypes.includes(m)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {t(`mealType${m.charAt(0).toUpperCase() + m.slice(1)}` as any)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t("mealCuisinesLabel")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {CUISINE_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCuisines(toggleInArray(cuisines, c.value))}
                    className={`px-2.5 py-1 rounded-full text-xs border transition ${
                      cuisines.includes(c.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {t(c.key as any)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t("mealDietLabel")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {DIET_OPTIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDiet(toggleInArray(diet, d.value))}
                    className={`px-2.5 py-1 rounded-full text-xs border transition ${
                      diet.includes(d.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {t(d.key as any)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t("budget")}</Label>
              <div className="flex gap-1.5">
                {(["low", "medium", "high"] as BudgetTier[]).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setPriceTier(b)}
                    className={`flex-1 px-2 py-1.5 rounded-md text-xs border transition ${
                      priceTier === b
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {b === "low" ? "฿" : b === "medium" ? "฿฿" : "฿฿฿"} {t(b as any)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                {t("mealCountLabel")}: {count}
              </Label>
              <Slider
                value={[count]}
                min={3}
                max={8}
                step={1}
                onValueChange={(v) => setCount(v[0] ?? 4)}
              />
            </div>

            {lodgingForDay && (
              <div className="flex items-center justify-between rounded-md border p-2.5">
                <div className="text-xs">
                  <div className="font-medium">{t("mealNearLodging")}</div>
                  <div className="text-muted-foreground truncate">{lodgingForDay.name}</div>
                </div>
                <Switch checked={nearLodging} onCheckedChange={setNearLodging} />
              </div>
            )}

            <p className="text-[11px] text-muted-foreground italic">{t("mealDisclaimer")}</p>
          </div>
        )}

        {/* Loading */}
        {phase === "loading" && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("mealLoading")}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: count }).map((_, i) => (
                <Skeleton key={i} className="h-56 w-full rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setPhase("configure")}>
              {t("back")}
            </Button>
          </div>
        )}

        {/* Preview */}
        {phase === "preview" && (() => {
          const resultCuisines = Array.from(
            new Set(
              results
                .map((r) => (r.cuisine || "").trim().toLowerCase())
                .filter((c) => c.length > 0),
            ),
          );
          const visibleIndices = results
            .map((_, i) => i)
            .filter((i) => {
              const m = results[i];
              if (filterPrices.size > 0) {
                if (!m.priceRange || !filterPrices.has(m.priceRange)) return false;
              }
              if (filterExcludeCuisines.size > 0) {
                const c = (m.cuisine || "").trim().toLowerCase();
                if (c && filterExcludeCuisines.has(c)) return false;
              }
              return true;
            });
          // Reference point for distance-based sorting + cards
          const sortRef =
            nearLodging && lodgingForDay
              ? { lat: lodgingForDay.lat, lng: lodgingForDay.lng, name: lodgingForDay.name }
              : day?.places[0]
                ? { lat: day.places[0].lat, lng: day.places[0].lng, name: day.places[0].name }
                : null;
          // Price match score: 0 = exact match with priceTier; 1/2 = off by 1/2 tiers; 3 = unknown
          const priceOrder: Record<"$" | "$$" | "$$$", number> = { "$": 0, "$$": 1, "$$$": 2 };
          const desiredPrice = priceOrder[priceTier === "low" ? "$" : priceTier === "high" ? "$$$" : "$$"];
          function priceMatchScore(m: MealSuggestion): number {
            if (!m.priceRange) return 3;
            return Math.abs(priceOrder[m.priceRange] - desiredPrice);
          }
          function distanceMeters(m: MealSuggestion): number {
            if (!sortRef) return Number.POSITIVE_INFINITY;
            return haversineMeters(sortRef, { lat: m.lat, lng: m.lng });
          }
          const sortedVisible = [...visibleIndices].sort((a, b) => {
            const ma = results[a];
            const mb = results[b];
            if (sortKey === "distance") {
              return distanceMeters(ma) - distanceMeters(mb);
            }
            if (sortKey === "priceMatch") {
              const pa = priceMatchScore(ma);
              const pb = priceMatchScore(mb);
              if (pa !== pb) return pa - pb;
              return distanceMeters(ma) - distanceMeters(mb);
            }
            if (sortKey === "rating") {
              const ra = ma.rating ?? 0;
              const rb = mb.rating ?? 0;
              if (rb !== ra) return rb - ra;
              return distanceMeters(ma) - distanceMeters(mb);
            }
            // relevance: distance first, then price match
            const da = distanceMeters(ma);
            const db = distanceMeters(mb);
            if (da !== db) return da - db;
            return priceMatchScore(ma) - priceMatchScore(mb);
          });
          const visibleSet = new Set(sortedVisible);
          const filtersActive = filterPrices.size > 0 || filterExcludeCuisines.size > 0;
          return (
          <div className="space-y-3 py-2">
            {/* Quick filters */}
            <div className="rounded-md border bg-muted/30 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("mealQuickFilters")}
                </Label>
                {filtersActive && (
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:underline"
                    onClick={() => {
                      setFilterPrices(new Set());
                      setFilterExcludeCuisines(new Set());
                    }}
                  >
                    {t("mealFilterReset")}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-muted-foreground">{t("mealFilterPrice")}:</span>
                {(["$", "$$", "$$$"] as const).map((p) => {
                  const active = filterPrices.has(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setFilterPrices((prev) => {
                          const next = new Set(prev);
                          if (next.has(p)) next.delete(p);
                          else next.add(p);
                          return next;
                        })
                      }
                      className={`px-2 py-0.5 rounded-full text-[11px] border transition ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              {resultCuisines.length > 0 && (
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    {t("mealFilterExcludeCuisine")}:
                  </span>
                  {resultCuisines.map((c) => {
                    const active = filterExcludeCuisines.has(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          setFilterExcludeCuisines((prev) => {
                            const next = new Set(prev);
                            if (next.has(c)) next.delete(c);
                            else next.add(c);
                            return next;
                          })
                        }
                        className={`px-2 py-0.5 rounded-full text-[11px] border transition line-clamp-1 ${
                          active
                            ? "bg-destructive text-destructive-foreground border-destructive line-through"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-1.5 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelected(new Set(sortedVisible))}
                >
                  {t("mealSelectAll")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      for (const i of sortedVisible) next.delete(i);
                      return next;
                    })
                  }
                >
                  {t("mealClearSelection")}
                </Button>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {sortedVisible.length}/{results.length}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">{t("mealSortLabel")}:</span>
                <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                  <SelectTrigger className="h-7 text-xs w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance" className="text-xs">
                      {t("mealSortRelevance")}
                    </SelectItem>
                    <SelectItem value="distance" className="text-xs">
                      {t("mealSortDistance")}
                    </SelectItem>
                    <SelectItem value="priceMatch" className="text-xs">
                      {t("mealSortPriceMatch")}
                    </SelectItem>
                    <SelectItem value="rating" className="text-xs">
                      {t("mealSortRating")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void run(true)}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {t("mealRequestAgain")}
                </Button>
              </div>
            </div>
            {sortedVisible.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
                {t("mealFilterEmpty")}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {sortedVisible.map((i) => {
                  const m = results[i];
                  const refLabel =
                    nearLodging && lodgingForDay
                      ? t("mealDistanceFromLodging")
                      : t("mealDistanceFromAnchor");
                  return (
                    <MealCard
                      key={`${m.name}-${i}`}
                      meal={m}
                      selected={selected.has(i)}
                      onToggleSelect={() => toggleSel(i)}
                      referencePoint={sortRef}
                      referenceLabel={refLabel}
                    />
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground italic">{t("mealDisclaimer")}</p>
          </div>
          );
        })()}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {phase === "configure" && (
            <>
              <Button variant="ghost" size="sm" onClick={savePref} className="sm:mr-auto">
                <Save className="h-4 w-4 mr-1" />
                {t("mealSavePref")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                {t("back")}
              </Button>
              <Button
                size="sm"
                onClick={() => void run(false)}
                disabled={mealTypes.length === 0}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                {t("mealRunAI")}
              </Button>
            </>
          )}
          {phase === "preview" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setPhase("configure")}>
                {t("mealConfigure")}
              </Button>
              <Button size="sm" onClick={applySelected} disabled={selected.size === 0}>
                {t("mealApplySelected").replace("{n}", String(selected.size))}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
