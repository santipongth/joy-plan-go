import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useItineraryStore } from "@/lib/store";
import { ArrowLeft, Smartphone, Tablet, Monitor } from "lucide-react";

export const Route = createFileRoute("/device-test")({
  component: DeviceTestPage,
  head: () => ({
    meta: [{ title: "Device Layout Tester" }],
  }),
});

type Device = {
  key: string;
  label: string;
  width: number;
  height: number;
  icon: typeof Smartphone;
};

const DEVICES: Device[] = [
  { key: "mobile-s", label: "Mobile · 360", width: 360, height: 740, icon: Smartphone },
  { key: "mobile-m", label: "Mobile · 390", width: 390, height: 844, icon: Smartphone },
  { key: "tablet", label: "Tablet · 768", width: 768, height: 1024, icon: Tablet },
  { key: "desktop", label: "Desktop · 1280", width: 1280, height: 800, icon: Monitor },
];

function DeviceTestPage() {
  const navigate = useNavigate();
  const itineraries = useItineraryStore((s) => s.itineraries);
  const firstId = itineraries[0]?.id ?? "";
  const [path, setPath] = useState<string>(firstId ? `/itinerary/${firstId}` : "/");
  const [pathDraft, setPathDraft] = useState(path);
  const [active, setActive] = useState<Set<string>>(
    new Set(["mobile-m", "tablet", "desktop"]),
  );

  function toggle(key: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="px-4 py-3 flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/" })}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-base font-semibold">Device Layout Tester</h1>

          <form
            className="flex items-center gap-2 ml-auto"
            onSubmit={(e) => {
              e.preventDefault();
              setPath(pathDraft.startsWith("/") ? pathDraft : `/${pathDraft}`);
            }}
          >
            <label className="text-xs text-muted-foreground">Path</label>
            <Input
              value={pathDraft}
              onChange={(e) => setPathDraft(e.target.value)}
              placeholder="/itinerary/..."
              className="h-8 w-64"
            />
            <Button type="submit" size="sm">Load</Button>
          </form>
        </div>

        <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
          {DEVICES.map((d) => {
            const Icon = d.icon;
            const on = active.has(d.key);
            return (
              <Button
                key={d.key}
                size="sm"
                variant={on ? "default" : "outline"}
                onClick={() => toggle(d.key)}
              >
                <Icon className="h-3.5 w-3.5 mr-1.5" />
                {d.label}
              </Button>
            );
          })}
          {firstId && (
            <Link
              to="/itinerary/$id"
              params={{ id: firstId }}
              className="ml-auto text-xs text-muted-foreground underline"
            >
              Open trip in real preview →
            </Link>
          )}
        </div>
      </header>

      <main className="p-4">
        {!path ? (
          <p className="text-sm text-muted-foreground">Enter a path to preview.</p>
        ) : (
          <div className="flex flex-wrap gap-6 items-start">
            {DEVICES.filter((d) => active.has(d.key)).map((d) => (
              <Card key={d.key} className="p-3 shrink-0">
                <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{d.label}</span>
                  <span>{d.width}×{d.height}</span>
                </div>
                <div
                  className="border rounded-md overflow-hidden bg-background"
                  style={{ width: d.width, height: d.height }}
                >
                  <iframe
                    key={`${d.key}-${path}`}
                    src={path}
                    title={d.label}
                    className="w-full h-full border-0"
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
