import { useEffect, useRef } from "react";
import { Map as MapIcon, Satellite, Layers } from "lucide-react";
import type { Place } from "@/lib/types";
import { useMapStyleStore, TILES, type MapStyle } from "@/lib/map-style-store";

interface Props {
  places: Place[];
  anchor: { lat: number; lng: number; label?: string } | null;
  color: string;
  height?: string;
  startLabel?: string;
  styleLabels?: { streets: string; satellite: string; minimal: string };
}

export default function DayMiniMap({
  places,
  anchor,
  color,
  height = "180px",
  startLabel = "Start",
  styleLabels,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const mapStyle = useMapStyleStore((s) => s.style);
  const setMapStyle = useMapStyleStore((s) => s.setStyle);

  // Initialize map once on mount; tear down completely on unmount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;
      LRef.current = L;
      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          touchZoom: false,
          boxZoom: false,
          keyboard: false,
          dragging: true,
          inertia: false,
        }).setView([0, 0], 2);
        applyTileLayer(mapStyle);
        L.DomEvent.disableScrollPropagation(containerRef.current);
        if (typeof ResizeObserver !== "undefined") {
          resizeObsRef.current = new ResizeObserver(() => {
            queueMicrotask(() => mapRef.current?.invalidateSize());
          });
          resizeObsRef.current.observe(containerRef.current);
        }
      }
      drawRoute();
    })();
    return () => {
      cancelled = true;
      try {
        resizeObsRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      resizeObsRef.current = null;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          /* ignore */
        }
        mapRef.current = null;
      }
      tileLayerRef.current = null;
      layerRef.current = null;
      LRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap tile layer when style changes (no map recreate).
  useEffect(() => {
    if (LRef.current && mapRef.current) applyTileLayer(mapStyle);
  }, [mapStyle]);

  // Redraw when inputs change.
  useEffect(() => {
    if (LRef.current && mapRef.current) drawRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, anchor, color]);

  function applyTileLayer(style: MapStyle) {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (tileLayerRef.current) {
      try {
        map.removeLayer(tileLayerRef.current);
      } catch {
        /* ignore */
      }
      tileLayerRef.current = null;
    }
    const def = TILES[style];
    const opts: any = { maxZoom: def.maxZoom };
    if (def.subdomains) opts.subdomains = def.subdomains;
    tileLayerRef.current = L.tileLayer(def.url, opts).addTo(map);
  }

  function drawRoute() {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (layerRef.current) {
      try {
        map.removeLayer(layerRef.current);
      } catch {
        /* ignore */
      }
      layerRef.current = null;
    }

    const group = L.featureGroup();

    const validPlaces = places.filter(
      (p) => typeof p.lat === "number" && typeof p.lng === "number",
    );

    const coords: [number, number][] = [];
    if (anchor) coords.push([anchor.lat, anchor.lng]);
    validPlaces.forEach((p) => coords.push([p.lat, p.lng]));

    if (coords.length === 0) return;

    if (coords.length >= 2) {
      L.polyline(coords, {
        color,
        weight: 3,
        opacity: 0.85,
        dashArray: anchor ? "4,4" : undefined,
      }).addTo(group);
    }

    if (anchor) {
      const startIcon = L.divIcon({
        className: "",
        html: `<div style="background:#0f172a;color:#fff;border:2px solid ${color};width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,0.3);">S</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      L.marker([anchor.lat, anchor.lng], { icon: startIcon, title: startLabel }).addTo(group);
    }

    validPlaces.forEach((p, i) => {
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:${color};color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);">${i + 1}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      L.marker([p.lat, p.lng], { icon, title: p.name }).addTo(group);
    });

    group.addTo(map);
    layerRef.current = group;

    try {
      const bounds = group.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [16, 16], maxZoom: 16 });
      }
    } catch {
      /* ignore */
    }
  }

  if (places.length === 0 && !anchor) return null;

  const labels = styleLabels ?? {
    streets: "Streets",
    satellite: "Satellite",
    minimal: "Minimal",
  };

  const styleButtons: { key: MapStyle; label: string; Icon: typeof MapIcon }[] = [
    { key: "streets", label: labels.streets, Icon: MapIcon },
    { key: "satellite", label: labels.satellite, Icon: Satellite },
    { key: "minimal", label: labels.minimal, Icon: Layers },
  ];

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full rounded-md overflow-hidden border bg-muted/30"
        style={{ height, touchAction: "pan-y" }}
      />
      <div className="absolute top-1.5 right-1.5 z-[400] flex gap-0.5 bg-background/90 backdrop-blur border rounded-md p-0.5 shadow-sm">
        {styleButtons.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMapStyle(key)}
            title={label}
            aria-label={label}
            aria-pressed={mapStyle === key}
            className={`p-1 rounded transition-colors ${
              mapStyle === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
