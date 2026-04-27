import { useLangStore, type Lang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function LangSwitch() {
  const { lang, setLang } = useLangStore();
  const opts: Lang[] = ["th", "en"];
  return (
    <div className="inline-flex rounded-md border bg-card p-0.5">
      {opts.map((o) => (
        <Button
          key={o}
          size="sm"
          variant={lang === o ? "default" : "ghost"}
          className="h-7 px-3 text-xs uppercase"
          onClick={() => setLang(o)}
        >
          {o}
        </Button>
      ))}
    </div>
  );
}
