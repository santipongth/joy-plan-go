import { useState } from "react";
import type { MealSuggestion } from "@/server/discover.functions";
import type { MealType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { Star, MapPin, Clock, ExternalLink, Check, Navigation } from "lucide-react";
import { haversineMeters } from "@/lib/route-utils";

const CUISINE_EMOJI: Record<string, string> = {
  thai: "🍜",
  japanese: "🍱",
  chinese: "🥟",
  korean: "🍲",
  italian: "🍝",
  pizza: "🍕",
  burger: "🍔",
  cafe: "☕",
  coffee: "☕",
  dessert: "🍰",
  street: "🍢",
  seafood: "🦐",
  vegetarian: "🥗",
  indian: "🍛",
  mexican: "🌮",
  bbq: "🍖",
  bakery: "🥐",
};

function cuisineEmoji(cuisine?: string): string {
  if (!cuisine) return "🍽️";
  const k = cuisine.toLowerCase();
  for (const key of Object.keys(CUISINE_EMOJI)) {
    if (k.includes(key)) return CUISINE_EMOJI[key];
  }
  return "🍽️";
}

function unsplashUrl(cuisine?: string): string {
  const q = encodeURIComponent(`${cuisine || "food"},restaurant`);
  return `https://source.unsplash.com/featured/400x250/?${q}`;
}

function mapsUrl(lat: number, lng: number, name: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${encodeURIComponent(name)}`;
}

export default function MealCard({
  meal,
  selected,
  onToggleSelect,
  onAdd,
  compact = false,
  referencePoint,
  referenceLabel,
}: {
  meal: MealSuggestion;
  selected?: boolean;
  onToggleSelect?: () => void;
  onAdd?: () => void;
  compact?: boolean;
  /** Optional reference point (e.g. lodging or day anchor) for distance + mini-map */
  referencePoint?: { lat: number; lng: number; name?: string } | null;
  /** Localized label like "from lodging" or "from day start" */
  referenceLabel?: string;
}) {
  const t = useT();
  const [imgErr, setImgErr] = useState(false);
  const emoji = cuisineEmoji(meal.cuisine);

  const mealTypeLabel: Record<MealType, string> = {
    breakfast: t("mealTypeBreakfast"),
    lunch: t("mealTypeLunch"),
    dinner: t("mealTypeDinner"),
    snack: t("mealTypeSnack"),
  };

  // Distance from reference point (km)
  const distanceKm =
    referencePoint && Number.isFinite(referencePoint.lat) && Number.isFinite(referencePoint.lng)
      ? haversineMeters(
          { lat: referencePoint.lat, lng: referencePoint.lng },
          { lat: meal.lat, lng: meal.lng },
        ) / 1000
      : null;

  return (
    <div
      className={`group relative rounded-xl border overflow-hidden bg-card text-card-foreground transition-all ${
        selected ? "border-primary ring-2 ring-primary/30 shadow-md" : "hover:border-primary/40"
      }`}
    >
      {/* Cover */}
      <div className={`relative ${compact ? "h-20" : "h-32"} bg-muted overflow-hidden`}>
        {!imgErr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={unsplashUrl(meal.cuisine)}
            alt={meal.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 via-amber-500/10 to-orange-500/10 text-4xl">
            {emoji}
          </div>
        )}
        {meal.mealType && (
          <Badge
            variant="secondary"
            className="absolute top-1.5 left-1.5 text-[10px] backdrop-blur bg-background/80"
          >
            {mealTypeLabel[meal.mealType] ?? meal.mealType}
          </Badge>
        )}
        {meal.priceRange && (
          <Badge
            variant="secondary"
            className="absolute top-1.5 right-1.5 text-[10px] font-mono backdrop-blur bg-background/80"
          >
            {meal.priceRange}
          </Badge>
        )}
        {onToggleSelect && (
          <button
            type="button"
            onClick={onToggleSelect}
            className={`absolute bottom-1.5 right-1.5 h-7 w-7 rounded-full flex items-center justify-center transition ${
              selected
                ? "bg-primary text-primary-foreground"
                : "bg-background/90 text-foreground hover:bg-background"
            }`}
            aria-label={selected ? t("mealClearSelection") : t("mealSelectAll")}
          >
            {selected ? <Check className="h-4 w-4" /> : <span className="block h-3 w-3 rounded-full border-2 border-current" />}
          </button>
        )}
        {distanceKm !== null && (
          <Badge
            variant="secondary"
            className="absolute bottom-1.5 left-1.5 text-[10px] font-mono backdrop-blur bg-background/80 inline-flex items-center gap-1"
            title={referenceLabel ? `${distanceKm.toFixed(2)} km ${referenceLabel}` : undefined}
          >
            <Navigation className="h-2.5 w-2.5" />
            {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
          </Badge>
        )}
      </div>

      {/* Body */}
      <div className="p-3 space-y-1.5 min-w-0">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <h4 className="font-semibold text-sm leading-tight break-words flex-1 min-w-0">
            {meal.name}
          </h4>
          {typeof meal.rating === "number" && (
            <span className="inline-flex items-center gap-0.5 text-amber-500 text-xs flex-shrink-0">
              <Star className="h-3 w-3 fill-current" />
              {meal.rating.toFixed(1)}
            </span>
          )}
        </div>

        {meal.cuisine && (
          <div className="flex items-center flex-wrap gap-1">
            <Badge variant="outline" className="text-[10px] capitalize">
              {emoji} {meal.cuisine}
            </Badge>
            {meal.time && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {meal.time}
              </span>
            )}
          </div>
        )}

        {!compact && meal.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{meal.description}</p>
        )}

        {!compact && referencePoint && distanceKm !== null && (
          <MiniMapPreview
            from={{ lat: referencePoint.lat, lng: referencePoint.lng, label: referencePoint.name }}
            to={{ lat: meal.lat, lng: meal.lng, label: meal.name }}
            distanceKm={distanceKm}
            referenceLabel={referenceLabel}
          />
        )}

        {meal.nearestPlaceName && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {t("mealNearPlace")} {meal.nearestPlaceName}
              {typeof meal.distanceFromNearestKm === "number" &&
                ` • ${meal.distanceFromNearestKm.toFixed(1)} km`}
            </span>
          </p>
        )}

        {meal.openHours && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{meal.openHours}</span>
          </p>
        )}

        <div className="flex items-center gap-1 pt-1">
          <a
            href={mapsUrl(meal.lat, meal.lng, meal.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md border bg-background text-[11px] hover:bg-muted"
            title={t("lodgingViewMap")}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
          {onAdd && (
            <Button size="sm" variant="default" className="h-7 px-2 text-[11px] flex-1" onClick={onAdd}>
              {t("mealApplyAdd").replace("{n}", "1")}
            </Button>
          )}
          {onToggleSelect && !onAdd && (
            <label className="ml-auto flex items-center gap-1.5 text-[11px] cursor-pointer">
              <Checkbox checked={!!selected} onCheckedChange={() => onToggleSelect()} />
              {t("mealSelect")}
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Lightweight inline-SVG mini-map showing the relative position of two points
 * (reference vs. meal). Zero network — uses simple equirectangular projection.
 */
function MiniMapPreview({
  from,
  to,
  distanceKm,
  referenceLabel,
}: {
  from: { lat: number; lng: number; label?: string };
  to: { lat: number; lng: number; label?: string };
  distanceKm: number;
  referenceLabel?: string;
}) {
  const W = 100;
  const H = 60;
  const PAD = 12;
  const cosLat = Math.cos(((from.lat + to.lat) / 2) * (Math.PI / 180));
  const dx = (to.lng - from.lng) * cosLat;
  const dy = -(to.lat - from.lat);
  const span = Math.max(Math.abs(dx), Math.abs(dy)) || 0.0001;
  const scale = (Math.min(W, H) - PAD * 2) / (span * 2);
  const fx = W / 2 - (dx / 2) * scale;
  const fy = H / 2 - (dy / 2) * scale;
  const tx = W / 2 + (dx / 2) * scale;
  const ty = H / 2 + (dy / 2) * scale;

  return (
    <div className="rounded-md border bg-muted/30 overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-14 block"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Mini map: ${distanceKm.toFixed(2)} km ${referenceLabel ?? ""}`}
      >
        <defs>
          <pattern id="mini-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#mini-grid)" className="text-foreground" />
        <line
          x1={fx}
          y1={fy}
          x2={tx}
          y2={ty}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 2"
          className="text-primary/60"
        />
        <circle cx={fx} cy={fy} r="3.2" className="fill-muted-foreground" />
        <circle cx={fx} cy={fy} r="1.2" className="fill-background" />
        <circle cx={tx} cy={ty} r="3.8" className="fill-primary" />
        <circle cx={tx} cy={ty} r="1.4" className="fill-background" />
      </svg>
      <div className="px-2 py-1 text-[10px] text-muted-foreground flex items-center justify-between gap-2">
        <span className="truncate">{from.label ? `📍 ${from.label}` : "📍"}</span>
        <span className="font-mono whitespace-nowrap">
          {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(2)} km`}
        </span>
      </div>
    </div>
  );
}

export { cuisineEmoji, unsplashUrl, mapsUrl };
