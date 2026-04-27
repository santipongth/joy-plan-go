import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useItineraryStore, makeId } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trash2, Plus, Compass, MapPin, Clock, Pencil, Check } from "lucide-react";
import MapView, { dayColor } from "@/components/MapView";
import { LangSwitch } from "@/components/LangSwitch";
import { Toaster } from "@/components/ui/sonner";

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
  const itinerary = useItineraryStore((s) => s.itineraries.find((i) => i.id === id));
  const update = useItineraryStore((s) => s.update);
  const removeItin = useItineraryStore((s) => s.remove);
  const removePlace = useItineraryStore((s) => s.removePlace);
  const addPlace = useItineraryStore((s) => s.addPlace);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(itinerary?.title ?? "");
  const [activeDay, setActiveDay] = useState(1);

  const groups = useMemo(() => {
    if (!itinerary) return [];
    return itinerary.days.map((d) => ({
      day: d.day,
      color: dayColor(d.day - 1),
      places: d.places,
    }));
  }, [itinerary]);

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

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <Toaster position="top-center" />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-h-screen">
        <div className="overflow-auto px-4 sm:px-8 py-6">
          <header className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/" })}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("back")}
            </Button>
            <LangSwitch />
          </header>

          <div className="mb-6">
            {editingTitle ? (
              <div className="flex gap-2">
                <Input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} className="text-xl font-bold" />
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

          <div className="space-y-6">
            {itinerary.days.map((d, dayIdx) => {
              const color = dayColor(d.day - 1);
              return (
                <section
                  key={d.day}
                  onMouseEnter={() => setActiveDay(d.day)}
                  className={`relative pl-6 ${activeDay === d.day ? "" : "opacity-90"}`}
                >
                  <div
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-full"
                    style={{ background: color }}
                  />
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold flex items-center gap-2">
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs text-white font-semibold"
                        style={{ background: color }}
                      >
                        {d.day}
                      </span>
                      {t("day")} {d.day}
                      {d.title && <span className="text-muted-foreground font-normal text-sm">— {d.title}</span>}
                    </h2>
                    <Button size="sm" variant="ghost" onClick={() => onAddPlace(dayIdx)}>
                      <Plus className="h-4 w-4 mr-1" />
                      {t("addPlace")}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {d.places.length === 0 && (
                      <p className="text-xs text-muted-foreground italic pl-2">—</p>
                    )}
                    {d.places.map((p, i) => (
                      <Card key={p.id} className="p-3 hover:shadow-md transition-shadow group">
                        <div className="flex items-start gap-3">
                          <div
                            className="flex-shrink-0 h-7 w-7 rounded-full text-xs flex items-center justify-center text-white font-semibold"
                            style={{ background: color }}
                          >
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-sm">{p.name}</h3>
                              {p.time && (
                                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {p.time}
                                </span>
                              )}
                              {p.type && (
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {p.type}
                                </span>
                              )}
                            </div>
                            {p.description && (
                              <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground/70 mt-1 inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                            </p>
                          </div>
                          <button
                            onClick={() => removePlace(id, dayIdx, p.id)}
                            className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>
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
            <MapView groups={groups} />
          )}
        </div>
      </div>
    </div>
  );
}
