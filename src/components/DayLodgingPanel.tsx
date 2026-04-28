import type { Itinerary } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { BedDouble, MapPin, Star, Crosshair, Check } from "lucide-react";

export default function DayLodgingPanel({
  itinerary,
  dayIdx,
  onFocusLodging,
  selectedPlaceId,
}: {
  itinerary: Itinerary;
  dayIdx: number;
  onFocusLodging: (lodgingId: string) => void;
  selectedPlaceId?: string | null;
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
        {lodgings.map((l) => {
          const isSelected = selectedPlaceId === `lodging:${l.id}`;
          return (
            <li key={l.id}>
              <div
                className={`rounded-md border p-2 flex items-center gap-2 text-xs transition-colors ${
                  isSelected
                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700"
                    : "bg-background"
                }`}
              >
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 ${
                    isSelected
                      ? "bg-amber-500 text-white"
                      : "bg-primary/10 text-primary"
                  }`}
                >
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
                    {isSelected && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        <Check className="h-3 w-3" />
                        {t("lodgingSelected")}
                      </span>
                    )}
                  </div>
                  {l.address && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {l.address}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onFocusLodging(l.id)}
                  title={t("lodgingFocusOnMap")}
                  aria-label={t("lodgingFocusOnMap")}
                  className={`flex-shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                    isSelected
                      ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  <Crosshair className="h-3 w-3" />
                  <span className="hidden sm:inline">{t("lodgingFocusBtn")}</span>
                  <MapPin className="h-3 w-3 sm:hidden" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
