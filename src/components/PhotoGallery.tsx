import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useT, useLangStore } from "@/lib/i18n";
import {
  listTripPhotos,
  publicUrlFor,
  uploadTripPhoto,
  updatePhotoCaption,
  deleteTripPhoto,
  type TripPhoto,
} from "@/lib/photos";
import { pushTrip } from "@/lib/cloud-sync";
import { useServerFn } from "@tanstack/react-start";
import { captionPhoto } from "@/server/discover.functions";
import type { Itinerary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ImagePlus, Loader2, Trash2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  itinerary: Itinerary;
  dayIndex: number | null; // null = trip-level
  compact?: boolean;
}

export default function PhotoGallery({ itinerary, dayIndex, compact }: Props) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const { user } = useAuth();
  const captionFn = useServerFn(captionPhoto);
  const [cloudId, setCloudId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<TripPhoto | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await pushTrip(itinerary, user.id);
        if (cancelled) return;
        setCloudId(row.id);
        const all = await listTripPhotos(row.id);
        if (cancelled) return;
        const filtered =
          dayIndex === null
            ? all.filter((p) => p.day_index === null)
            : all.filter((p) => p.day_index === dayIndex);
        setPhotos(filtered);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, itinerary.id, dayIndex]);

  if (!user) {
    if (compact) return null;
    return (
      <p className="text-xs text-muted-foreground italic">{t("photosSignInHint")}</p>
    );
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !cloudId || !user) return;
    setBusy(true);
    try {
      const photo = await uploadTripPhoto({
        cloudTripId: cloudId,
        ownerId: user.id,
        dayIndex,
        file,
      });
      setPhotos((ps) => [photo, ...ps]);
      // AI caption (non-blocking errors)
      try {
        const url = publicUrlFor(photo.storage_path);
        const ctx =
          dayIndex !== null
            ? `${itinerary.destination}, day ${itinerary.days[dayIndex]?.day}${itinerary.days[dayIndex]?.title ? ` (${itinerary.days[dayIndex]?.title})` : ""}`
            : itinerary.destination;
        const res = await captionFn({ data: { imageUrl: url, context: ctx, lang } });
        if (res.caption) {
          await updatePhotoCaption(photo.id, res.caption);
          setPhotos((ps) =>
            ps.map((p) => (p.id === photo.id ? { ...p, caption: res.caption } : p)),
          );
        }
      } catch (err) {
        console.warn("caption failed", err);
      }
    } catch (e: any) {
      toast.error(e?.message || t("photosUploadError"));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(p: TripPhoto) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await deleteTripPhoto(p);
      setPhotos((ps) => ps.filter((x) => x.id !== p.id));
    } catch (e: any) {
      toast.error(e?.message || t("photosDeleteError"));
    }
  }

  async function onEditCaption(p: TripPhoto) {
    const next = prompt(t("photosCaption"), p.caption ?? "");
    if (next === null) return;
    try {
      await updatePhotoCaption(p.id, next);
      setPhotos((ps) => ps.map((x) => (x.id === p.id ? { ...x, caption: next } : x)));
    } catch (e: any) {
      toast.error(e?.message);
    }
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <label
          className={`shrink-0 ${compact ? "h-20 w-20" : "h-24 w-24"} rounded-md border-2 border-dashed border-border/60 flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-colors`}
          title={t("photosAdd")}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-5 w-5 mb-0.5" />
              <span className="text-[10px]">{t("photosAdd")}</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={onPick}
          />
        </label>
        {photos.map((p) => {
          const url = publicUrlFor(p.storage_path);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setLightbox(p)}
              className={`group relative shrink-0 ${compact ? "h-20 w-20" : "h-24 w-24"} rounded-md overflow-hidden border bg-muted`}
              title={p.caption ?? ""}
            >
              <img src={url} alt={p.caption ?? "photo"} className="h-full w-full object-cover" loading="lazy" />
              {p.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-[10px] text-white p-1 line-clamp-2 text-left">
                  {p.caption}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {lightbox && (
            <div className="relative bg-black">
              <button
                onClick={() => setLightbox(null)}
                className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X className="h-4 w-4" />
              </button>
              <img
                src={publicUrlFor(lightbox.storage_path)}
                alt={lightbox.caption ?? ""}
                className="w-full max-h-[70vh] object-contain"
              />
              <div className="p-4 bg-card text-card-foreground space-y-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm flex-1">
                    {lightbox.caption || <span className="italic text-muted-foreground">{t("photosNoCaption")}</span>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEditCaption(lightbox)}>
                    {t("photosEditCaption")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      const p = lightbox;
                      setLightbox(null);
                      onDelete(p);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t("delete")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
