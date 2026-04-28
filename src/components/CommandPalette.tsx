import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useNavigate } from "@tanstack/react-router";
import {
  Home,
  Compass,
  Sun,
  Moon,
  Monitor,
  Languages,
  MapPin,
  Plus,
} from "lucide-react";
import { useThemeStore } from "@/lib/theme-store";
import { useLangStore, useT } from "@/lib/i18n";
import { useItineraryStore } from "@/lib/store";

export default function CommandPalette() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const setTheme = useThemeStore((s) => s.setTheme);
  const { lang, setLang } = useLangStore();
  const itineraries = useItineraryStore((s) => s.itineraries);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function run(fn: () => void) {
    setOpen(false);
    setTimeout(fn, 50);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t("cmdPlaceholder")} />
      <CommandList>
        <CommandEmpty>{t("cmdEmpty")}</CommandEmpty>
        <CommandGroup heading={t("cmdNav")}>
          <CommandItem onSelect={() => run(() => navigate({ to: "/" }))}>
            <Home /> {t("cmdHome")}
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/gallery" }))}>
            <Compass /> {t("galleryTitle")}
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/auth" }))}>
            <Plus /> {t("authSignIn")}
          </CommandItem>
        </CommandGroup>
        {itineraries.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("myItineraries")}>
              {itineraries.slice(0, 8).map((it) => (
                <CommandItem
                  key={it.id}
                  onSelect={() =>
                    run(() =>
                      navigate({ to: "/itinerary/$id", params: { id: it.id } }),
                    )
                  }
                >
                  <MapPin /> {it.title || t("untitled")}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        <CommandGroup heading={t("theme")}>
          <CommandItem onSelect={() => run(() => setTheme("light"))}>
            <Sun /> {t("themeLight")}
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("dark"))}>
            <Moon /> {t("themeDark")}
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("system"))}>
            <Monitor /> {t("themeSystem")}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("language")}>
          <CommandItem
            onSelect={() => run(() => setLang(lang === "th" ? "en" : "th"))}
          >
            <Languages /> {lang === "th" ? "English" : "ไทย"}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
