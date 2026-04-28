import type { Itinerary } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { BedDouble, MapPin, Star } from "lucide-react";

export default function DayLodgingPanel({
  itinerary,
  dayIdx,
  onFocusLodging,
}: {
  itinerary: Itinerary;
  dayIdx: number;
  onFocusLodging: (lodgingId: string) => void;
}) {
  const t = useT();
  const lodgings = (itinerary.lodgings ?? []).filter((l) =>
    (l.dayIndexes ?? []).includes(dayIdx),
  );

  if (lodgings.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <BedDouble className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("lodgingDayHeading")}
        </span>
      </div>
      <ul className="space-y-1.5">
        {lodgings.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => onFocusLodging(l.id)}
              title={t("lodgingFocusOnMap")}
              className="w-full text-left rounded-md border bg-background hover:bg-muted/60 transition-colors p-2 flex items-center gap-2 text-xs"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                <BedDouble className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium truncate">{l.name}</span>
                  {typeof l.rating === "number" && (
                    <span className="inline-flex items-center gap-0.5 text-amber-500">
                      <Star className="h-3 w-3 fill-current" />
                      {l.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                {l.address && (
                  <p className="text-[11px] text-muted-foreground truncate">{l.address}</p>
                )}
              </div>
              <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
