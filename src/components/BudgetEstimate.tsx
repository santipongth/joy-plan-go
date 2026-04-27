import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Train, Mountain, BedDouble, Minus, Plus, Wallet } from "lucide-react";
import { estimateBudget, formatUSD } from "@/lib/budget";
import type { Itinerary, BudgetTier } from "@/lib/types";
import { useT } from "@/lib/i18n";

interface Props {
  itinerary: Itinerary;
  onTravelersChange: (n: number) => void;
  onTierChange: (tier: BudgetTier) => void;
}

const TIERS: BudgetTier[] = ["low", "medium", "high"];

export default function BudgetEstimate({ itinerary, onTravelersChange, onTierChange }: Props) {
  const t = useT();
  const travelers = Math.max(1, itinerary.travelers ?? 1);
  const tier: BudgetTier = itinerary.budget ?? "medium";

  const breakdown = useMemo(
    () => estimateBudget(itinerary, travelers, tier),
    [itinerary, travelers, tier],
  );

  const fillPct = Math.min(
    100,
    Math.max(4, Math.round((breakdown.total / breakdown.maxScale) * 100)),
  );

  const dateText = itinerary.startDate
    ? t("budgetIntroDeparting").replace("{date}", formatDate(itinerary.startDate))
    : "";

  const intro = t("budgetIntro")
    .replace("{n}", String(travelers))
    .replace("{d}", String(itinerary.durationDays))
    .replace("{date}", dateText);

  const travelerWord = travelers === 1 ? t("travelerSingular") : t("travelerPlural");

  return (
    <Card className="mb-6 p-4 sm:p-5 border bg-card">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          {t("coreBudgetEstimate")}
        </h3>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
          {t("estimateBadge")}
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed mb-4">{intro}</p>

      {/* Tier selector */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className="text-xs text-muted-foreground mr-1">{t("budget")}:</span>
        {TIERS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => onTierChange(b)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              tier === b
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {t(b)}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{t("travelersLabel")}:</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => onTravelersChange(Math.max(1, travelers - 1))}
            aria-label="-"
            disabled={travelers <= 1}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-6 text-center text-sm tabular-nums font-medium">{travelers}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => onTravelersChange(Math.min(20, travelers + 1))}
            aria-label="+"
            disabled={travelers >= 20}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </span>
      </div>

      <div className="rounded-lg border bg-background/60 p-3 sm:p-4">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-sm">
            <span className="font-semibold">{t("totalLabel")}</span>
            <span className="text-muted-foreground ml-1">
              ({travelers} {travelerWord})
            </span>
          </div>
          <div className="font-bold tabular-nums">≈ {formatUSD(breakdown.total)}</div>
        </div>

        <div
          className="h-2 w-full rounded-full bg-muted overflow-hidden mb-3"
          aria-label={`${Math.round(fillPct)}%`}
        >
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${fillPct}%` }}
          />
        </div>

        <ul className="space-y-1.5 text-sm">
          <BudgetRow
            icon={<Train className="h-4 w-4 text-primary" />}
            label={t("transportation")}
            value={breakdown.transportation}
          />
          <BudgetRow
            icon={<Mountain className="h-4 w-4 text-primary" />}
            label={t("attractions")}
            value={breakdown.attractions}
          />
          <BudgetRow
            icon={<BedDouble className="h-4 w-4 text-primary" />}
            label={t("stay")}
            value={breakdown.stay}
          />
        </ul>
      </div>
    </Card>
  );
}

function BudgetRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-foreground/90">
        {icon}
        <span className="font-medium">{label}</span>
      </span>
      <span className="tabular-nums text-muted-foreground">{formatUSD(value)}</span>
    </li>
  );
}

function formatDate(iso: string): string {
  // Accept "YYYY-MM-DD" or full ISO; produce "Apr 30" style.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
