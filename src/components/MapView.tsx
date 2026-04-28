import { useEffect, useRef } from "react";
import type { Place } from "@/lib/types";

interface DayMarkers {
  day: number;
  color: string;
  places: Place[];
}

interface Props {
  groups: DayMarkers[];
  height?: string;
  fitBounds?: boolean;
  onMarkerClick?: (place: Place, day: number) => void;
  highlightedType?: string | null;
  selectedPlaceId?: string | null;
}

const DAY_COLORS = [
  "#6366f1",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#06b6d4",
  "#ef4444",
  "#8b5cf6",
  "#84cc16",
  "#f97316",
  "#14b8a6",
  "#a855f7",
  "#eab308",
  "#0ea5e9",
  "#f43f5e",
];

export function dayColor(i: number) {
  return DAY_COLORS[i % DAY_COLORS.length];
}

export default function MapView({
  groups,
  height = "100%",
  fitBounds = true,
  onMarkerClick,
  highlightedType = null,
  selectedPlaceId = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const markersByPlaceIdRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;
      LRef.current = L;
      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          center: [20, 20],
          zoom: 2,
          worldCopyJump: true,
          zoomControl: false,
        });
        L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(mapRef.current);
      }
      renderMarkers();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, highlightedType]);

  // Pan to selected place + open popup when selectedPlaceId changes
  useEffect(() => {
    if (!selectedPlaceId) return;
    const map = mapRef.current;
    const marker = markersByPlaceIdRef.current.get(selectedPlaceId);
    if (!map || !marker) return;
    const ll = marker.getLatLng();
    map.flyTo(ll, Math.max(map.getZoom(), 14), { duration: 0.6 });
    setTimeout(() => marker.openPopup(), 350);
  }, [selectedPlaceId]);

  function renderMarkers() {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (layerRef.current) layerRef.current.remove();
    const layer = L.layerGroup();
    const allLatLngs: [number, number][] = [];
    markersByPlaceIdRef.current.clear();

    groups.forEach((g) => {
      const latlngs: [number, number][] = [];
      g.places.forEach((p, idx) => {
        if (typeof p.lat !== "number" || typeof p.lng !== "number") return;
        const dimmed =
          highlightedType !== null && highlightedType !== "" && p.type !== highlightedType;
        const size = dimmed ? 22 : 30;
        const opacity = dimmed ? 0.3 : 1;
        const ring =
          !dimmed && highlightedType
            ? `box-shadow:0 0 0 4px ${g.color}33, 0 2px 6px rgba(0,0,0,0.3); animation:trip-pulse 1.4s infinite;`
            : `box-shadow:0 2px 6px rgba(0,0,0,0.3);`;
        const html = `<div style="background:${g.color};color:white;width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:${dimmed ? 11 : 13}px;border:2px solid white;opacity:${opacity};${ring}">${idx + 1}</div>`;
        const icon = L.divIcon({
          html,
          className: "trip-marker",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        const m = L.marker([p.lat, p.lng], { icon })
          .bindPopup(
            `<div style="min-width:160px"><strong>${escapeHtml(p.name)}</strong><br/><small>Day ${g.day} • ${escapeHtml(p.time || "")}</small><br/>${escapeHtml(p.description || "")}</div>`,
          )
          .addTo(layer);
        if (onMarkerClick) {
          m.on("click", () => onMarkerClick(p, g.day));
        }
        if (p.id) markersByPlaceIdRef.current.set(p.id, m);
        latlngs.push([p.lat, p.lng]);
        allLatLngs.push([p.lat, p.lng]);
      });
      if (latlngs.length > 1) {
        const polyOpacity = highlightedType ? 0.25 : 0.7;
        L.polyline(latlngs, {
          color: g.color,
          weight: 3,
          opacity: polyOpacity,
          dashArray: "6,6",
        }).addTo(layer);
      }
    });

    layer.addTo(map);
    layerRef.current = layer;

    if (fitBounds && allLatLngs.length > 0) {
      const bounds = L.latLngBounds(allLatLngs);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className="rounded-xl overflow-hidden bg-muted"
    />
  );
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
