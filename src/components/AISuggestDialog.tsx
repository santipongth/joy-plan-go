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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { useT, useLangStore } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { aiSuggestPlan } from "@/server/discover.functions";
import { useItineraryStore, makeId } from "@/lib/store";
import type { Itinerary } from "@/lib/types";
import { toast } from "sonner";

const STYLE_OPTIONS = ["relaxing", "sightseeing", "foodie", "adventurous", "shopping", "culture"] as const;

export default function AISuggestDialog({ itinerary }: { itinerary: Itinerary }) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const [open, setOpen] = useState(false);
  const [budget, setBudget] = useState<"low" | "medium" | "high">(itinerary.budget ?? "medium");
  const [travelTime, setTravelTime] = useState<"short" | "balanced" | "long">("balanced");
  const [styles, setStyles] = useState<string[]>([]);
  const [target, setTarget] = useState<string>("all"); // "all" or day index string
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ cur: number; total: number } | null>(null);
  const replaceDay = useItineraryStore((s) => s.replaceDay);
  const suggestFn = useServerFn(aiSuggestPlan);

  function toggleStyle(s: string) {
    setStyles((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  async function run() {
    setRunning(true);
    const targetIdxs = target === "all"
      ? itinerary.days.map((_, i) => i)
      : [Number(target)];
    setProgress({ cur: 0, total: targetIdxs.length });
    try {
      for (let i = 0; i < targetIdxs.length; i++) {
        const idx = targetIdxs[i];
        const day = itinerary.days[idx];
        setProgress({ cur: i + 1, total: targetIdxs.length });
        const res = await suggestFn({
          data: {
            destination: itinerary.destination,
            dayNumber: day.day,
            dayTitle: day.title,
            currentPlaces: day.places.map((p) => ({
              name: p.name,
              lat: p.lat,
              lng: p.lng,
              type: p.type,
              time: p.time,
            })),
            budget,
            travelTime,
            styles,
            lang,
          },
        });
        if (res.error === "RATE_LIMIT") {
          toast.error(t("rateLimit"));
          break;
        }
        if (res.error === "PAYMENT_REQUIRED") {
          toast.error(t("paymentRequired"));
          break;
        }
        if (res.error || !res.places.length) {
          toast.error(t("aiError"));
          continue;
        }
        replaceDay(itinerary.id, idx, {
          day: day.day,
          title: res.title || day.title,
          places: res.places.map((p) => ({
            id: makeId(),
            name: p.name,
            description: p.description,
            type: p.type,
            time: p.time,
            lat: p.lat,
            lng: p.lng,
          })),
          travelMode: day.travelMode,
          startPoint: day.startPoint,
        });
      }
      toast.success(t("suggestApplied"));
      setOpen(false);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title={t("aiSuggestTitle")}>
          <Sparkles className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">{t("aiSuggest")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {t("aiSuggestTitle")}
          </DialogTitle>
          <DialogDescription>{t("aiSuggestHint")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">{t("aiSuggestApplyTo")}</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("aiSuggestAllDays")}</SelectItem>
                {itinerary.days.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {t("day")} {d.day}{d.title ? ` — ${d.title}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">{t("budget")}</Label>
            <div className="flex gap-1">
              {(["low", "medium", "high"] as const).map((b) => (
                <Button
                  key={b}
                  type="button"
                  size="sm"
                  variant={budget === b ? "default" : "outline"}
                  onClick={() => setBudget(b)}
                  className="flex-1"
                >
                  {t(b)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">{t("aiSuggestTravelTime")}</Label>
            <div className="flex gap-1">
              {(["short", "balanced", "long"] as const).map((tt) => (
                <Button
                  key={tt}
                  type="button"
                  size="sm"
                  variant={travelTime === tt ? "default" : "outline"}
                  onClick={() => setTravelTime(tt)}
                  className="flex-1"
                >
                  {t(`travelTime_${tt}` as any)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">{t("aiSuggestStyle")}</Label>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map((s) => (
                <Badge
                  key={s}
                  variant={styles.includes(s) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleStyle(s)}
                >
                  {t(`style_${s}` as any)}
                </Badge>
              ))}
            </div>
          </div>

          {progress && (
            <p className="text-xs text-muted-foreground">
              {t("aiSuggestProgress")
                .replace("{cur}", String(progress.cur))
                .replace("{total}", String(progress.total))}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={running}>
            {t("cancel")}
          </Button>
          <Button onClick={run} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {running ? t("aiSuggestRunning") : t("aiSuggestRun")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
