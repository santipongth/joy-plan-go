import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Calendar, Heart, Sparkles, ChevronDown, Compass, Trash2, AlertTriangle, ListChecks } from "lucide-react";
import { useT, useLangStore, dict } from "@/lib/i18n";
import { LangSwitch } from "@/components/LangSwitch";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { useItineraryStore, makeId } from "@/lib/store";
import { planTrip } from "@/server/plan-trip.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import MapView, { dayColor } from "@/components/MapView";
import { format } from "date-fns";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trip.Planner — AI Travel Itinerary Builder" },
      { name: "description", content: "Plan unforgettable trips with AI. Day-by-day itineraries, maps, and saved trips." },
    ],
  }),
  component: HomePage,
});

const INTERESTS: Array<keyof typeof dict.en> = ["culture", "nature", "food", "shopping", "family", "nightlife"];

const COMPANIONS = [
  { key: "solo", emoji: "🧍" },
  { key: "family_c", emoji: "👨‍👩‍👧" },
  { key: "couple", emoji: "💑" },
  { key: "friends", emoji: "🧑‍🤝‍🧑" },
  { key: "elderly", emoji: "🧓" },
] as const;

const STYLES = [
  { key: "cultural", emoji: "🎭" },
  { key: "classic", emoji: "🌟" },
  { key: "natureStyle", emoji: "🌿" },
  { key: "cityscape", emoji: "🏙️" },
  { key: "historical", emoji: "🏛️" },
] as const;

const PACES = [
  { key: "ambitious", emoji: "🥾" },
  { key: "moderate", emoji: "" },
  { key: "relaxedPace", emoji: "🌴" },
] as const;

const ACCOMMODATIONS = ["comfort", "premium", "luxury"] as const;
const RHYTHMS = [
  { key: "earlyStarts", emoji: "" },
  { key: "lateNights", emoji: "" },
] as const;
const TRAVEL_MODES = [
  { key: "any", emoji: "✨" },
  { key: "walking", emoji: "🚶" },
  { key: "transit", emoji: "🚇" },
  { key: "mixed", emoji: "🚶🚇" },
] as const;
type TravelModeKey = typeof TRAVEL_MODES[number]["key"];

function HomePage() {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const navigate = useNavigate();
  const itineraries = useItineraryStore((s) => s.itineraries);
  const addItinerary = useItineraryStore((s) => s.add);
  const removeItinerary = useItineraryStore((s) => s.remove);
  const planFn = useServerFn(planTrip);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState(3);
  const [startDate, setStartDate] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [budget, setBudget] = useState("medium");
  const [pace, setPace] = useState("moderate");
  const [companions, setCompanions] = useState<string>("");
  const [travelStyle, setTravelStyle] = useState<string[]>([]);
  const [accommodation, setAccommodation] = useState<string>("");
  const [rhythm, setRhythm] = useState<string[]>([]);
  const [otherNeeds, setOtherNeeds] = useState("");
  const [travelMode, setTravelMode] = useState<TravelModeKey>("any");
  const [loading, setLoading] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  function toggleInList(value: string, list: string[], setter: (v: string[]) => void) {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  function clearPrefs() {
    setInterests([]);
    setBudget("medium");
    setPace("moderate");
    setCompanions("");
    setTravelStyle([]);
    setAccommodation("");
    setRhythm([]);
    setOtherNeeds("");
    setTravelMode("any");
  }

  const mapGroups = useMemo(() => {
    return itineraries.flatMap((it, idx) =>
      it.days.flatMap((d) => ({
        day: d.day,
        color: dayColor(idx),
        places: d.places,
      }))
    );
  }, [itineraries]);

  // ===== Live preferences validation =====
  const issues = useMemo(() => {
    const list: { level: "warn" | "error"; key: string; msg: string }[] = [];
    if (otherNeeds.length > 1000) list.push({ level: "error", key: "otherLen", msg: t("warnOtherNeedsTooLong") });
    if (destination.trim().length > 200) list.push({ level: "error", key: "dest", msg: t("warnDestinationTooLong") });
    if (interests.length === 0 && !otherNeeds.trim() && travelStyle.length === 0)
      list.push({ level: "warn", key: "noInt", msg: t("warnNoInterests") });
    if (days > 10 && (pace === "packed" || pace === "ambitious"))
      list.push({ level: "warn", key: "paceLong", msg: t("warnPaceLong") });
    if (rhythm.includes("earlyStarts") && rhythm.includes("lateNights"))
      list.push({ level: "warn", key: "rhythm", msg: t("warnRhythmConflict") });
    return list;
  }, [otherNeeds, destination, interests, travelStyle, days, pace, rhythm, t]);

  // ===== Summary categories =====
  const summaryCategories: { label: string; value: string }[] = useMemo(() => {
    const items: { label: string; value: string }[] = [];
    if (destination.trim()) items.push({ label: t("headingTo"), value: destination.trim() });
    if (origin.trim()) items.push({ label: t("startingFrom"), value: origin.trim() });
    if (startDate) items.push({ label: t("dateDuration"), value: `${startDate} · ${days} ${t("days")}` });
    else items.push({ label: t("duration"), value: `${days} ${t("days")}` });
    if (interests.length) items.push({ label: t("interests"), value: interests.map((i) => t(i as keyof typeof dict.en) as string).join(", ") });
    if (budget) items.push({ label: t("budget"), value: t(budget as keyof typeof dict.en) as string });
    if (pace) items.push({ label: t("pace"), value: t(pace as keyof typeof dict.en) as string });
    if (companions) items.push({ label: t("companions"), value: t(companions as keyof typeof dict.en) as string });
    if (travelStyle.length) items.push({ label: t("travelStyle"), value: travelStyle.map((s) => t(s as keyof typeof dict.en) as string).join(", ") });
    if (accommodation) items.push({ label: t("accommodation"), value: t(accommodation as keyof typeof dict.en) as string });
    if (rhythm.length) items.push({ label: t("rhythm"), value: rhythm.map((r) => t(r as keyof typeof dict.en) as string).join(", ") });
    if (otherNeeds.trim()) items.push({ label: t("otherNeeds"), value: otherNeeds.trim().slice(0, 120) + (otherNeeds.length > 120 ? "…" : "") });
    return items;
  }, [destination, origin, startDate, days, interests, budget, pace, companions, travelStyle, accommodation, rhythm, otherNeeds, t]);

  const TOTAL_CATEGORIES = 8; // interests, budget, pace, companions, travelStyle, accommodation, rhythm, otherNeeds
  const filledCategories =
    (interests.length ? 1 : 0) +
    (budget ? 1 : 0) +
    (pace ? 1 : 0) +
    (companions ? 1 : 0) +
    (travelStyle.length ? 1 : 0) +
    (accommodation ? 1 : 0) +
    (rhythm.length ? 1 : 0) +
    (otherNeeds.trim() ? 1 : 0);

  function toggleInterest(i: string) {
    setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  }

  async function onAIPlan() {
    if (!destination.trim()) {
      toast.error(t("fillFields"));
      return;
    }
    const hardErrors = issues.filter((i) => i.level === "error");
    if (hardErrors.length) {
      toast.error(hardErrors[0].msg);
      return;
    }
    const softWarns = issues.filter((i) => i.level === "warn");
    softWarns.forEach((w) => toast.warning(w.msg));
    setLoading(true);
    try {
      const res = await planFn({
        data: {
          origin: origin.trim() || undefined,
          destination: destination.trim(),
          durationDays: days,
          startDate: startDate || undefined,
          interests: interests.map((k) => dict.en[k as keyof typeof dict.en] as string),
          budget,
          pace,
          companions: companions ? (dict.en[companions as keyof typeof dict.en] as string) : undefined,
          travelStyle: travelStyle.map((k) => dict.en[k as keyof typeof dict.en] as string),
          accommodation: accommodation ? (dict.en[accommodation as keyof typeof dict.en] as string) : undefined,
          rhythm: rhythm.map((k) => dict.en[k as keyof typeof dict.en] as string),
          otherNeeds: otherNeeds.trim() || undefined,
          travelMode,
          lang,
        },
      });
      if (res.error === "RATE_LIMIT") return toast.error(t("rateLimit"));
      if (res.error === "PAYMENT_REQUIRED") return toast.error(t("paymentRequired"));
      if (res.error || !res.days?.length) return toast.error(t("aiError"));

      const id = makeId();
      addItinerary({
        id,
        title: res.title,
        origin: origin.trim() || undefined,
        destination: destination.trim(),
        durationDays: days,
        startDate: startDate || undefined,
        citiesCount: res.citiesCount,
        days: res.days.map((d) => ({
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
        })),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      navigate({ to: "/itinerary/$id", params: { id } });
    } finally {
      setLoading(false);
    }
  }

  function onCreateMyself() {
    if (!destination.trim()) {
      toast.error(t("fillFields"));
      return;
    }
    const id = makeId();
    addItinerary({
      id,
      title: `${destination} ${days} ${t("days")}`,
      origin: origin.trim() || undefined,
      destination: destination.trim(),
      durationDays: days,
      startDate: startDate || undefined,
      citiesCount: 1,
      days: Array.from({ length: days }, (_, i) => ({ day: i + 1, title: "", places: [] })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    navigate({ to: "/itinerary/$id", params: { id } });
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--gradient-soft)" }}
    >
      <Toaster position="top-center" />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-h-screen">
        {/* LEFT */}
        <div className="px-4 sm:px-8 lg:px-12 py-6 overflow-auto">
          {/* Header */}
          <header className="flex items-center justify-between mb-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
                <Compass className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">{t("appName")}</h1>
            </Link>
            <LangSwitch />
          </header>

          {/* Planner Card */}
          <Card className="p-5 sm:p-6 shadow-lg border-border/50">
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">{t("startingFrom")}</Label>
                <PlaceAutocomplete
                  value={origin}
                  onChange={(v) => setOrigin(v)}
                  placeholder={t("placeholderPlace")}
                  icon={<MapPin className="h-4 w-4" />}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">{t("headingTo")}</Label>
                  <PlaceAutocomplete
                    value={destination}
                    onChange={(v) => setDestination(v)}
                    placeholder={t("placeholderPlace")}
                    icon={<MapPin className="h-4 w-4" />}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">{t("dateDuration")}</Label>
                  <div className="relative">
                    <Calendar className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <Collapsible open={prefsOpen} onOpenChange={setPrefsOpen}>
                <CollapsibleTrigger asChild>
                  <button type="button" className="flex items-center gap-2 text-sm font-medium hover:text-primary">
                    <Heart className="h-4 w-4" />
                    {t("preferences")}
                    <ChevronDown className={`h-4 w-4 transition-transform ${prefsOpen ? "rotate-180" : ""}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">
                      {t("duration")}: <span className="font-semibold text-foreground">{days}</span>
                    </Label>
                    <Slider min={1} max={14} step={1} value={[days]} onValueChange={(v) => setDays(v[0])} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">{t("interests")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {INTERESTS.map((i) => (
                        <Badge
                          key={i}
                          variant={interests.includes(i) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleInterest(i)}
                        >
                          {t(i)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
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
                      <Label className="text-xs text-muted-foreground mb-2 block">{t("pace")}</Label>
                      <div className="flex gap-1">
                        {(["relaxed", "normal", "packed"] as const).map((p) => (
                          <Button
                            key={p}
                            type="button"
                            size="sm"
                            variant={pace === p ? "default" : "outline"}
                            onClick={() => setPace(p)}
                            className="flex-1"
                          >
                            {t(p)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">{t("companions")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {COMPANIONS.map((c) => (
                        <Button
                          key={c.key}
                          type="button"
                          size="sm"
                          variant={companions === c.key ? "default" : "outline"}
                          onClick={() => setCompanions(companions === c.key ? "" : c.key)}
                        >
                          <span className="mr-1">{c.emoji}</span>
                          {t(c.key as keyof typeof dict.en)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">{t("travelStyle")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {STYLES.map((s) => (
                        <Button
                          key={s.key}
                          type="button"
                          size="sm"
                          variant={travelStyle.includes(s.key) ? "default" : "outline"}
                          onClick={() => toggleInList(s.key, travelStyle, setTravelStyle)}
                        >
                          <span className="mr-1">{s.emoji}</span>
                          {t(s.key as keyof typeof dict.en)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">{t("pace")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {PACES.map((p) => (
                        <Button
                          key={p.key}
                          type="button"
                          size="sm"
                          variant={pace === p.key ? "default" : "outline"}
                          onClick={() => setPace(p.key)}
                        >
                          {p.emoji && <span className="mr-1">{p.emoji}</span>}
                          {t(p.key as keyof typeof dict.en)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">{t("accommodation")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {ACCOMMODATIONS.map((a) => (
                        <Button
                          key={a}
                          type="button"
                          size="sm"
                          variant={accommodation === a ? "default" : "outline"}
                          onClick={() => setAccommodation(accommodation === a ? "" : a)}
                        >
                          {t(a as keyof typeof dict.en)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">{t("rhythm")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {RHYTHMS.map((r) => (
                        <Button
                          key={r.key}
                          type="button"
                          size="sm"
                          variant={rhythm.includes(r.key) ? "default" : "outline"}
                          onClick={() => toggleInList(r.key, rhythm, setRhythm)}
                        >
                          {t(r.key as keyof typeof dict.en)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">{t("otherNeeds")}</Label>
                    <Textarea
                      value={otherNeeds}
                      onChange={(e) => setOtherNeeds(e.target.value.slice(0, 1000))}
                      placeholder={t("otherNeedsPlaceholder")}
                      className="min-h-[80px] resize-none"
                    />
                    <div className="text-right text-xs text-muted-foreground mt-1">
                      {otherNeeds.length}/1000
                    </div>
                  </div>

                  {issues.length > 0 && (
                    <div className="rounded-md border bg-muted/40 p-2.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {t("issuesTitle")}
                      </div>
                      <ul className="space-y-0.5">
                        {issues.map((iss) => (
                          <li
                            key={iss.key}
                            className={`text-xs ${iss.level === "error" ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}
                          >
                            • {iss.msg}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <Button type="button" variant="link" size="sm" onClick={clearPrefs} className="px-0">
                      {t("clear")}
                    </Button>
                    <Button type="button" size="sm" onClick={() => setPrefsOpen(false)}>
                      {t("confirm")}
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button variant="outline" onClick={onCreateMyself} className="flex-1" disabled={loading}>
                  {t("createMyself")}
                </Button>
                <Button
                  onClick={onAIPlan}
                  disabled={loading}
                  className="flex-1 text-primary-foreground border-0"
                  style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  {loading ? t("aiPlanning") : t("planWithAI")}
                </Button>
              </div>
            </div>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-4">{t("terms")}</p>

          {/* My Itineraries */}
          <section className="mt-10">
            <h2 className="text-lg font-bold mb-4">{t("myItineraries")}</h2>
            {itineraries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noItineraries")}</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {itineraries.map((it) => {
                  const totalPlaces = it.days.reduce((sum, d) => sum + d.places.length, 0);
                  return (
                    <Card
                      key={it.id}
                      className="group relative overflow-hidden cursor-pointer hover:shadow-lg transition-shadow p-0 gap-0"
                      onClick={() => navigate({ to: "/itinerary/$id", params: { id: it.id } })}
                    >
                      <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary-glow/30 flex items-center justify-center">
                        <Compass className="h-12 w-12 text-primary/40" />
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-sm line-clamp-2 mb-1">{it.title || t("untitled")}</h3>
                        <p className="text-xs text-muted-foreground">
                          {it.durationDays} {t("days")} · {totalPlaces} {t("places")} · {it.citiesCount} {t("cities")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(it.updatedAt, "MMM d, yyyy")} {t("autoSaved")}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(t("confirmDelete"))) removeItinerary(it.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT — Map + Summary overlay */}
        <div className="hidden lg:block sticky top-0 h-screen p-4 relative">
          <MapView groups={mapGroups} />
          <div className="absolute top-6 right-6 w-80 max-h-[calc(100vh-3rem)] overflow-auto rounded-xl border bg-background/95 backdrop-blur shadow-lg p-4 z-[1000]">
            <div className="flex items-center gap-2 mb-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">{t("summaryTitle")}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {t("categoriesSelected").replace("{n}", String(filledCategories)).replace("{total}", String(TOTAL_CATEGORIES))}
            </p>
            {summaryCategories.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">{t("summaryEmpty")}</p>
            ) : (
              <ul className="space-y-2">
                {summaryCategories.map((c, i) => (
                  <li key={i} className="text-xs">
                    <div className="text-muted-foreground">{c.label}</div>
                    <div className="font-medium text-foreground break-words">{c.value}</div>
                  </li>
                ))}
              </ul>
            )}
            {issues.length > 0 && (
              <div className="mt-3 pt-3 border-t space-y-1">
                {issues.map((iss) => (
                  <div
                    key={iss.key}
                    className={`text-xs flex items-start gap-1 ${iss.level === "error" ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}
                  >
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{iss.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
