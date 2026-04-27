import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Train,
  Mountain,
  BedDouble,
  Minus,
  Plus,
  Wallet,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  estimateBudget,
  formatMoney,
  PAID_ATTRACTION_TYPES,
  CURRENCIES,
  MIN_TRAVELERS,
  MAX_TRAVELERS,
} from "@/lib/budget";
import type { Itinerary, BudgetTier } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useCurrencyStore, type CurrencyCode } from "@/lib/currency-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import BudgetByDayChart from "./BudgetByDayChart";

interface Props {
  itinerary: Itinerary;
  onTravelersChange: (n: number) => void;
  onTierChange: (tier: BudgetTier) => void;
}

const TIERS: BudgetTier[] = ["low", "medium", "high"];
const CURRENCY_CODES: CurrencyCode[] = ["USD", "THB", "EUR", "JPY", "GBP"];

export default function BudgetEstimate({
  itinerary,
  onTravelersChange,
  onTierChange,
}: Props) {
  const t = useT();
  const travelers = clampTravelers(itinerary.travelers ?? 1);
  const tier: BudgetTier = itinerary.budget ?? "medium";
  const currency = useCurrencyStore((s) => s.currency);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);

  const [travelersInput, setTravelersInput] = useState(String(travelers));
  useEffect(() => {
    setTravelersInput(String(travelers));
  }, [travelers]);

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

  const paidTypesList = useMemo(
    () => Array.from(PAID_ATTRACTION_TYPES).sort().join(", "),
    [],
  );

  const commitTravelers = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || raw.trim() === "") {
      setTravelersInput(String(travelers));
      return;
    }
    const rounded = Math.round(n);
    const clamped = clampTravelers(rounded);
    if (clamped !== rounded) {
      toast.warning(
        t("travelersClamped")
          .replace("{min}", String(MIN_TRAVELERS))
          .replace("{max}", String(MAX_TRAVELERS)),
      );
    }
    setTravelersInput(String(clamped));
    if (clamped !== travelers) onTravelersChange(clamped);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="mb-6 p-4 sm:p-5 border bg-card">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            {t("coreBudgetEstimate")}
          </h3>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{t("currency")}:</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="h-7 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={t("currency")}
              >
                {CURRENCY_CODES.map((c) => (
                  <option key={c} value={c}>
                    {CURRENCIES[c].symbol} {c}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {t("estimateBadge")}
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mb-4">{intro}</p>

        {/* Tier selector + travelers stepper */}
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
              onClick={() => commitTravelers(String(travelers - 1))}
              aria-label="-"
              disabled={travelers <= MIN_TRAVELERS}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_TRAVELERS}
              max={MAX_TRAVELERS}
              value={travelersInput}
              onChange={(e) => setTravelersInput(e.target.value)}
              onBlur={(e) => commitTravelers(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
              }}
              aria-label={t("travelersLabel")}
              className="w-10 h-7 text-center text-sm tabular-nums font-medium rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => commitTravelers(String(travelers + 1))}
              aria-label="+"
              disabled={travelers >= MAX_TRAVELERS}
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
            <div className="font-bold tabular-nums">
              ≈ {formatMoney(breakdown.total, currency)}
            </div>
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
              currency={currency}
            />
            <BudgetRow
              icon={<Mountain className="h-4 w-4 text-primary" />}
              label={t("attractions")}
              value={breakdown.attractions}
              currency={currency}
              extra={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={t("paidAttractionsInfoTitle")}
                      className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                    <div className="font-semibold mb-1">
                      {t("paidAttractionsInfoTitle")}
                    </div>
                    <div>
                      {t("paidAttractionsInfoBody").replace("{types}", paidTypesList)}
                    </div>
                  </TooltipContent>
                </Tooltip>
              }
            />
            <BudgetRow
              icon={<BedDouble className="h-4 w-4 text-primary" />}
              label={t("stay")}
              value={breakdown.stay}
              currency={currency}
            />
          </ul>

          <details className="mt-3 group" open>
            <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 select-none">
              <span className="transition-transform group-open:rotate-90">▸</span>
              {t("perDayBreakdown")}
            </summary>
            <BudgetByDayChart
              itinerary={itinerary}
              travelers={travelers}
              tier={tier}
              currency={currency}
            />
          </details>
        </div>
      </Card>
    </TooltipProvider>
  );
}

function BudgetRow({
  icon,
  label,
  value,
  currency,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  currency: CurrencyCode;
  extra?: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-foreground/90">
        {icon}
        <span className="font-medium">{label}</span>
        {extra}
      </span>
      <span className="tabular-nums text-muted-foreground">
        {formatMoney(value, currency)}
      </span>
    </li>
  );
}

function clampTravelers(n: number): number {
  if (!Number.isFinite(n)) return MIN_TRAVELERS;
  return Math.min(MAX_TRAVELERS, Math.max(MIN_TRAVELERS, Math.round(n)));
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
