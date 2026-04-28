import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { Sparkles, Utensils } from "lucide-react";

export default function MealEmptyBanner({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 p-2.5">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex-shrink-0">
        <Utensils className="h-4 w-4" />
      </span>
      <p className="text-xs text-amber-900 dark:text-amber-100 flex-1 min-w-0">
        {t("mealEmptyBanner")}
      </p>
      <Button size="sm" variant="outline" className="h-7 text-xs flex-shrink-0" onClick={onClick}>
        <Sparkles className="h-3 w-3 mr-1" />
        {t("mealEmptyAction")}
      </Button>
    </div>
  );
}
