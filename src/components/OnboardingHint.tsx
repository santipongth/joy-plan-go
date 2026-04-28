import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

const KEY = "trip-planner-onboarded-v1";

export default function OnboardingHint() {
  const t = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(KEY)) {
      const tm = setTimeout(() => setShow(true), 600);
      return () => clearTimeout(tm);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(KEY, "1");
    setShow(false);
  }

  if (!show) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-2">
      <div
        className="rounded-xl border border-border/50 bg-card p-4 shadow-2xl backdrop-blur"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-primary-foreground"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              {t("onboardingTitle")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("onboardingBody")}
            </p>
            <Button size="sm" className="mt-3" onClick={dismiss}>
              {t("onboardingDismiss")}
            </Button>
          </div>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
