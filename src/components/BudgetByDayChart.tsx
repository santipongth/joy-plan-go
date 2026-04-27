import { useMemo } from "react";
import { estimateBudgetByDay, formatMoney } from "@/lib/budget";
import type { Itinerary, BudgetTier } from "@/lib/types";
import type { CurrencyCode } from "@/lib/currency-store";
import { useT } from "@/lib/i18n";

interface Props {
  itinerary: Itinerary;
  travelers: number;
  tier: BudgetTier;
  currency: CurrencyCode;
}

export default function BudgetByDayChart({ itinerary, travelers, tier, currency }: Props) {
  const t = useT();
  const rows = useMemo(
    () => estimateBudgetByDay(itinerary, travelers, tier),
    [itinerary, travelers, tier],
  );

  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div className="mt-3">
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2 flex-wrap">
        <Legend swatch="bg-primary" label={t("stay")} />
        <Legend swatch="bg-emerald-500" label={t("attractions")} />
        <Legend swatch="bg-amber-500" label={t("transportation")} />
      </div>

      <ul className="space-y-2">
        {rows.map((r) => {
          const widthPct = Math.max(4, Math.round((r.total / maxTotal) * 100));
          const stayPct = r.total > 0 ? (r.stay / r.total) * 100 : 0;
          const attrPct = r.total > 0 ? (r.attractions / r.total) * 100 : 0;
          const trnPct = r.total > 0 ? (r.transportation / r.total) * 100 : 0;
          return (
            <li key={r.day} className="text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-foreground/80">
                  {t("day")} {r.day}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatMoney(r.total, currency)}
                </span>
              </div>
              <div
                className="h-2 rounded-full bg-muted overflow-hidden"
                style={{ width: `${widthPct}%` }}
                aria-label={`Day ${r.day} total ${formatMoney(r.total, currency)}`}
              >
                <div className="flex h-full w-full">
                  {stayPct > 0 && (
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${stayPct}%` }}
                      title={`${t("stay")}: ${formatMoney(r.stay, currency)}`}
                    />
                  )}
                  {attrPct > 0 && (
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${attrPct}%` }}
                      title={`${t("attractions")}: ${formatMoney(r.attractions, currency)}`}
                    />
                  )}
                  {trnPct > 0 && (
                    <div
                      className="h-full bg-amber-500"
                      style={{ width: `${trnPct}%` }}
                      title={`${t("transportation")}: ${formatMoney(r.transportation, currency)}`}
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}
