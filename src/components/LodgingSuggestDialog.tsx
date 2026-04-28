import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BedDouble, Loader2, Star, ExternalLink, Plus } from "lucide-react";
import { useT, useLangStore } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { suggestLodging, type AILodging } from "@/server/suggest-lodging.functions";
import { useItineraryStore, makeId } from "@/lib/store";
import type { Itinerary, Lodging, BudgetTier } from "@/lib/types";
import { toast } from "sonner";

const PREF_KEYS = [
  { key: "near-transit", label: "lodgingPrefTransit" },
  { key: "breakfast included", label: "lodgingPrefBreakfast" },
  { key: "pool", label: "lodgingPrefPool" },
  { key: "fast wifi", label: "lodgingPrefWifi" },
  { key: "family friendly", label: "lodgingPrefFamily" },
] as const;

function buildBookingUrl(name: string, lat: number, lng: number) {
  const params = new URLSearchParams({
    ss: name,
    latitude: lat.toFixed(6),
    longitude: lng.toFixed(6),
  });
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
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

export default function LodgingSuggestDialog({ itinerary }: { itinerary: Itinerary }) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const [open, setOpen] = useState(false);
  const [budget, setBudget] = useState<BudgetTier>(itinerary.budget ?? "medium");
  const [travelers, setTravelers] = useState<number>(itinerary.travelers ?? 2);
  const [nights, setNights] = useState<number>(Math.max(1, itinerary.durationDays - 1));
  const [prefs, setPrefs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AILodging[]>([]);
  const [error, setError] = useState<string | null>(null);
  const addLodging = useItineraryStore((s) => s.addLodging);
  const suggestFn = useServerFn(suggestLodging);

  function togglePref(p: string) {
    setPrefs((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  async function run() {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const center = dayCenter(itinerary);
      const res = await suggestFn({
        data: {
          destination: itinerary.destination,
          centerLat: center.lat,
          centerLng: center.lng,
          budget,
          travelers,
          nights,
          preferences: prefs,
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
      setResults(res.lodgings);
    } catch {
      setError(t("aiError"));
    } finally {
      setLoading(false);
    }
  }

  function add(l: AILodging) {
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
    toast.success(t("lodgingAdded"));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title={t("lodgingSuggest")}>
          <BedDouble className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">{t("lodgingSuggest")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="h-5 w-5" />
            {t("lodgingSuggest")}
          </DialogTitle>
          <DialogDescription>{itinerary.destination}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("budget")}</Label>
            <Select value={budget} onValueChange={(v) => setBudget(v as BudgetTier)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t("low")}</SelectItem>
                <SelectItem value="medium">{t("medium")}</SelectItem>
                <SelectItem value="high">{t("high")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("travelers")}</Label>
            <Input
              type="number" min={1} max={20}
              value={travelers}
              onChange={(e) => setTravelers(Math.max(1, Number(e.target.value) || 1))}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("lodgingNights")}</Label>
            <Input
              type="number" min={1} max={60}
              value={nights}
              onChange={(e) => setNights(Math.max(1, Number(e.target.value) || 1))}
              className="h-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{t("lodgingPreferences")}</Label>
          <div className="flex flex-wrap gap-2">
            {PREF_KEYS.map((p) => {
              const active = prefs.includes(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => togglePref(p.key)}
                  className={
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors " +
                    (active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted")
                  }
                >
                  <Checkbox checked={active} className="h-3 w-3 pointer-events-none" />
                  {t(p.label as any)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={run} disabled={loading} size="sm">
            {loading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <BedDouble className="h-4 w-4 mr-1" />
            )}
            {loading ? t("lodgingSuggesting") : t("lodgingSuggest")}
          </Button>
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((l, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm">{l.name}</h4>
                      <Badge variant="secondary" className="text-[10px]">
                        {t(`lodgingType_${l.type}` as any)}
                      </Badge>
                      {typeof l.rating === "number" && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-amber-500">
                          <Star className="h-3 w-3 fill-current" />
                          {l.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {l.address && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{l.address}</p>
                    )}
                    {l.description && (
                      <p className="text-xs text-muted-foreground mt-1">{l.description}</p>
                    )}
                    {l.amenities && l.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {l.amenities.slice(0, 6).map((a, j) => (
                          <span key={j} className="text-[10px] bg-muted rounded px-1.5 py-0.5">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {typeof l.pricePerNight === "number" && (
                      <div className="text-sm font-semibold">
                        {l.pricePerNight.toLocaleString()} {l.currency || ""}
                        <span className="text-[10px] text-muted-foreground font-normal">
                          {t("lodgingPriceNight")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <a
                    href={buildBookingUrl(l.name, l.lat, l.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t("lodgingBookOn")}
                  </a>
                  <Button size="sm" variant="outline" onClick={() => add(l)}>
                    <Plus className="h-3 w-3 mr-1" />
                    {t("lodgingAdd")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
