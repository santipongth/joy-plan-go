import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useItineraryStore, makeId } from "@/lib/store";
import { useVisibilityStore } from "@/lib/visibility-store";
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
import type { Place, DayPlan } from "@/lib/types";
import { planSingleDay, planTrip } from "@/server/plan-trip.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

          <div className="space-y-6">
            {itinerary.days.map((d, dayIdx) => {
              const color = dayColor(d.day - 1);
              return (
                <DaySection
                  key={d.day}
                  day={d}
                  dayIdx={dayIdx}
                  color={color}
                  itineraryId={id}
                  allDays={itinerary.days}
                  onAddPlace={() => onAddPlace(dayIdx)}
                  onRemovePlace={(placeId) => removePlace(id, dayIdx, placeId)}
                  onReorder={(places) => reorderPlaces(id, dayIdx, places)}
                  onRegenerate={() => regenerateDay(dayIdx)}
                  onMovePlace={(placeId, toDayIdx) => handleMovePlace(placeId, dayIdx, toDayIdx)}
                  onFocusPlace={focusPlace}
                  regenerating={regenLoading === d.day}
                  errorMessage={regenErrors[d.day]}
                  onDismissError={() => clearRegenError(d.day)}
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
  onAddPlace: () => void;
  onRemovePlace: (placeId: string) => void;
  onReorder: (places: Place[]) => void;
  onRegenerate: () => void;
  onMovePlace: (placeId: string, toDayIdx: number) => void;
  onFocusPlace: (placeId: string) => void;
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
  onAddPlace,
  onRemovePlace,
  onReorder,
  onRegenerate,
  onMovePlace,
  onFocusPlace,
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
    onReorder(arrayMove(day.places, oldIdx, newIdx));
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
        </h2>
        <div className="flex gap-1">
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={day.places.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {day.places.length === 0 && (
              <p className="text-xs text-muted-foreground italic pl-2">—</p>
            )}
            {day.places.map((p, i) => (
              <SortablePlace
                key={p.id}
                place={p}
                index={i}
                color={color}
                onRemove={() => onRemovePlace(p.id)}
              />
            ))}
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
}: {
  place: Place;
  index: number;
  color: string;
  onRemove: () => void;
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
        <button
          onClick={onRemove}
          className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity print:hidden"
          aria-label="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
