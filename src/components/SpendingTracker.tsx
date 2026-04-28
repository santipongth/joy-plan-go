import { useMemo, useState } from "react";
import { useItineraryStore, makeId } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Wallet, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Itinerary, ExpenseCategory } from "@/lib/types";

const CATEGORIES: ExpenseCategory[] = [
  "food",
  "transport",
  "lodging",
  "attraction",
  "shopping",
  "other",
];

const CATEGORY_KEY: Record<ExpenseCategory, string> = {
  food: "expFood",
  transport: "expTransport",
  lodging: "expLodging",
  attraction: "expAttraction",
  shopping: "expShopping",
  other: "expOther",
};

export default function SpendingTracker({ itinerary }: { itinerary: Itinerary }) {
  const t = useT();
  const addExpense = useItineraryStore((s) => s.addExpense);
  const removeExpense = useItineraryStore((s) => s.removeExpense);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [dayIdx, setDayIdx] = useState<string>("trip");
  const [note, setNote] = useState("");

  const expenses = itinerary.expenses ?? [];

  const totals = useMemo(() => {
    const byCat: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    let total = 0;
    for (const e of expenses) {
      byCat[e.category] = (byCat[e.category] ?? 0) + e.amount;
      const dk = e.dayIndex == null ? "trip" : String(e.dayIndex);
      byDay[dk] = (byDay[dk] ?? 0) + e.amount;
      total += e.amount;
    }
    return { byCat, byDay, total };
  }, [expenses]);

  const currency = "USD";
  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);

  function add() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    addExpense(itinerary.id, {
      id: makeId(),
      amount: n,
      category,
      currency,
      dayIndex: dayIdx === "trip" ? undefined : Number(dayIdx),
      note: note.trim() || undefined,
      createdAt: Date.now(),
    });
    setAmount("");
    setNote("");
  }

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">{t("spendingTracker")}</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {t("totalSpent")}: <span className="font-semibold tabular-nums">{fmt(totals.total)}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        <Input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t("amount")}
          className="col-span-1"
        />
        <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
          <SelectTrigger className="col-span-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(CATEGORY_KEY[c] as any)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dayIdx} onValueChange={setDayIdx}>
          <SelectTrigger className="col-span-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trip">{t("tripLevel")}</SelectItem>
            {itinerary.days.map((d, idx) => (
              <SelectItem key={idx} value={String(idx)}>
                {t("forDay")} {d.day}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("note")}
          className="col-span-2 sm:col-span-1"
        />
        <Button onClick={add} size="sm" className="col-span-2 sm:col-span-1">
          <Plus className="h-4 w-4 mr-1" />
          {t("addExpense")}
        </Button>
      </div>

      {expenses.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{t("noExpenses")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-md border p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                {t("spendByCategory")}
              </div>
              <ul className="text-xs space-y-0.5">
                {CATEGORIES.filter((c) => totals.byCat[c]).map((c) => (
                  <li key={c} className="flex justify-between">
                    <span>{t(CATEGORY_KEY[c] as any)}</span>
                    <span className="tabular-nums">{fmt(totals.byCat[c])}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                {t("spendByDay")}
              </div>
              <ul className="text-xs space-y-0.5">
                {totals.byDay["trip"] != null && (
                  <li className="flex justify-between">
                    <span>{t("tripLevel")}</span>
                    <span className="tabular-nums">{fmt(totals.byDay["trip"])}</span>
                  </li>
                )}
                {itinerary.days.map(
                  (d, idx) =>
                    totals.byDay[String(idx)] != null && (
                      <li key={idx} className="flex justify-between">
                        <span>
                          {t("day")} {d.day}
                        </span>
                        <span className="tabular-nums">
                          {fmt(totals.byDay[String(idx)])}
                        </span>
                      </li>
                    )
                )}
              </ul>
            </div>
          </div>
          <div className="space-y-1 max-h-64 overflow-auto">
            {expenses
              .slice()
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-2 text-xs rounded-md hover:bg-muted/50 px-2 py-1.5"
                >
                  <span className="tabular-nums font-semibold w-20">{fmt(e.amount)}</span>
                  <span className="text-[10px] uppercase tracking-wide bg-muted px-1.5 py-0.5 rounded">
                    {t(CATEGORY_KEY[e.category] as any)}
                  </span>
                  <span className="text-muted-foreground">
                    {e.dayIndex == null
                      ? t("tripLevel")
                      : `${t("day")} ${itinerary.days[e.dayIndex]?.day ?? e.dayIndex + 1}`}
                  </span>
                  {e.note && (
                    <span className="text-muted-foreground truncate flex-1">— {e.note}</span>
                  )}
                  <button
                    onClick={() => removeExpense(itinerary.id, e.id)}
                    className="text-muted-foreground hover:text-destructive ml-auto"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
          </div>
        </>
      )}
    </Card>
  );
}
