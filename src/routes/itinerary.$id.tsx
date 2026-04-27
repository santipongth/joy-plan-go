import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useItineraryStore, makeId } from "@/lib/store";
import { useVisibilityStore } from "@/lib/visibility-store";
import { useReorderHistoryStore } from "@/lib/reorder-history-store";
import { useTimelineSettingsStore } from "@/lib/timeline-settings-store";
import { useT, useLangStore } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Trash2,
  Plus,
  Compass,
  MapPin,
  Clock,
  Pencil,
  Check,
  GripVertical,
  Sparkles,
  Loader2,
  Eye,
  EyeOff,
  Download,
  Share2,
  FileDown,
  AlertTriangle,
  RefreshCw,
  X,
  Printer,
  Wand2,
  Undo2,
} from "lucide-react";
import MapView, { dayColor } from "@/components/MapView";
import PrintItinerary from "@/components/PrintItinerary";
import { LangSwitch } from "@/components/LangSwitch";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Place, DayPlan, TravelMode, DayStartPoint } from "@/lib/types";
import { planSingleDay, planTrip } from "@/server/plan-trip.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import DayMiniMap from "@/components/DayMiniMap";
import BudgetEstimate from "@/components/BudgetEstimate";
import { estimateDayTravel, haversineMeters, modeProfile, reorderPlacesFromAnchor, resolveAnchor } from "@/lib/route-utils";
import { dict } from "@/lib/i18n";

export const Route = createFileRoute("/itinerary/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Itinerary — Trip.Planner` },
      { name: "description", content: `Trip itinerary ${params.id}` },
    ],
  }),
  component: ItineraryDetail,
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <p>Itinerary not found</p>
      <Link to="/" className="text-primary underline">
        Go home
      </Link>
    </div>
  ),
});

function ItineraryDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const itinerary = useItineraryStore((s) => s.itineraries.find((i) => i.id === id));
  const update = useItineraryStore((s) => s.update);
  const removeItin = useItineraryStore((s) => s.remove);
  const removePlace = useItineraryStore((s) => s.removePlace);
  const addPlace = useItineraryStore((s) => s.addPlace);
  const reorderPlaces = useItineraryStore((s) => s.reorderPlaces);
  const replaceDay = useItineraryStore((s) => s.replaceDay);
  const movePlace = useItineraryStore((s) => s.movePlace);
  const setItineraryMode = useItineraryStore((s) => s.setItineraryMode);
  const setDayMode = useItineraryStore((s) => s.setDayMode);
  const setDayStart = useItineraryStore((s) => s.setDayStart);
  const applyModeToAllDays = useItineraryStore((s) => s.applyModeToAllDays);
  const pushHistory = useReorderHistoryStore((s) => s.push);
  const popHistory = useReorderHistoryStore((s) => s.pop);
  const clearHistory = useReorderHistoryStore((s) => s.clear);
  const historyStacks = useReorderHistoryStore((s) => s.stacks);
  const historyDepths = useMemo(() => {
    const out: Record<number, number> = {};
    Object.keys(historyStacks).forEach((key) => {
      const [iid, idxStr] = key.split(":");
      if (iid !== id) return;
      out[Number(idxStr)] = historyStacks[key].length;
    });
    return out;
  }, [historyStacks, id]);

  const [highlightedType, setHighlightedType] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(itinerary?.title ?? "");
  const visibleArr = useVisibilityStore((s) => s.visibleDaysByItinerary[id]);
  const setVisible = useVisibilityStore((s) => s.setVisible);
  const toggleVisible = useVisibilityStore((s) => s.toggle);
  const [regenLoading, setRegenLoading] = useState<number | null>(null);
  const [regenErrors, setRegenErrors] = useState<Record<number, string>>({});
  const [regenAllProgress, setRegenAllProgress] = useState<{
    current: number;
    total: number;
    startedAt: number;
    etaSec: number | null;
  } | null>(null);
  const planTripFn = useServerFn(planTrip);

  // Pending regenerate confirmations when undo stack is non-empty
  const [pendingRegenDay, setPendingRegenDay] = useState<number | null>(null);
  const [pendingRegenAll, setPendingRegenAll] = useState(false);

  // initialize / sync visible days when itinerary loads or day numbers change
  const dayNumbersKey = itinerary?.days.map((d) => d.day).join(",") ?? "";
  useEffect(() => {
    if (!itinerary) return;
    const allDays = itinerary.days.map((d) => d.day);
    if (visibleArr === undefined) {
      setVisible(id, allDays);
      return;
    }
    // If saved set is out of sync with current day numbers, reset to all visible
    const allSet = new Set(allDays);
    const savedSet = new Set(visibleArr);
    const sameSize = allSet.size === savedSet.size;
    const sameItems = sameSize && [...allSet].every((d) => savedSet.has(d));
    const hasStale = visibleArr.some((d) => !allSet.has(d));
    if (hasStale || (!sameItems && allSet.size !== savedSet.size)) {
      setVisible(id, allDays);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itinerary?.id, dayNumbersKey, visibleArr === undefined]);

  const visibleDays = useMemo(
    () => new Set(visibleArr ?? itinerary?.days.map((d) => d.day) ?? []),
    [visibleArr, itinerary]
  );

  const groups = useMemo(() => {
    if (!itinerary) return [];
    return itinerary.days
      .filter((d) => visibleDays.has(d.day))
      .map((d) => ({
        day: d.day,
        color: dayColor(d.day - 1),
        places: d.places,
      }));
  }, [itinerary, visibleDays]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!itinerary) return counts;
    itinerary.days.forEach((d) => {
      d.places.forEach((p) => {
        const tp = (p.type || "").toLowerCase().trim();
        if (!tp) return;
        counts.set(tp, (counts.get(tp) || 0) + 1);
      });
    });
    return counts;
  }, [itinerary]);

  function handleMovePlace(placeId: string, fromDayIdx: number, toDayIdx: number) {
    if (!itinerary || fromDayIdx === toDayIdx) return;
    movePlace(id, fromDayIdx, toDayIdx, placeId);
    const targetDay = itinerary.days[toDayIdx]?.day;
    if (targetDay !== undefined) {
      toast.success(t("moveSuccess").replace("{n}", String(targetDay)));
    }
  }

  function focusPlace(placeId: string) {
    setSelectedPlaceId(null);
    setTimeout(() => setSelectedPlaceId(placeId), 0);
  }

  if (!itinerary) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p>Not found</p>
        <Link to="/">
          <Button>Back</Button>
        </Link>
      </div>
    );
  }

  function saveTitle() {
    update(id, { title: titleDraft.trim() || t("untitled") });
    setEditingTitle(false);
  }

  function onAddPlace(dayIdx: number) {
    const name = prompt(t("placeName"));
    if (!name) return;
    const latStr = prompt("Latitude (e.g. 13.7563)");
    const lngStr = prompt("Longitude (e.g. 100.5018)");
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    addPlace(id, dayIdx, {
      id: makeId(),
      name,
      lat,
      lng,
      time: "",
      description: "",
      type: "landmark",
    });
  }

  function toggleDay(day: number) {
    toggleVisible(id, day);
  }

  function showAllDays() {
    setVisible(id, itinerary!.days.map((d) => d.day));
  }

  function errorMessage(code: string): string {
    if (code === "RATE_LIMIT") return t("rateLimit");
    if (code === "PAYMENT_REQUIRED") return t("paymentRequired");
    return t("aiError");
  }

  async function regenerateDay(dayIdx: number) {
    if (!itinerary) return;
    const target = itinerary.days[dayIdx];
    setRegenLoading(target.day);
    try {
      const otherDays = itinerary.days.filter((_, idx) => idx !== dayIdx);
      const summary = otherDays
        .map((d) => `Day ${d.day}: ${d.places.map((p) => p.name).join(", ")}`)
        .join("; ");
      const existingPlaces = otherDays.flatMap((d) =>
        d.places
          .filter((p) => typeof p.lat === "number" && typeof p.lng === "number")
          .map((p) => ({ name: p.name, lat: p.lat, lng: p.lng })),
      );
      const res = await planSingleDay({
        data: {
          destination: itinerary.destination,
          dayNumber: target.day,
          totalDays: itinerary.durationDays,
          existingDaysSummary: summary,
          existingPlaces,
          travelMode: target.travelMode ?? itinerary.travelMode,
          startLabel: target.startPoint?.label,
          lang,
        },
      });
      if (res.error || !res.day) {
        const code = res.error || "AI_ERROR";
        const msg = errorMessage(code);
        setRegenErrors((prev) => ({ ...prev, [target.day]: msg }));
        toast.error(`${t("regenFailed")} — ${t("day")} ${target.day}`, {
          description: msg,
          duration: 10000,
          action: {
            label: t("retry"),
            onClick: () => regenerateDay(dayIdx),
          },
        });
        return;
      }
      const newDay: DayPlan = {
        day: target.day,
        title: res.day.title,
        places: res.day.places.map((p) => ({
          id: makeId(),
          name: p.name,
          description: p.description,
          type: p.type,
          time: p.time,
          lat: p.lat,
          lng: p.lng,
        })),
      };
      replaceDay(id, dayIdx, newDay);
      clearHistory(id, dayIdx);
      setRegenErrors((prev) => {
        const next = { ...prev };
        delete next[target.day];
        return next;
      });
      toast.success(t("regenSuccess").replace("{n}", String(target.day)));
    } catch (e) {
      const msg = t("aiError");
      setRegenErrors((prev) => ({ ...prev, [target.day]: msg }));
      toast.error(`${t("regenFailed")} — ${t("day")} ${target.day}`, {
        description: msg,
        duration: 10000,
        action: { label: t("retry"), onClick: () => regenerateDay(dayIdx) },
      });
    } finally {
      setRegenLoading(null);
    }
  }

  function clearRegenError(day: number) {
    setRegenErrors((prev) => {
      if (!(day in prev)) return prev;
      const next = { ...prev };
      delete next[day];
      return next;
    });
  }

  async function regenerateAll() {
    if (!itinerary) return;
    if (!confirm(t("confirmRegenAll"))) return;
    const total = itinerary.durationDays;
    const startedAt = Date.now();
    setRegenAllProgress({ current: 0, total, startedAt, etaSec: null });
    try {
      // First: get fresh trip skeleton (title + day count)
      const res = await planTripFn({
        data: {
          origin: itinerary.origin,
          destination: itinerary.destination,
          durationDays: itinerary.durationDays,
          startDate: itinerary.startDate,
          lang,
        },
      });
      if (res.error || !res.days?.length) {
        const code = res.error || "AI_ERROR";
        const msg = errorMessage(code);
        toast.error(t("regenFailed"), {
          description: msg,
          duration: 10000,
          action: { label: t("retry"), onClick: () => regenerateAll() },
        });
        return;
      }
      // Commit the skeleton immediately so the UI shows new days/titles
      const skeleton: DayPlan[] = res.days.map((d) => ({
        day: d.day,
        title: d.title,
        places: d.places.map((p) => ({
          id: makeId(),
          name: p.name,
          description: p.description,
          type: p.type,
          time: p.time,
          lat: p.lat,
          lng: p.lng,
        })),
      }));
      update(id, {
        title: res.title || itinerary.title,
        citiesCount: res.citiesCount || itinerary.citiesCount,
        days: skeleton,
      });
      setVisible(id, skeleton.map((d) => d.day));
      setRegenErrors({});
      clearHistory(id);

      // Then: stream per-day refinement so user sees progress per day
      const realTotal = skeleton.length;
      const refineStartedAt = Date.now();
      setRegenAllProgress({ current: 0, total: realTotal, startedAt: refineStartedAt, etaSec: null });
      let successCount = 0;
      const failedDays: number[] = [];
      for (let i = 0; i < skeleton.length; i++) {
        const target = skeleton[i];
        setRegenAllProgress({
          current: i + 1,
          total: realTotal,
          startedAt: refineStartedAt,
          etaSec: null,
        });
        const otherDaysAll = skeleton.filter((_, idx) => idx !== i);
        const summary = otherDaysAll
          .map((d) => `Day ${d.day}: ${d.places.map((p) => p.name).join(", ")}`)
          .join("; ");
        const existingPlaces = otherDaysAll.flatMap((d) =>
          d.places
            .filter((p) => typeof p.lat === "number" && typeof p.lng === "number")
            .map((p) => ({ name: p.name, lat: p.lat, lng: p.lng })),
        );
        const dayRes = await planSingleDay({
          data: {
            destination: itinerary.destination,
            dayNumber: target.day,
            totalDays: realTotal,
            existingDaysSummary: summary,
            existingPlaces,
            travelMode: target.travelMode ?? itinerary.travelMode,
            startLabel: target.startPoint?.label,
            lang,
          },
        });
        if (dayRes.error || !dayRes.day) {
          const code = dayRes.error || "AI_ERROR";
          const msg = errorMessage(code);
          setRegenErrors((prev) => ({ ...prev, [target.day]: msg }));
          failedDays.push(target.day);
          toast.error(`${t("day")} ${target.day}: ${msg}`, { duration: 6000 });
          // Still update ETA so the bar keeps moving
          const elapsed = (Date.now() - refineStartedAt) / 1000;
          const completedSteps = i + 1;
          const avg = elapsed / completedSteps;
          const etaSec = Math.max(0, Math.round(avg * (realTotal - completedSteps)));
          setRegenAllProgress({ current: i + 1, total: realTotal, startedAt: refineStartedAt, etaSec });
          continue;
        }
        const newDay: DayPlan = {
          day: target.day,
          title: dayRes.day.title,
          places: dayRes.day.places.map((p) => ({
            id: makeId(),
            name: p.name,
            description: p.description,
            type: p.type,
            time: p.time,
            lat: p.lat,
            lng: p.lng,
          })),
        };
        replaceDay(id, i, newDay);
        clearHistory(id, i);
        skeleton[i] = newDay;
        successCount++;
        // Compute ETA from successful completions only
        const elapsed = (Date.now() - refineStartedAt) / 1000;
        const avg = elapsed / successCount;
        const remaining = realTotal - (i + 1);
        const etaSec = Math.max(0, Math.round(avg * remaining));
        setRegenAllProgress({ current: i + 1, total: realTotal, startedAt: refineStartedAt, etaSec });
      }
      if (failedDays.length > 0) {
        toast.error(t("regenSomeFailed"), { duration: 8000 });
      } else {
        toast.success(t("regenAllSuccess"));
      }
    } catch {
      toast.error(t("aiError"), {
        action: { label: t("retry"), onClick: () => regenerateAll() },
      });
    } finally {
      setRegenAllProgress(null);
    }
  }

  function exportPdf() {
    // Print-friendly: open print dialog (user can save as PDF)
    window.print();
  }

  async function copyShareLink() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("linkCopied"));
    } catch {
      prompt(t("shareLink"), url);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <Toaster position="top-center" />

      {/* Print-only dedicated layout */}
      <div className="hidden print:block">
        <PrintItinerary itinerary={itinerary} t={t} />
      </div>

      {/* Screen layout */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-h-screen print:hidden">
        <div className="overflow-auto px-4 sm:px-8 py-6">
          <header className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/" })}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("back")}
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={regenerateAll}
                disabled={regenAllProgress !== null}
                title={t("regenerateAll")}
              >
                {regenAllProgress !== null ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-1" />
                )}
                <span className="hidden sm:inline">
                  {regenAllProgress !== null
                    ? regenAllProgress.current === 0
                      ? t("regeneratingAll")
                      : t("regeneratingDay")
                          .replace("{n}", String(regenAllProgress.current))
                          .replace("{total}", String(regenAllProgress.total))
                    : t("regenerateAll")}
                </span>
              </Button>
              <Button variant="outline" size="sm" onClick={exportPdf} title={t("print")}>
                <Printer className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">{t("print")}</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">{t("export")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportPdf}>
                    <FileDown className="h-4 w-4 mr-2" />
                    {t("exportPdf")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={copyShareLink}>
                    <Share2 className="h-4 w-4 mr-2" />
                    {t("shareLink")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <LangSwitch />
            </div>
          </header>

          {regenAllProgress !== null && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>
                  {t("regeneratingDay")
                    .replace("{n}", String(Math.max(1, regenAllProgress.current)))
                    .replace("{total}", String(regenAllProgress.total))}
                </span>
                <span className="flex items-center gap-3">
                  {regenAllProgress.etaSec !== null && (
                    <span className="tabular-nums">
                      {t("timeLeft")} {regenAllProgress.etaSec}{t("seconds").startsWith(" ") ? "" : " "}{t("seconds")}
                    </span>
                  )}
                  <span className="tabular-nums">
                    {Math.round(
                      (regenAllProgress.current / Math.max(1, regenAllProgress.total)) * 100
                    )}
                    %
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width: `${
                      (regenAllProgress.current / Math.max(1, regenAllProgress.total)) * 100
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="mb-4">
            {editingTitle ? (
              <div className="flex gap-2">
                <Input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  className="text-xl font-bold"
                />
                <Button size="icon" onClick={saveTitle}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{itinerary.title}</h1>
                <button
                  onClick={() => {
                    setTitleDraft(itinerary.title);
                    setEditingTitle(true);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              {itinerary.destination} · {itinerary.durationDays} {t("days")}
            </p>
          </div>

          {/* Day legend with show/hide toggles */}
          <div className="mb-6 p-3 rounded-lg bg-card/60 border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("daysLegend")} · {t("showOnMap")}
              </span>
              <button
                onClick={showAllDays}
                className="text-xs text-primary hover:underline"
              >
                {t("allDays")}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {itinerary.days.map((d) => {
                const color = dayColor(d.day - 1);
                const visible = visibleDays.has(d.day);
                return (
                  <button
                    key={d.day}
                    onClick={() => toggleDay(d.day)}
                    title={t("clickToToggle")}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      visible
                        ? "bg-background shadow-sm"
                        : "bg-muted/50 opacity-50"
                    }`}
                    style={{ borderColor: visible ? color : undefined }}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: color }}
                    />
                    {t("day")} {d.day}
                    {visible ? (
                      <Eye className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <EyeOff className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <TripModeBar
            mode={itinerary.travelMode ?? "any"}
            onChange={(m) => setItineraryMode(id, m)}
            onApplyAll={() => {
              applyModeToAllDays(id, itinerary.travelMode ?? "any");
              toast.success(t("applyToAll"));
            }}
            t={t}
          />

          <div className="space-y-6">
            {itinerary.days.map((d, dayIdx) => {
              const color = dayColor(d.day - 1);
              const effectiveMode: TravelMode = d.travelMode ?? itinerary.travelMode ?? "any";
              return (
                <DaySection
                  key={d.day}
                  day={d}
                  dayIdx={dayIdx}
                  color={color}
                  itineraryId={id}
                  allDays={itinerary.days}
                  tripOriginLabel={itinerary.origin}
                  effectiveMode={effectiveMode}
                  inheritedMode={itinerary.travelMode ?? "any"}
                  onAddPlace={() => onAddPlace(dayIdx)}
                  onRemovePlace={(placeId) => removePlace(id, dayIdx, placeId)}
                  onReorder={(places) => reorderPlaces(id, dayIdx, places)}
                  onRegenerate={() => requestRegenerateDay(dayIdx)}
                  onMovePlace={(placeId, toDayIdx) => handleMovePlace(placeId, dayIdx, toDayIdx)}
                  onFocusPlace={focusPlace}
                  onSetDayMode={(m) => setDayMode(id, dayIdx, m)}
                  onSetDayStart={(sp) => setDayStart(id, dayIdx, sp)}
                  onReorderByMode={() => {
                    const anchor = resolveAnchor(d.startPoint, d.places);
                    const newOrder = reorderPlacesFromAnchor(d.places, anchor, effectiveMode);
                    const prev = d.places;
                    pushHistory(id, dayIdx, prev);
                    reorderPlaces(id, dayIdx, newOrder);
                    toast.success(t("dayReordered").replace("{n}", String(d.day)), {
                      duration: 5000,
                      action: {
                        label: t("undo"),
                        onClick: () => undoReorder(dayIdx, d.day, prev),
                      },
                    });
                  }}
                  regenerating={regenLoading === d.day}
                  errorMessage={regenErrors[d.day]}
                  onDismissError={() => clearRegenError(d.day)}
                  onPushHistory={(prev) => pushHistory(id, dayIdx, prev)}
                  onUndoReorder={() => undoReorder(dayIdx, d.day)}
                  historyDepth={historyDepths[dayIdx] ?? 0}
                  t={t}
                />
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t flex justify-between">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm(t("confirmDelete"))) {
                  removeItin(id);
                  navigate({ to: "/" });
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t("deleteTrip")}
            </Button>
          </div>
        </div>

        <div className="hidden lg:block sticky top-0 h-screen p-4">
          {groups.flatMap((g) => g.places).length === 0 ? (
            <div className="h-full rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
              <Compass className="h-12 w-12 opacity-40" />
            </div>
          ) : (
            <div className="relative h-full">
              <MapView
                groups={groups}
                highlightedType={highlightedType}
                selectedPlaceId={selectedPlaceId}
              />
              {/* Type filter chips */}
              {typeCounts.size > 0 && (
                <div className="absolute top-3 left-3 z-[400] bg-background/95 backdrop-blur rounded-lg shadow-md border p-2 max-w-[calc(100%-220px)] flex flex-wrap gap-1">
                  <button
                    onClick={() => setHighlightedType(null)}
                    className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                      highlightedType === null
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {t("allTypes")}
                  </button>
                  {Array.from(typeCounts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([tp, n]) => (
                      <button
                        key={tp}
                        onClick={() => setHighlightedType(highlightedType === tp ? null : tp)}
                        className={`text-[11px] px-2 py-1 rounded-full border transition-colors capitalize ${
                          highlightedType === tp
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        {tp} <span className="opacity-60">({n})</span>
                      </button>
                    ))}
                </div>
              )}
              {/* Floating legend on map — clickable to toggle */}
              <div className="absolute top-3 right-3 z-[400] bg-background/95 backdrop-blur rounded-lg shadow-md border p-2 max-w-[200px]">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
                  {t("daysLegend")}
                </div>
                <div className="space-y-0.5">
                  {itinerary.days.map((d) => {
                    const visible = visibleDays.has(d.day);
                    return (
                      <button
                        key={d.day}
                        onClick={() => toggleDay(d.day)}
                        title={t("clickToToggle")}
                        className={`flex items-center gap-1.5 text-xs w-full text-left px-1.5 py-1 rounded hover:bg-muted transition-colors ${
                          visible ? "" : "opacity-40"
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ background: dayColor(d.day - 1) }}
                        />
                        <span className="truncate flex-1">
                          {t("day")} {d.day}
                          {d.title ? ` — ${d.title}` : ""}
                        </span>
                        {visible ? (
                          <Eye className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <EyeOff className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface DaySectionProps {
  day: DayPlan;
  dayIdx: number;
  color: string;
  itineraryId: string;
  allDays: DayPlan[];
  tripOriginLabel?: string;
  effectiveMode: TravelMode;
  inheritedMode: TravelMode;
  onAddPlace: () => void;
  onRemovePlace: (placeId: string) => void;
  onReorder: (places: Place[]) => void;
  onRegenerate: () => void;
  onMovePlace: (placeId: string, toDayIdx: number) => void;
  onFocusPlace: (placeId: string) => void;
  onSetDayMode: (mode: TravelMode | undefined) => void;
  onSetDayStart: (sp: DayStartPoint | undefined) => void;
  onReorderByMode: () => void;
  onPushHistory: (prev: Place[]) => void;
  onUndoReorder: () => void;
  historyDepth: number;
  regenerating: boolean;
  errorMessage?: string;
  onDismissError?: () => void;
  t: (k: any) => string;
}

function DaySection({
  day,
  dayIdx,
  color,
  allDays,
  tripOriginLabel,
  effectiveMode,
  inheritedMode,
  onAddPlace,
  onRemovePlace,
  onReorder,
  onRegenerate,
  onMovePlace,
  onFocusPlace,
  onSetDayMode,
  onSetDayStart,
  onReorderByMode,
  onPushHistory,
  onUndoReorder,
  historyDepth,
  regenerating,
  errorMessage,
  onDismissError,
  t,
}: DaySectionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = day.places.findIndex((p) => p.id === active.id);
    const newIdx = day.places.findIndex((p) => p.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const prev = day.places;
    const next = arrayMove(day.places, oldIdx, newIdx);
    onPushHistory(prev);
    onReorder(next);
    toast.success(t("reordered"), {
      duration: 5000,
      action: { label: t("undo"), onClick: () => onUndoReorder() },
    });
  }

  return (
    <section className="relative pl-6">
      <div
        className="absolute left-0 top-2 bottom-2 w-1 rounded-full"
        style={{ background: color }}
      />
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="font-bold flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs text-white font-semibold"
            style={{ background: color }}
          >
            {day.day}
          </span>
          {t("day")} {day.day}
          {day.title && (
            <span className="text-muted-foreground font-normal text-sm">— {day.title}</span>
          )}
          {historyDepth > 0 && (
            <span
              className="ml-1 inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums"
              title={t("undoTooltip").replace("{n}", String(historyDepth))}
              aria-label={t("undoTooltip").replace("{n}", String(historyDepth))}
            >
              <Undo2 className="h-3 w-3" />
              {t("undo")} ({historyDepth})
            </span>
          )}
        </h2>
        <div className="flex gap-1">
          {historyDepth > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onUndoReorder}
              title={t("undoTooltip").replace("{n}", String(historyDepth))}
            >
              <Undo2 className="h-4 w-4 mr-1" />
              {t("undo")}
              <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">
                {historyDepth}
              </span>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onRegenerate}
            disabled={regenerating}
            title={t("regenerateDay")}
          >
            {regenerating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            {regenerating ? t("regenerating") : t("regenerateDay")}
          </Button>
          <Button size="sm" variant="ghost" onClick={onAddPlace}>
            <Plus className="h-4 w-4 mr-1" />
            {t("addPlace")}
          </Button>
        </div>
      </div>

      {errorMessage && (
        <Alert variant="destructive" className="mb-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-2">
            <span className="flex-1">
              <strong>{t("regenFailed")}:</strong> {errorMessage}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={onRegenerate}
                disabled={regenerating}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${regenerating ? "animate-spin" : ""}`} />
                {t("retry")}
              </Button>
              {onDismissError && (
                <button
                  onClick={onDismissError}
                  aria-label={t("dismiss")}
                  title={t("dismiss")}
                  className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <DayRoutePanel
        day={day}
        dayIdx={dayIdx}
        allDays={allDays}
        color={color}
        effectiveMode={effectiveMode}
        inheritedMode={inheritedMode}
        tripOriginLabel={tripOriginLabel}
        onSetDayMode={onSetDayMode}
        onSetDayStart={onSetDayStart}
        onReorderByMode={onReorderByMode}
        t={t}
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={day.places.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {day.places.length === 0 && (
              <p className="text-xs text-muted-foreground italic pl-2">—</p>
            )}
            {day.places.map((p, i) => {
              const otherDays = allDays
                .map((d, idx) => ({ day: d.day, idx }))
                .filter((d) => d.idx !== dayIdx);
              return (
                <SortablePlace
                  key={p.id}
                  place={p}
                  index={i}
                  color={color}
                  onRemove={() => onRemovePlace(p.id)}
                  onFocus={() => onFocusPlace(p.id)}
                  otherDays={otherDays}
                  onMove={(toDayIdx) => onMovePlace(p.id, toDayIdx)}
                  moveLabel={t("moveToDay")}
                  focusLabel={t("focusOnMap")}
                  dayLabel={t("day")}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function SortablePlace({
  place,
  index,
  color,
  onRemove,
  onFocus,
  otherDays,
  onMove,
  moveLabel,
  focusLabel,
  dayLabel,
}: {
  place: Place;
  index: number;
  color: string;
  onRemove: () => void;
  onFocus: () => void;
  otherDays: { day: number; idx: number }[];
  onMove: (toDayIdx: number) => void;
  moveLabel: string;
  focusLabel: string;
  dayLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: place.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="p-3 hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 -m-1 print:hidden"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div
          className="flex-shrink-0 h-7 w-7 rounded-full text-xs flex items-center justify-center text-white font-semibold"
          style={{ background: color }}
        >
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{place.name}</h3>
            {place.time && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {place.time}
              </span>
            )}
            {place.type && (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {place.type}
              </span>
            )}
          </div>
          {place.description && (
            <p className="text-xs text-muted-foreground mt-1">{place.description}</p>
          )}
          <p className="text-[10px] text-muted-foreground/70 mt-1 inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
          </p>
        </div>
        <div className="flex items-center gap-1 print:hidden">
          <button
            onClick={onFocus}
            className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity p-1"
            aria-label={focusLabel}
            title={focusLabel}
          >
            <MapPin className="h-4 w-4" />
          </button>
          {otherDays.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity p-1 text-[10px] font-semibold"
                  aria-label={moveLabel}
                  title={moveLabel}
                >
                  →D
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {otherDays.map((d) => (
                  <DropdownMenuItem key={d.idx} onClick={() => onMove(d.idx)}>
                    {moveLabel} {d.day}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            onClick={onRemove}
            className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-1"
            aria-label="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}

const MODE_KEYS: TravelMode[] = ["any", "walking", "transit", "mixed"];

function modeLabel(t: (k: keyof typeof dict.en) => string, m: TravelMode): string {
  return t(("mode" + m.charAt(0).toUpperCase() + m.slice(1)) as keyof typeof dict.en);
}

function TripModeBar({
  mode,
  onChange,
  onApplyAll,
  t,
}: {
  mode: TravelMode;
  onChange: (m: TravelMode) => void;
  onApplyAll: () => void;
  t: (k: any) => string;
}) {
  return (
    <div className="mb-6 p-3 rounded-lg bg-card/60 border flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-2">
        {t("tripMode")}
      </span>
      <div className="flex flex-wrap gap-1">
        {MODE_KEYS.map((m) => (
          <Button
            key={m}
            type="button"
            size="sm"
            variant={mode === m ? "default" : "outline"}
            onClick={() => onChange(m)}
          >
            {modeLabel(t, m)}
          </Button>
        ))}
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={onApplyAll} className="ml-auto">
        {t("applyToAll")}
      </Button>
    </div>
  );
}

function DayRoutePanel({
  day,
  dayIdx,
  allDays,
  color,
  effectiveMode,
  inheritedMode,
  tripOriginLabel,
  onSetDayMode,
  onSetDayStart,
  onReorderByMode,
  t,
}: {
  day: DayPlan;
  dayIdx: number;
  allDays: DayPlan[];
  color: string;
  effectiveMode: TravelMode;
  inheritedMode: TravelMode;
  tripOriginLabel?: string;
  onSetDayMode: (m: TravelMode | undefined) => void;
  onSetDayStart: (sp: DayStartPoint | undefined) => void;
  onReorderByMode: () => void;
  t: (k: any) => string;
}) {
  const anchor = useMemo(
    () => resolveAnchor(day.startPoint, day.places),
    [day.startPoint, day.places],
  );
  const est = useMemo(
    () => estimateDayTravel(day.places, effectiveMode, anchor),
    [day.places, effectiveMode, anchor],
  );
  const km = (est.totalMeters / 1000).toFixed(1);
  const longestKm = (est.longestLegMeters / 1000).toFixed(1);
  const startLabel =
    day.startPoint?.label ||
    (anchor ? t("startPoint") : tripOriginLabel || t("tripOrigin"));

  let reasoning: string;
  if (effectiveMode === "any") {
    reasoning = t("reasonNoMode");
  } else if (day.startPoint?.label) {
    reasoning = t("reasonNearestFrom")
      .replace("{start}", day.startPoint.label)
      .replace("{km}", longestKm);
  } else {
    reasoning = t("reasonNearestNoStart").replace("{km}", longestKm);
  }

  const [startOpen, setStartOpen] = useState(false);
  const [startQuery, setStartQuery] = useState("");

  const otherDayPlaces = useMemo(
    () =>
      allDays
        .map((d, idx) => ({ d, idx }))
        .filter(({ idx }) => idx !== dayIdx)
        .flatMap(({ d }) => d.places.map((p) => ({ p, dayNum: d.day }))),
    [allDays, dayIdx],
  );

  // Debounce store writes so rapid keyboard navigation doesn't thrash persisted state.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);
  const debouncedSetStart = (sp: DayStartPoint | undefined) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSetDayStart(sp), 120);
  };

  function chooseInherit() {
    debouncedSetStart(undefined);
    setStartOpen(false);
  }
  function chooseTripOrigin() {
    if (tripOriginLabel) debouncedSetStart({ label: tripOriginLabel });
    else debouncedSetStart(undefined);
    setStartOpen(false);
  }
  function choosePlace(p: Place) {
    debouncedSetStart({ label: p.name, lat: p.lat, lng: p.lng, placeId: p.id });
    setStartOpen(false);
  }
  function chooseCustom() {
    const label = startQuery.trim();
    if (!label) return;
    debouncedSetStart({ label });
    setStartOpen(false);
    setStartQuery("");
  }

  const anchorForMap = useMemo(
    () => (anchor ? { lat: anchor.lat, lng: anchor.lng, label: startLabel } : null),
    [anchor, startLabel],
  );

  return (
    <div className="mb-3 rounded-lg border bg-muted/30 p-3 text-xs space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-muted-foreground uppercase tracking-wide">
          {t("routePanel")}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              {t("travelMode")}: {day.travelMode ? modeLabel(t, day.travelMode) : `${t("inherit")} (${modeLabel(t, inheritedMode)})`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onSetDayMode(undefined)}>
              {t("inherit")} ({modeLabel(t, inheritedMode)})
            </DropdownMenuItem>
            {MODE_KEYS.map((m) => (
              <DropdownMenuItem key={m} onClick={() => onSetDayMode(m)}>
                {modeLabel(t, m)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover open={startOpen} onOpenChange={setStartOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs max-w-[260px] truncate">
              {t("startPoint")}: {startLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[300px]" align="start">
            <Command shouldFilter={true}>
              <CommandInput
                autoFocus
                placeholder={t("searchStartPoint")}
                value={startQuery}
                onValueChange={setStartQuery}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setStartOpen(false);
                    return;
                  }
                  if (e.key === "Enter" && startQuery.trim()) {
                    // If cmdk has no selected item (no matches), use the typed text as a custom label.
                    const root = (e.currentTarget.closest("[cmdk-root]") as HTMLElement) || null;
                    const selected = root?.querySelector('[cmdk-item][data-selected="true"]');
                    if (!selected) {
                      e.preventDefault();
                      chooseCustom();
                    }
                  }
                }}
              />
              <CommandList>
                <CommandEmpty>
                  {startQuery.trim() ? (
                    <button
                      type="button"
                      onClick={chooseCustom}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-accent"
                    >
                      {t("useCustomLabel").replace("{q}", startQuery.trim())}
                    </button>
                  ) : (
                    <span className="px-3 py-2 text-xs text-muted-foreground block">—</span>
                  )}
                </CommandEmpty>
                <CommandGroup heading={t("tripOrigin")}>
                  <CommandItem onSelect={chooseInherit} value="__inherit__">
                    {tripOriginLabel ? `${t("tripOrigin")} (${tripOriginLabel})` : t("inherit")}
                  </CommandItem>
                  {tripOriginLabel && (
                    <CommandItem onSelect={chooseTripOrigin} value={`origin:${tripOriginLabel}`}>
                      {tripOriginLabel}
                    </CommandItem>
                  )}
                </CommandGroup>
                {day.places.length > 0 && (
                  <CommandGroup heading={t("pickFromDay")}>
                    {day.places.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={`day:${p.name}`}
                        onSelect={() => choosePlace(p)}
                      >
                        {p.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {otherDayPlaces.length > 0 && (
                  <CommandGroup heading={t("otherDays")}>
                    {otherDayPlaces.map(({ p, dayNum }) => (
                      <CommandItem
                        key={`${dayNum}-${p.id}`}
                        value={`other:${dayNum}:${p.name}`}
                        onSelect={() => choosePlace(p)}
                      >
                        <span className="text-muted-foreground mr-2">D{dayNum}</span>
                        {p.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {startQuery.trim() && (
                  <CommandGroup heading=" ">
                    <CommandItem
                      value={`__custom__:${startQuery}`}
                      onSelect={chooseCustom}
                    >
                      {t("useCustomLabel").replace("{q}", startQuery.trim())}
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs ml-auto"
          onClick={onReorderByMode}
          disabled={effectiveMode === "any" || day.places.length < 2}
          title={effectiveMode === "any" ? t("reasonNoMode") : t("updateDayOrder")}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          {t("updateDayOrder")}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
        <span className="tabular-nums">
          ~{km} km · ~{est.totalMinutes} min · {modeLabel(t, effectiveMode)}
        </span>
        <span className="text-foreground/80">{reasoning}</span>
      </div>
      <DayMiniMap
        places={day.places}
        anchor={anchorForMap}
        color={color}
        startLabel={startLabel}
        styleLabels={{
          streets: t("mapStyleStreets"),
          satellite: t("mapStyleSatellite"),
          minimal: t("mapStyleMinimal"),
        }}
      />
      <DayTimeline
        places={day.places}
        anchor={anchor}
        anchorLabel={anchor ? startLabel : undefined}
        color={color}
        mode={effectiveMode}
        legMinutesTpl={t("legMinutes")}
        timelineLabel={t("timelineLabel")}
        showLabel={t("showMinutes")}
        hideLabel={t("hideMinutes")}
      />
    </div>
  );
}

function DayTimeline({
  places,
  anchor,
  anchorLabel,
  color,
  mode,
  legMinutesTpl,
  timelineLabel,
  showLabel,
  hideLabel,
}: {
  places: Place[];
  anchor: { lat: number; lng: number } | null;
  anchorLabel?: string;
  color: string;
  mode: TravelMode;
  legMinutesTpl: string;
  timelineLabel: string;
  showLabel: string;
  hideLabel: string;
}) {
  const showMinutesPref = useTimelineSettingsStore((s) => s.showMinutes);
  const setShowMinutes = useTimelineSettingsStore((s) => s.setShowMinutes);
  const allowMinutes = mode !== "any";
  const showMinutes = allowMinutes && showMinutesPref;

  // Compute leg minutes between consecutive stops only.
  // legs[i] is the minutes from the previous stop (anchor or place[i-1]) to place[i].
  // null means the leg can't be computed (missing coords on either endpoint or no prior stop).
  const legs = useMemo<(number | null)[]>(() => {
    if (!allowMinutes) return places.map(() => null);
    const profile = modeProfile(mode);
    const out: (number | null)[] = [];
    let prev: { lat: number; lng: number } | null = anchor ?? null;
    for (const p of places) {
      const hasP =
        typeof p.lat === "number" &&
        typeof p.lng === "number" &&
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng);
      const hasPrev =
        prev &&
        Number.isFinite(prev.lat) &&
        Number.isFinite(prev.lng);
      if (!prev || !hasPrev || !hasP) {
        out.push(null);
      } else {
        const km = haversineMeters(prev, p) / 1000;
        out.push(Math.round((km / profile.kmh) * 60 + profile.overheadMin));
      }
      if (hasP) prev = p;
    }
    return out;
  }, [places, anchor, mode, allowMinutes]);

  if (places.length === 0 && !anchor) return null;
  const truncate = (s: string, n = 18) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {timelineLabel}
        </div>
        {allowMinutes && (
          <button
            type="button"
            onClick={() => setShowMinutes(!showMinutesPref)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
            aria-pressed={showMinutesPref}
          >
            {showMinutesPref ? hideLabel : showLabel}
          </button>
        )}
      </div>
      <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pb-1">
        {anchor && anchorLabel && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-background text-[11px] font-medium">
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ background: "#0f172a", border: `1px solid ${color}` }}
            >
              S
            </span>
            {truncate(anchorLabel)}
          </span>
        )}
        {places.map((p, i) => {
          const hasPrior = !!anchor || i > 0;
          const legMin = legs[i];
          // Only render the connector when we actually have a previous stop AND a computable leg
          // (or, when minutes are toggled off, still show the arrow as long as a prior stop exists).
          const renderConnector =
            hasPrior && (showMinutes ? legMin != null : true);
          return (
            <span key={p.id} className="inline-flex items-center gap-1">
              {renderConnector && (
                <span className="text-muted-foreground text-[11px] tabular-nums px-1">
                  {showMinutes && legMin != null
                    ? `→ ${legMinutesTpl.replace("{n}", String(legMin))}`
                    : "→"}
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-background text-[11px] font-medium">
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: color }}
                >
                  {i + 1}
                </span>
                {truncate(p.name)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

