import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Compass, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { LangSwitch } from "@/components/LangSwitch";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Trip.Planner" },
      { name: "description", content: "Sign in or create an account to sync your trips." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const t = useT();
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success(t("authCheckEmail"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t("authSignedIn"));
        navigate({ to: redirect || "/" });
      }
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("invalid login")) {
        toast.error(t("authInvalidCredentials"));
      } else if (msg.toLowerCase().includes("already registered")) {
        toast.error(t("authAlreadyRegistered"));
      } else {
        toast.error(msg || t("authError"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <Toaster richColors position="top-right" />
      <div className="max-w-md mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold">
            <Compass className="h-5 w-5 text-primary" />
            Trip.Planner
          </Link>
          <LangSwitch />
        </header>

        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-1">
            {mode === "signin" ? t("authSignIn") : t("authSignUp")}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin" ? t("authSignInSubtitle") : t("authSignUpSubtitle")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="displayName">{t("authDisplayName")}</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("authDisplayNamePlaceholder")}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("authEmail")}</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("authPassword")}</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === "signin" ? t("authSignIn") : t("authSignUp")}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                {t("authNoAccount")}{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setMode("signup")}
                >
                  {t("authSignUp")}
                </button>
              </>
            ) : (
              <>
                {t("authHaveAccount")}{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setMode("signin")}
                >
                  {t("authSignIn")}
                </button>
              </>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
