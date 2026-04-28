import type { Place, MealType } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { Utensils } from "lucide-react";

const WINDOWS: Record<Exclude<MealType, "snack">, { startMin: number; endMin: number }> = {
  breakfast: { startMin: 7 * 60, endMin: 9 * 60 + 30 },
  lunch: { startMin: 11 * 60, endMin: 14 * 60 },
  dinner: { startMin: 17 * 60 + 30, endMin: 20 * 60 + 30 },
};

function timeToMin(time?: string): number | null {
  if (!time) return null;
  const m = time.match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(mm)) return null;
  return h * 60 + mm;
}

/**
 * Returns which meal types are uncovered by current places (only meal-kind places count).
 * Skips breakfast unless trip has multiple days (passed via showBreakfast).
 */
export function detectMissingMealSlots(
  places: Place[],
  showBreakfast = false,
): Exclude<MealType, "snack">[] {
  const meals = places.filter((p) => p.kind === "meal");
  const missing: Exclude<MealType, "snack">[] = [];
  const slots: Exclude<MealType, "snack">[] = showBreakfast
    ? ["breakfast", "lunch", "dinner"]
    : ["lunch", "dinner"];
  for (const slot of slots) {
    const w = WINDOWS[slot];
    const covered = meals.some((p) => {
      const tm = timeToMin(p.time);
      if (tm === null) return p.mealType === slot;
      return tm >= w.startMin && tm <= w.endMin;
    });
    if (!covered) missing.push(slot);
  }
  return missing;
}

export default function MealSlotInline({
  mealType,
  onClick,
}: {
  mealType: Exclude<MealType, "snack">;
  onClick: () => void;
}) {
  const t = useT();
  const labelKey =
    mealType === "breakfast"
      ? "mealSlotEmptyBreakfast"
      : mealType === "lunch"
        ? "mealSlotEmptyLunch"
        : "mealSlotEmptyDinner";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 hover:bg-muted/40 hover:border-primary/50 px-3 py-2.5 text-xs text-muted-foreground transition-colors"
    >
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex-shrink-0">
        <Utensils className="h-3.5 w-3.5" />
      </span>
      <span className="text-left flex-1 truncate">{t(labelKey as any)}</span>
    </button>
  );
}
