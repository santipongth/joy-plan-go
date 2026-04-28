import { useMemo, useState } from "react";
import { useItineraryStore, makeId } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Package, Eraser } from "lucide-react";
import type { Itinerary, PackingItem } from "@/lib/types";

export default function PackingChecklist({ itinerary }: { itinerary: Itinerary }) {
  const t = useT();
  const addItem = useItineraryStore((s) => s.addPackingItem);
  const updateItem = useItineraryStore((s) => s.updatePackingItem);
  const removeItem = useItineraryStore((s) => s.removePackingItem);
  const setPacking = useItineraryStore((s) => s.setPacking);

  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const items = itinerary.packing ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, PackingItem[]>();
    for (const it of items) {
      const k = it.category?.trim() || "—";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  const done = items.filter((i) => i.done).length;

  function add() {
    const trimmed = label.trim();
    if (!trimmed) return;
    addItem(itinerary.id, {
      id: makeId(),
      label: trimmed,
      category: category.trim() || undefined,
      done: false,
    });
    setLabel("");
  }

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">{t("packingChecklist")}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("packingProgress")
              .replace("{done}", String(done))
              .replace("{total}", String(items.length))}
          </span>
          {items.some((i) => i.done) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPacking(itinerary.id, items.filter((i) => !i.done))}
              title={t("clearChecked")}
            >
              <Eraser className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("itemPlaceholder")}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          className="flex-1"
        />
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder={t("categoryPlaceholder")}
          className="sm:w-44"
        />
        <Button onClick={add} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t("addItem")}
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{t("packingEmpty")}</p>
      ) : (
        <div className="space-y-3">
          {grouped.map(([cat, list]) => (
            <div key={cat}>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                {cat}
              </div>
              <div className="space-y-1">
                {list.map((it) => (
                  <label
                    key={it.id}
                    className="flex items-center gap-2 group rounded-md hover:bg-muted/50 px-2 py-1.5 min-h-[36px]"
                  >
                    <Checkbox
                      checked={!!it.done}
                      onCheckedChange={(v) =>
                        updateItem(itinerary.id, it.id, { done: !!v })
                      }
                    />
                    <span
                      className={
                        "flex-1 text-sm " +
                        (it.done ? "line-through text-muted-foreground" : "")
                      }
                    >
                      {it.label}
                    </span>
                    <button
                      onClick={() => removeItem(itinerary.id, it.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
