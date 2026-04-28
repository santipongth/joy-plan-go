import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogIn, LogOut, User as UserIcon, Cloud, CloudOff, Loader2 } from "lucide-react";
import { useAuth, signOut } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { useEffect } from "react";
import { useItineraryStore } from "@/lib/store";
import { fetchMyTrips, pushTrip, rowToItinerary } from "@/lib/cloud-sync";
import { toast } from "sonner";

export default function AuthButton() {
  const t = useT();
  const { user, loading } = useAuth();
  const itineraries = useItineraryStore((s) => s.itineraries);
  const setAll = (its: any[]) => useItineraryStore.setState({ itineraries: its });

  // First-login sync: push local-only trips, then merge cloud trips into store.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const local = useItineraryStore.getState().itineraries;
        // Push every local trip to cloud (upsert by client_id)
        for (const it of local) {
          try {
            await pushTrip(it, user.id);
          } catch (e) {
            console.warn("push failed", it.id, e);
          }
        }
        const { owned, shared } = await fetchMyTrips(user.id);
        if (cancelled) return;
        const cloudIts = [...owned, ...shared].map(rowToItinerary);
        // Merge: cloud version wins by updatedAt
        const byId = new Map<string, any>();
        for (const it of local) byId.set(it.id, it);
        for (const it of cloudIts) {
          const existing = byId.get(it.id);
          if (!existing || it.updatedAt > existing.updatedAt) byId.set(it.id, it);
        }
        setAll(Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt));
      } catch (e: any) {
        console.error("sync failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Auto-push on local changes when signed in
  useEffect(() => {
    if (!user) return;
    const unsub = useItineraryStore.subscribe((state, prev) => {
      const prevMap = new Map(prev.itineraries.map((i) => [i.id, i.updatedAt]));
      for (const it of state.itineraries) {
        const prevTs = prevMap.get(it.id);
        if (prevTs !== undefined && prevTs === it.updatedAt) continue;
        pushTrip(it, user.id).catch((e) => console.warn("auto-push failed", e));
      }
    });
    return () => unsub();
  }, [user?.id]);

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (!user) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link to="/auth" search={{ redirect: typeof window !== "undefined" ? window.location.pathname : "/" }}>
          <LogIn className="h-4 w-4 mr-1.5" />
          {t("authSignIn")}
        </Link>
      </Button>
    );
  }

  const label =
    (user.user_metadata?.display_name as string) || user.email?.split("@")[0] || "User";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center text-[11px] font-semibold">
            {label.charAt(0).toUpperCase()}
          </span>
          <span className="hidden sm:inline text-sm">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{label}</span>
            <span className="text-[11px] text-muted-foreground truncate">{user.email}</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 mt-0.5">
              <Cloud className="h-3 w-3" />
              {t("authSyncOn")}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/gallery">
            <UserIcon className="h-4 w-4 mr-2" />
            {t("galleryTitle")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            toast.success(t("authSignedOut"));
          }}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {t("authSignOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
