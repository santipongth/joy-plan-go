import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Shirt, HandCoins, Languages, Clock, Sparkle, HeartHandshake, ShieldAlert, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getLocalTips } from "@/server/discover.functions";
import { useItineraryStore } from "@/lib/store";
import { useT, useLangStore } from "@/lib/i18n";
import { toast } from "sonner";
import type { Itinerary } from "@/lib/types";

export default function LocalTipsCard({ itinerary }: { itinerary: Itinerary }) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const update = useItineraryStore((s) => s.update);
  const fn = useServerFn(getLocalTips);
  const [loading, setLoading] = useState(false);

  const tips = itinerary.localTips;
  const stale = !!tips && tips.lang !== lang;

  async function load() {
    setLoading(true);
    try {
      const res = await fn({
        data: {
          destination: itinerary.destination,
          startDate: itinerary.startDate,
          durationDays: itinerary.durationDays,
          lang,
        },
      });
      if (res.error) {
        if (res.error === "RATE_LIMIT") toast.error(t("aiRateLimit"));
        else if (res.error === "PAYMENT_REQUIRED") toast.error(t("aiPaymentRequired"));
        else toast.error(t("aiError"));
        return;
      }
      update(itinerary.id, {
        localTips: {
          generatedAt: Date.now(),
          lang,
          dressCode: res.dressCode,
          tipping: res.tipping,
          language: res.language,
          hours: res.hours,
          festivals: res.festivals,
          etiquette: res.etiquette,
          safety: res.safety,
        },
      });
    } finally {
      setLoading(false);
    }
  }

  const rows: { icon: any; label: string; value?: string }[] = tips
    ? [
        { icon: Shirt, label: t("tipsDressCode"), value: tips.dressCode },
        { icon: HandCoins, label: t("tipsTipping"), value: tips.tipping },
        { icon: Languages, label: t("tipsLanguage"), value: tips.language },
        { icon: Clock, label: t("tipsHours"), value: tips.hours },
        { icon: Sparkle, label: t("tipsFestivals"), value: tips.festivals },
        { icon: HeartHandshake, label: t("tipsEtiquette"), value: tips.etiquette },
        { icon: ShieldAlert, label: t("tipsSafety"), value: tips.safety },
      ]
    : [];

  return (
    <Card className="p-4 print:hidden">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold text-sm inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("localTipsTitle")}
        </h3>
        {tips && (
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            disabled={loading}
            className="h-7 text-xs"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
      {!tips ? (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-3">{t("localTipsEmpty")}</p>
          <Button onClick={load} disabled={loading} size="sm">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            {t("localTipsGenerate")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {stale && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              {t("localTipsStaleLang")}
            </p>
          )}
          {rows
            .filter((r) => r.value)
            .map((r) => {
              const Ico = r.icon;
              return (
                <div key={r.label} className="flex items-start gap-2">
                  <Ico className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
                  <div className="text-xs">
                    <span className="font-medium">{r.label}: </span>
                    <span className="text-muted-foreground">{r.value}</span>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </Card>
  );
}
