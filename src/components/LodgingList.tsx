import { useItineraryStore } from "@/lib/store";
import type { Itinerary } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BedDouble, ExternalLink, Star, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function LodgingList({ itinerary }: { itinerary: Itinerary }) {
  const t = useT();
  const removeLodging = useItineraryStore((s) => s.removeLodging);
  const setLodgingDays = useItineraryStore((s) => s.setLodgingDays);
  const lodgings = itinerary.lodgings ?? [];

  if (lodgings.length === 0) return null;

  return (
    <section className="mb-6 rounded-lg border bg-card/60 p-3">
      <div className="flex items-center gap-2 mb-2">
        <BedDouble className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{t("lodgingTitle")}</h3>
        <span className="text-xs text-muted-foreground">({lodgings.length})</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {lodgings.map((l) => {
          const dayIdxs = l.dayIndexes ?? [];
          return (
            <div key={l.id} className="rounded-md border bg-background p-2.5 text-xs space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm truncate">{l.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {t(`lodgingType_${l.type}` as any)}
                    </Badge>
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
                  {typeof l.pricePerNight === "number" && (
                    <p className="text-[11px] font-medium mt-0.5">
                      {l.pricePerNight.toLocaleString()} {l.currency || ""}
                      <span className="text-muted-foreground font-normal">
                        {t("lodgingPriceNight")}
                      </span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeLodging(itinerary.id, l.id)}
                  className="text-muted-foreground hover:text-destructive p-1"
                  aria-label={t("lodgingRemove")}
                  title={t("lodgingRemove")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                      {t("lodgingApplyToDays")}
                      {dayIdxs.length > 0 && (
                        <span className="ml-1 text-muted-foreground">({dayIdxs.length})</span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel className="text-xs">{t("days")}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {itinerary.days.map((d, idx) => {
                      const checked = dayIdxs.includes(idx);
                      return (
                        <DropdownMenuCheckboxItem
                          key={d.day}
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = v
                              ? Array.from(new Set([...dayIdxs, idx])).sort((a, b) => a - b)
                              : dayIdxs.filter((x) => x !== idx);
                            setLodgingDays(itinerary.id, l.id, next);
                          }}
                        >
                          {t("day")} {d.day}
                          {d.title ? ` — ${d.title}` : ""}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
                {l.bookingUrl && (
                  <a
                    href={l.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t("lodgingBookOn")}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
