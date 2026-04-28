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
import { Sparkles, Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { useT, useLangStore } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { aiSuggestPlan } from "@/server/discover.functions";
import { useItineraryStore, makeId } from "@/lib/store";
import type { Itinerary, Place } from "@/lib/types";
import { toast } from "sonner";

const STYLE_OPTIONS = ["relaxing", "sightseeing", "foodie", "adventurous", "shopping", "culture"] as const;

type Stage = "configure" | "running" | "preview";

interface ProposedDay {
  dayIdx: number;
  dayNumber: number;
  currentTitle: string;
  currentPlaces: Place[];
  proposedTitle: string;
  proposedPlaces: Array<{
    name: string;
    description?: string;
    type?: string;
    time?: string;
    lat?: number;
    lng?: number;
  }>;
  selected: boolean;
  rerolling?: boolean;
  error?: string;
}

export default function AISuggestDialog({ itinerary }: { itinerary: Itinerary }) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("configure");
  const [budget, setBudget] = useState<"low" | "medium" | "high">(itinerary.budget ?? "medium");
  const [travelTime, setTravelTime] = useState<"short" | "balanced" | "long">("balanced");
  const [styles, setStyles] = useState<string[]>([]);
  const [target, setTarget] = useState<string>("all");
  const [progress, setProgress] = useState<{ cur: number; total: number } | null>(null);
  const [proposals, setProposals] = useState<ProposedDay[]>([]);
  const replaceDay = useItineraryStore((s) => s.replaceDay);
  const suggestFn = useServerFn(aiSuggestPlan);

  function reset() {
    setStage("configure");
    setProposals([]);
    setProgress(null);
  }

  function toggleStyle(s: string) {
    setStyles((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  async function callOne(dayIdx: number) {
    const day = itinerary.days[dayIdx];
    return await suggestFn({
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
  }

  async function generate() {
    setStage("running");
    const targetIdxs = target === "all"
      ? itinerary.days.map((_, i) => i)
      : [Number(target)];
    setProgress({ cur: 0, total: targetIdxs.length });
    const results: ProposedDay[] = [];
    try {
      for (let i = 0; i < targetIdxs.length; i++) {
        const idx = targetIdxs[i];
        const day = itinerary.days[idx];
        setProgress({ cur: i + 1, total: targetIdxs.length });
        const res = await callOne(idx);
        if (res.error === "RATE_LIMIT") { toast.error(t("rateLimit")); break; }
        if (res.error === "PAYMENT_REQUIRED") { toast.error(t("paymentRequired")); break; }
        results.push({
          dayIdx: idx,
          dayNumber: day.day,
          currentTitle: day.title ?? "",
          currentPlaces: day.places,
          proposedTitle: res.title || day.title || "",
          proposedPlaces: res.places || [],
          selected: !res.error && (res.places?.length ?? 0) > 0,
          error: res.error || (!res.places?.length ? "AI_ERROR" : undefined),
        });
      }
      setProposals(results);
      setStage("preview");
    } finally {
      setProgress(null);
    }
  }

  async function reroll(idx: number) {
    setProposals((ps) => ps.map((p, i) => (i === idx ? { ...p, rerolling: true } : p)));
    try {
      const target = proposals[idx];
      const res = await callOne(target.dayIdx);
      setProposals((ps) =>
        ps.map((p, i) =>
          i === idx
            ? {
                ...p,
                rerolling: false,
                proposedTitle: res.title || p.proposedTitle,
                proposedPlaces: res.places || [],
                error: res.error || (!res.places?.length ? "AI_ERROR" : undefined),
                selected: !res.error && (res.places?.length ?? 0) > 0,
              }
            : p,
        ),
      );
    } catch {
      setProposals((ps) => ps.map((p, i) => (i === idx ? { ...p, rerolling: false, error: "AI_ERROR" } : p)));
    }
  }

  function applySelected() {
    let count = 0;
    for (const prop of proposals) {
      if (!prop.selected || prop.error || !prop.proposedPlaces.length) continue;
      const day = itinerary.days[prop.dayIdx];
      replaceDay(itinerary.id, prop.dayIdx, {
        day: day.day,
        title: prop.proposedTitle || day.title,
        places: prop.proposedPlaces.map((p) => ({
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
      count++;
    }
    if (count > 0) toast.success(t("suggestApplied"));
    setOpen(false);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title={t("aiSuggestTitle")}>
          <Sparkles className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">{t("aiSuggest")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className={stage === "preview" ? "max-w-3xl" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {stage === "preview" ? t("aiPreviewTitle") : t("aiSuggestTitle")}
          </DialogTitle>
          <DialogDescription>
            {stage === "preview" ? t("aiPreviewHint") : t("aiSuggestHint")}
          </DialogDescription>
        </DialogHeader>

        {stage === "configure" && (
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
          </div>
        )}

        {stage === "running" && (
          <div className="py-8 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            {progress && (
              <p className="text-sm text-muted-foreground">
                {t("aiSuggestProgress")
                  .replace("{cur}", String(progress.cur))
                  .replace("{total}", String(progress.total))}
              </p>
            )}
          </div>
        )}

        {stage === "preview" && (
          <div className="max-h-[60vh] overflow-y-auto space-y-3 py-1">
            {proposals.map((prop, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2 bg-card/50">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prop.selected}
                      disabled={!!prop.error || prop.rerolling}
                      onCheckedChange={(v) =>
                        setProposals((ps) =>
                          ps.map((p, j) => (j === i ? { ...p, selected: !!v } : p)),
                        )
                      }
                    />
                    <span className="font-semibold text-sm">
                      {t("day")} {prop.dayNumber}
                      {prop.proposedTitle && (
                        <span className="text-muted-foreground font-normal"> — {prop.proposedTitle}</span>
                      )}
                    </span>
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    disabled={prop.rerolling}
                    onClick={() => reroll(i)}
                  >
                    {prop.rerolling ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    <span className="ml-1 text-xs">{t("aiPreviewReroll")}</span>
                  </Button>
                </div>

                {prop.error ? (
                  <p className="text-xs text-destructive">{t("aiPreviewNoChanges")}</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">
                        {t("aiPreviewBefore")}
                      </p>
                      <ul className="space-y-0.5">
                        {prop.currentPlaces.map((p) => (
                          <li key={p.id} className="text-muted-foreground line-through">
                            • {p.name}
                          </li>
                        ))}
                        {prop.currentPlaces.length === 0 && (
                          <li className="text-muted-foreground italic">—</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-primary mb-1">
                        {t("aiPreviewAfter")}
                      </p>
                      <ul className="space-y-0.5">
                        {prop.proposedPlaces.map((p, k) => (
                          <li key={k} className="text-foreground">
                            <span className="font-medium">• {p.name}</span>
                            {p.time && (
                              <span className="text-muted-foreground"> · {p.time}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {proposals.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t("aiPreviewNoChanges")}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {stage === "configure" && (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button onClick={generate}>
                <Sparkles className="h-4 w-4 mr-1" />
                {t("aiSuggestRun")}
              </Button>
            </>
          )}
          {stage === "preview" && (
            <>
              <Button variant="ghost" onClick={reset}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                {t("aiPreviewBack")}
              </Button>
              <Button
                onClick={applySelected}
                disabled={!proposals.some((p) => p.selected && !p.error)}
              >
                {t("aiPreviewApplySelected")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
