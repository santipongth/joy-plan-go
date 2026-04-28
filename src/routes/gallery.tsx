import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass, MapPin, Calendar, Loader2, ArrowLeft, Copy } from "lucide-react";
import { useT } from "@/lib/i18n";
import { LangSwitch } from "@/components/LangSwitch";
import AuthButton from "@/components/AuthButton";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { fetchPublicTrips, type CloudTripRow, rowToItinerary, pushTrip } from "@/lib/cloud-sync";
import { useAuth } from "@/hooks/use-auth";
import { useItineraryStore, makeId } from "@/lib/store";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Public trips — Trip.Planner" },
      { name: "description", content: "Discover trips shared by other travelers." },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const t = useT();
  const { user } = useAuth();
  const [trips, setTrips] = useState<CloudTripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const addItinerary = useItineraryStore((s) => s.add);

  useEffect(() => {
    fetchPublicTrips()
      .then((data) => setTrips(data))
      .catch((e) => {
        console.error(e);
        toast.error("Failed to load gallery");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleClone(row: CloudTripRow) {
    const it = rowToItinerary(row);
    const cloned = { ...it, id: makeId(), title: `${it.title} (copy)`, createdAt: Date.now(), updatedAt: Date.now() };
    addItinerary(cloned as any);
    if (user) {
      try {
        await pushTrip(cloned as any, user.id);
      } catch (e) {
        console.warn(e);
      }
    }
    toast.success(t("galleryCloned"));
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <Toaster richColors position="top-right" />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold">
            <ArrowLeft className="h-4 w-4" />
            <Compass className="h-5 w-5 text-primary" />
            Trip.Planner
          </Link>
          <div className="flex items-center gap-2">
            <LangSwitch />
            <AuthButton />
          </div>
        </header>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">{t("galleryTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("gallerySubtitle")}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : trips.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-muted-foreground">{t("galleryEmpty")}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trips.map((row) => (
              <Card key={row.id} className="p-4 hover:shadow-md transition-shadow flex flex-col">
                {row.cover_image && (
                  <img
                    src={row.cover_image}
                    alt={row.title}
                    className="w-full h-32 object-cover rounded-md mb-3"
                  />
                )}
                <h3 className="font-semibold text-base line-clamp-2">{row.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {row.destination}
                  <span className="mx-1">·</span>
                  <Calendar className="h-3 w-3" />
                  {row.duration_days} {t("days")}
                </p>
                <div className="mt-auto pt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleClone(row)}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    {t("galleryClone")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
