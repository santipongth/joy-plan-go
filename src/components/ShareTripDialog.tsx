import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Share2, Copy, Trash2, Loader2, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";
import {
  fetchTripByCloudId,
  updateTripMeta,
  fetchCollaborators,
  addCollaboratorByEmail,
  removeCollaborator,
  pushTrip,
} from "@/lib/cloud-sync";
import type { Itinerary } from "@/lib/types";

export default function ShareTripDialog({ itinerary }: { itinerary: Itinerary }) {
  const t = useT();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [cloudId, setCloudId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [collabs, setCollabs] = useState<any[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    (async () => {
      try {
        // Ensure trip exists in cloud
        const row = await pushTrip(itinerary, user.id);
        setCloudId(row.id);
        setIsPublic(row.is_public);
        const c = await fetchCollaborators(row.id);
        setCollabs(c);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, user, itinerary.id]);

  async function togglePublic(next: boolean) {
    if (!cloudId) return;
    setIsPublic(next);
    try {
      await updateTripMeta(cloudId, { is_public: next });
    } catch (e) {
      setIsPublic(!next);
      toast.error(t("authError"));
    }
  }

  async function handleAddCollab() {
    if (!cloudId || !emailInput.trim()) return;
    try {
      await addCollaboratorByEmail(cloudId, emailInput.trim());
      setEmailInput("");
      const c = await fetchCollaborators(cloudId);
      setCollabs(c);
      toast.success(t("shareCollaboratorAdded"));
    } catch (e: any) {
      if (e?.message === "USER_NOT_FOUND") toast.error(t("shareUserNotFound"));
      else toast.error(t("authError"));
    }
  }

  async function handleRemoveCollab(id: string) {
    try {
      await removeCollaborator(id);
      setCollabs((cs) => cs.filter((c) => c.id !== id));
      toast.success(t("shareCollaboratorRemoved"));
    } catch {
      toast.error(t("authError"));
    }
  }

  function copyLink() {
    const url = `${window.location.origin}/itinerary/${itinerary.id}`;
    navigator.clipboard.writeText(url);
    toast.success(t("shareCopiedLink"));
  }

  if (!user) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toast.info(t("shareSignInFirst"))}
        title={t("shareTrip")}
      >
        <Share2 className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title={t("shareTrip")}>
          <Share2 className="h-4 w-4 mr-1.5" />
          {t("shareTrip")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("shareTripTitle")}</DialogTitle>
          <DialogDescription>{itinerary.title}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3 p-3 rounded-md border">
              <div className="flex-1">
                <Label className="text-sm font-medium">{t("sharePublicLabel")}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t("sharePublicHint")}</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={togglePublic} />
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">
                {t("shareCollaboratorsTitle")} ({collabs.length})
              </Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder={t("shareCollaboratorPlaceholder")}
                  className="flex-1"
                />
                <Button onClick={handleAddCollab} size="sm">
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-auto">
                {collabs.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 text-xs p-2 rounded border"
                  >
                    <span className="truncate">
                      {c.profiles?.display_name || c.user_id.slice(0, 8)}
                    </span>
                    <button
                      onClick={() => handleRemoveCollab(c.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <Button variant="outline" onClick={copyLink} className="w-full">
              <Copy className="h-4 w-4 mr-1.5" />
              {t("shareCopiedLink")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
