import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  Undo2,
  Maximize2,
  Minimize2,
  Bookmark,
  BookmarkCheck,
  StickyNote,
} from "lucide-react";
import MapView, { dayColor } from "@/components/MapView";
import { useIsMobile } from "@/hooks/use-mobile";
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
import type { Place, DayPlan, TravelMode, Itinerary } from "@/lib/types";
import { planSingleDay } from "@/server/plan-trip.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import WeatherStrip from "@/components/WeatherStrip";
import PackingChecklist from "@/components/PackingChecklist";
import LocalTipsCard from "@/components/LocalTipsCard";
import SimilarPopover from "@/components/SimilarPopover";
import { buildIcs, buildGpx, downloadFile, safeFilename } from "@/lib/export-trip";
import { haversineMeters, modeProfile, resolveAnchor } from "@/lib/route-utils";

import { suggestMeals } from "@/server/discover.functions";
import ShareTripDialog from "@/components/ShareTripDialog";
import ThemeToggle from "@/components/ThemeToggle";
import AuthButton from "@/components/AuthButton";

import PhotoGallery from "@/components/PhotoGallery";
import LodgingCard from "@/components/LodgingCard";
import DayTransportPanel from "@/components/DayTransportPanel";
import DayLodgingPanel from "@/components/DayLodgingPanel";

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
  const duplicateTrip = useItineraryStore((s) => s.duplicate);
  const replaceDay = useItineraryStore((s) => s.replaceDay);
  const movePlace = useItineraryStore((s) => s.movePlace);
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
  const [overlaysCollapsed, setOverlaysCollapsed] = useState(false);
  const isMobile = useIsMobile();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(itinerary?.title ?? "");
  const visibleArr = useVisibilityStore((s) => s.visibleDaysByItinerary[id]);
  const setVisible = useVisibilityStore((s) => s.setVisible);
  const toggleVisible = useVisibilityStore((s) => s.toggle);
  const [regenLoading, setRegenLoading] = useState<number | null>(null);
  const [regenErrors, setRegenErrors] = useState<Record<number, string>>({});
  // Pending regenerate confirmations when undo stack is non-empty
  const [pendingRegenDay, setPendingRegenDay] = useState<number | null>(null);

  // ESC closes overlays on any screen size
  useEffect(() => {
    if (overlaysCollapsed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverlaysCollapsed(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlaysCollapsed]);

  // Swipe gesture helper for overlay panels
  function makeSwipeHandlers(direction: "horizontal" | "vertical", onDismiss: () => void) {
    const start = { x: 0, y: 0, t: 0 };
    return {
      onTouchStart: (e: React.TouchEvent) => {
        const tch = e.touches[0];
        start.x = tch.clientX;
        start.y = tch.clientY;
        start.t = Date.now();
      },
      onTouchEnd: (e: React.TouchEvent) => {
        const tch = e.changedTouches[0];
        const dx = tch.clientX - start.x;
        const dy = tch.clientY - start.y;
        const dt = Date.now() - start.t;
        if (dt > 600) return;
        if (direction === "horizontal") {
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onDismiss();
        } else {
          if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx) * 1.5) onDismiss();
        }
      },
    };
  }

  // Stop map drag/zoom while interacting with overlay panels
  const stopMapEvents = {
    onPointerDownCapture: (e: React.PointerEvent) => e.stopPropagation(),
    onMouseDownCapture: (e: React.MouseEvent) => e.stopPropagation(),
    onTouchStartCapture: (e: React.TouchEvent) => e.stopPropagation(),
    onTouchMoveCapture: (e: React.TouchEvent) => e.stopPropagation(),
    onWheelCapture: (e: React.WheelEvent) => e.stopPropagation(),
    onDoubleClickCapture: (e: React.MouseEvent) => e.stopPropagation(),
  };

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

  /**
   * Pop one undo entry for a day and apply it (or apply explicit `prevSnapshot`).
   * Shows a toast describing how many steps were undone and remaining count.
   */
  function undoReorder(dayIdx: number, dayNumber: number, prevSnapshot?: Place[]) {
    const before = historyDepths[dayIdx] ?? 0;
    let prev = prevSnapshot;
    if (prev) {
      // Toast-action snapshot path: also pop one entry to keep stack consistent.
      popHistory(id, dayIdx);
    } else {
      prev = popHistory(id, dayIdx);
    }
    if (!prev) return;
    reorderPlaces(id, dayIdx, prev);
    const remaining = Math.max(0, before - 1);
    const key = remaining > 0 ? "undidStepRemaining" : "undidStepNoMore";
    toast.success(
      t(key).replace("{day}", String(dayNumber)).replace("{remaining}", String(remaining)),
    );
  }

  /** Wrap regenerateDay with a confirmation when the day's undo stack is non-empty. */
  function requestRegenerateDay(dayIdx: number) {
    const depth = historyDepths[dayIdx] ?? 0;
    if (depth > 0) {
      setPendingRegenDay(dayIdx);
      return;
    }
    void regenerateDay(dayIdx);
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

  function exportPdf() {
    // Print-friendly: open print dialog (user can save as PDF)
    window.print();
  }

  function exportIcs() {
    if (!itinerary) return;
    downloadFile(buildIcs(itinerary), `${safeFilename(itinerary.title)}.ics`, "text/calendar");
  }

  function exportGpx() {
    if (!itinerary) return;
    downloadFile(buildGpx(itinerary), `${safeFilename(itinerary.title)}.gpx`, "application/gpx+xml");
  }

  function onDuplicate() {
    if (!itinerary) return;
    const newId = duplicateTrip(itinerary.id, `${t("copyOf")} ${itinerary.title}`);
    if (newId) {
      toast.success(t("duplicatedToast"));
      navigate({ to: "/itinerary/$id", params: { id: newId } });
    }
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
                  <DropdownMenuItem onClick={exportIcs}>
                    <FileDown className="h-4 w-4 mr-2" />
                    {t("exportIcs")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportGpx}>
                    <FileDown className="h-4 w-4 mr-2" />
                    {t("exportGpx")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDuplicate}>
                    <FileDown className="h-4 w-4 mr-2" />
                    {t("duplicateTrip")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={copyShareLink}>
                    <Share2 className="h-4 w-4 mr-2" />
                    {t("shareLink")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ShareTripDialog itinerary={itinerary} />
              <ThemeToggle />
              <LangSwitch />
              <AuthButton />
            </div>
          </header>

          <Card className="mb-4 p-4 sm:p-5 w-full max-w-full overflow-hidden">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
              {t("tripCardTitle")}
            </div>

            {/* Header */}
            <div className="space-y-1">
              {editingTitle ? (
                <div className="flex gap-2">
                  <Input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="text-lg sm:text-xl font-bold"
                  />
                  <Button size="icon" onClick={saveTitle}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold break-words flex-1 min-w-0">
                    {itinerary.title}
                  </h1>
                  <button
                    onClick={() => {
                      setTitleDraft(itinerary.title);
                      setEditingTitle(true);
                    }}
                    className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-1"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              )}
              <p className="text-sm text-muted-foreground break-words">
                {itinerary.destination} · {itinerary.durationDays} {t("days")}
              </p>
            </div>

            <div className="mt-4">
              <WeatherStrip itinerary={itinerary} />
            </div>

            {/* Sub-cards inside trip card */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 [&>*]:w-full [&>*]:max-w-full [&>*]:min-w-0">
              <BudgetEstimate
                itinerary={itinerary}
                onTravelersChange={(n) => update(id, { travelers: n })}
                onTierChange={(b) => update(id, { budget: b })}
              />
              <PackingChecklist itinerary={itinerary} />
              <LocalTipsCard itinerary={itinerary} />
            </div>
          </Card>

          <div className="mb-4">
            <LodgingCard itinerary={itinerary} />
          </div>

          {/* Day legend with show/hide toggles */}
          <div className="mb-6 p-3 rounded-lg bg-card/60 border">
            <div className="mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("daysLegend")} · {t("showOnMap")}
              </span>
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
              const effectiveMode: TravelMode = d.travelMode ?? itinerary.travelMode ?? "any";
              return (
                <DaySection
                  key={d.day}
                  day={d}
                  dayIdx={dayIdx}
                  color={color}
                  itineraryId={id}
                  itinerary={itinerary}
                  allDays={itinerary.days}
                  tripOriginLabel={itinerary.origin}
                  effectiveMode={effectiveMode}
                  
                  onAddPlace={() => onAddPlace(dayIdx)}
                  onRemovePlace={(placeId) => removePlace(id, dayIdx, placeId)}
                  onReorder={(places) => reorderPlaces(id, dayIdx, places)}
                  onRegenerate={() => requestRegenerateDay(dayIdx)}
                  onMovePlace={(placeId, toDayIdx) => handleMovePlace(placeId, dayIdx, toDayIdx)}
                  onFocusPlace={focusPlace}
                  selectedPlaceId={selectedPlaceId}
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
                lodgings={itinerary.lodgings ?? []}
                highlightedType={highlightedType}
                selectedPlaceId={selectedPlaceId}
              />
              {/* Collapse/expand overlays toggle (top-right, above zoom + overlays) */}
              <button
                onClick={() => setOverlaysCollapsed((v) => !v)}
                title={overlaysCollapsed ? t("showOverlays") : t("hideOverlays")}
                aria-label={overlaysCollapsed ? t("showOverlays") : t("hideOverlays")}
                className="absolute top-3 right-3 z-[1200] h-8 w-8 flex items-center justify-center bg-background/95 backdrop-blur rounded-md shadow-md border hover:bg-muted transition-colors"
              >
                {overlaysCollapsed ? (
                  <Maximize2 className="h-4 w-4" />
                ) : (
                  <Minimize2 className="h-4 w-4" />
                )}
              </button>

              {/* Type filter chips — slides up off-screen when collapsed */}
              {typeCounts.size > 0 && (
                <div
                  aria-hidden={overlaysCollapsed}
                  {...stopMapEvents}
                  {...(isMobile
                    ? makeSwipeHandlers("vertical", () => setOverlaysCollapsed(true))
                    : {})}
                  style={{ touchAction: isMobile ? "pan-x" : undefined }}
                  className={`absolute top-3 left-3 right-14 z-[1100] bg-background/95 backdrop-blur rounded-lg shadow-md border p-2 gap-1 transition-all duration-300 ease-out ${
                    isMobile
                      ? "flex flex-nowrap overflow-x-auto overscroll-x-contain"
                      : "flex flex-wrap"
                  } ${
                    overlaysCollapsed
                      ? "-translate-y-[150%] opacity-0 pointer-events-none"
                      : "translate-y-0 opacity-100"
                  }`}
                >
                  <button
                    onClick={() => setHighlightedType(null)}
                    className={`rounded-full border transition-colors flex-shrink-0 ${
                      isMobile
                        ? "text-xs px-3 py-2 min-h-[36px]"
                        : "text-[11px] px-2 py-1"
                    } ${
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
                        className={`rounded-full border transition-colors capitalize flex-shrink-0 ${
                          isMobile
                            ? "text-xs px-3 py-2 min-h-[36px]"
                            : "text-[11px] px-2 py-1"
                        } ${
                          highlightedType === tp
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        {tp} <span className="opacity-60">({n})</span>
                      </button>
                    ))}
                  {isMobile && !overlaysCollapsed && (
                    <span className="ml-auto self-center text-[10px] text-muted-foreground italic flex-shrink-0 pl-2">
                      ↑ {t("swipeToCollapseV")}
                    </span>
                  )}
                </div>
              )}

              {/* Floating day legend — slides off-screen when collapsed */}
              <div
                aria-hidden={overlaysCollapsed}
                {...stopMapEvents}
                {...(isMobile
                  ? makeSwipeHandlers("horizontal", () => setOverlaysCollapsed(true))
                  : {})}
                className={`absolute z-[1100] bg-background/95 backdrop-blur rounded-lg shadow-md border p-2 transition-all duration-300 ease-out ${
                  isMobile
                    ? `top-14 right-3 max-w-[220px] ${
                        overlaysCollapsed
                          ? "translate-x-[120%] opacity-0 pointer-events-none"
                          : "translate-x-0 opacity-100"
                      }`
                    : `bottom-3 left-3 max-w-[220px] ${
                        overlaysCollapsed
                          ? "-translate-x-[120%] opacity-0 pointer-events-none"
                          : "translate-x-0 opacity-100"
                      }`
                }`}
              >
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
                        className={`flex items-center gap-1.5 w-full text-left rounded hover:bg-muted transition-colors ${
                          isMobile
                            ? "text-sm px-2 py-2 min-h-[40px]"
                            : "text-xs px-1.5 py-1"
                        } ${visible ? "" : "opacity-40"}`}
                      >
                        <span
                          className={`rounded-full flex-shrink-0 ${
                            isMobile ? "h-3 w-3" : "h-2.5 w-2.5"
                          }`}
                          style={{ background: dayColor(d.day - 1) }}
                        />
                        <span className="truncate flex-1">
                          {t("day")} {d.day}
                          {d.title ? ` — ${d.title}` : ""}
                        </span>
                        {visible ? (
                          <Eye className={`text-muted-foreground flex-shrink-0 ${isMobile ? "h-4 w-4" : "h-3 w-3"}`} />
                        ) : (
                          <EyeOff className={`text-muted-foreground flex-shrink-0 ${isMobile ? "h-4 w-4" : "h-3 w-3"}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
                {isMobile && !overlaysCollapsed && (
                  <div className="mt-1.5 pt-1.5 border-t text-[10px] text-muted-foreground italic text-center">
                    {t("swipeToCollapseH")} →
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation: regenerate single day with pending undo entries */}
      <AlertDialog
        open={pendingRegenDay !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRegenDay(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("regenConfirmTitle").replace(
                "{day}",
                pendingRegenDay !== null
                  ? String(itinerary.days[pendingRegenDay]?.day ?? "")
                  : "",
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("regenConfirmBody").replace(
                "{n}",
                pendingRegenDay !== null
                  ? String(historyDepths[pendingRegenDay] ?? 0)
                  : "0",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const idx = pendingRegenDay;
                setPendingRegenDay(null);
                if (idx !== null) void regenerateDay(idx);
              }}
            >
              {t("regenConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface DaySectionProps {
  day: DayPlan;
  dayIdx: number;
  color: string;
  itineraryId: string;
  itinerary: Itinerary;
  allDays: DayPlan[];
  tripOriginLabel?: string;
  effectiveMode: TravelMode;
  onAddPlace: () => void;
  onRemovePlace: (placeId: string) => void;
  onReorder: (places: Place[]) => void;
  onRegenerate: () => void;
  onMovePlace: (placeId: string, toDayIdx: number) => void;
  onFocusPlace: (placeId: string) => void;
  selectedPlaceId?: string | null;
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
  itineraryId,
  itinerary,
  allDays,
  tripOriginLabel,
  effectiveMode,
  onAddPlace,
  onRemovePlace,
  onReorder,
  onRegenerate,
  onMovePlace,
  onFocusPlace,
  selectedPlaceId,
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
  const updatePlaceField = useItineraryStore((s) => s.updatePlace);
  const addPlaceFn = useItineraryStore((s) => s.addPlace);
  const suggestMealsFn = useServerFn(suggestMeals);
  const lang = useLangStore((s) => s.lang);
  const [mealsLoading, setMealsLoading] = useState(false);

  async function handleSuggestMeals() {
    if (day.places.length === 0) return;
    setMealsLoading(true);
    try {
      const res = await suggestMealsFn({
        data: {
          destination: itinerary.destination,
          dayPlaces: day.places.map((p) => ({
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            kind: p.kind,
          })),
          lang,
        },
      });
      if (res.error) {
        if (res.error === "RATE_LIMIT") toast.error(t("aiRateLimit"));
        else if (res.error === "PAYMENT_REQUIRED") toast.error(t("aiPaymentRequired"));
        else toast.error(t("aiError"));
        return;
      }
      for (const m of res.meals) {
        addPlaceFn(itineraryId, dayIdx, {
          id: makeId(),
          name: m.name,
          description: m.description,
          time: m.time,
          type: m.cuisine || "food",
          lat: m.lat,
          lng: m.lng,
          kind: "meal",
        });
      }
      toast.success(t("mealsAdded").replace("{n}", String(res.meals.length)));
    } finally {
      setMealsLoading(false);
    }
  }


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
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSuggestMeals}
            disabled={mealsLoading || day.places.length === 0}
            title={t("suggestMeals")}
          >
            {mealsLoading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            🍴 {t("suggestMeals")}
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
        color={color}
        effectiveMode={effectiveMode}
        tripOriginLabel={tripOriginLabel}
        t={t}
      />

      <div className="my-2">
        <PhotoGallery itinerary={itinerary} dayIndex={dayIdx} compact />
      </div>

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
                  
                  onUpdatePlace={(patch) =>
                    updatePlaceField(itineraryId, dayIdx, p.id, patch)
                  }
                  itinerary={itinerary}
                  dayIdx={dayIdx}
                  t={t}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
      <DayTransportPanel itinerary={itinerary} day={day} dayIdx={dayIdx} />
      <DayLodgingPanel
        itinerary={itinerary}
        dayIdx={dayIdx}
        onFocusLodging={(lodgingId) => onFocusPlace(`lodging:${lodgingId}`)}
        selectedPlaceId={selectedPlaceId}
      />
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
  
  onUpdatePlace,
  itinerary,
  dayIdx,
  t,
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
  
  onUpdatePlace: (patch: Partial<Place>) => void;
  itinerary: Itinerary;
  dayIdx: number;
  t: (k: any) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: place.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [notesOpen, setNotesOpen] = useState(!!place.notes);
  const [notesDraft, setNotesDraft] = useState(place.notes ?? "");


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
            {place.bookmarked && (
              <BookmarkCheck
                className="h-3.5 w-3.5 text-amber-500"
                aria-label={t("bookmarked")}
              />
            )}
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


          {/* Notes editor */}
          {notesOpen ? (
            <div className="mt-2 print:hidden">
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={() => onUpdatePlace({ notes: notesDraft.trim() || undefined })}
                placeholder={t("notesPlaceholder")}
                rows={2}
                className="w-full text-xs rounded-md border border-input bg-background px-2 py-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              />
            </div>
          ) : (
            place.notes && (
              <button
                onClick={() => setNotesOpen(true)}
                className="mt-2 text-xs text-left rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 px-2 py-1.5 w-full inline-flex items-start gap-1.5 hover:bg-amber-100/70 dark:hover:bg-amber-950/50 transition-colors print:hidden"
              >
                <StickyNote className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="whitespace-pre-wrap">{place.notes}</span>
              </button>
            )
          )}
        </div>
        <div className="flex items-center gap-1 print:hidden">
          <button
            onClick={() => onUpdatePlace({ bookmarked: !place.bookmarked })}
            className={
              "transition-opacity p-1 " +
              (place.bookmarked
                ? "text-amber-500"
                : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-amber-500")
            }
            aria-label={t("bookmark")}
            title={t("bookmark")}
          >
            {place.bookmarked ? (
              <BookmarkCheck className="h-4 w-4" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => {
              setNotesDraft(place.notes ?? "");
              setNotesOpen((o) => !o);
            }}
            className={
              "transition-opacity p-1 " +
              (place.notes || notesOpen
                ? "text-primary"
                : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary")
            }
            aria-label={t("addNote")}
            title={t("addNote")}
          >
            <StickyNote className="h-4 w-4" />
          </button>
          <button
            onClick={onFocus}
            className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity p-1"
            aria-label={focusLabel}
            title={focusLabel}
          >
            <MapPin className="h-4 w-4" />
          </button>
          <SimilarPopover itinerary={itinerary} dayIdx={dayIdx} place={place} />
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

function DayRoutePanel({
  day,
  color,
  effectiveMode,
  tripOriginLabel,
  t,
}: {
  day: DayPlan;
  color: string;
  effectiveMode: TravelMode;
  tripOriginLabel?: string;
  t: (k: any) => string;
}) {
  const anchor = useMemo(
    () => resolveAnchor(day.startPoint, day.places),
    [day.startPoint, day.places],
  );
  const startLabel =
    day.startPoint?.label ||
    (anchor ? t("startPoint") : tripOriginLabel || t("tripOrigin"));

  const anchorForMap = useMemo(
    () => (anchor ? { lat: anchor.lat, lng: anchor.lng, label: startLabel } : null),
    [anchor, startLabel],
  );

  return (
    <div className="mb-3 rounded-lg border bg-muted/30 p-3 text-xs space-y-2">
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

