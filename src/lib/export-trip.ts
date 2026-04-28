import type { Itinerary } from "./types";

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function fmtIcsDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    "00Z"
  );
}

function parseTimeToMinutes(t?: string): number | null {
  if (!t) return null;
  // Accept formats like "09:00", "9:00 AM", "13:30"
  const m = t.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let hh = Number(m[1]);
  const mm = Number(m[2]);
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && hh < 12) hh += 12;
  if (ap === "am" && hh === 12) hh = 0;
  return hh * 60 + mm;
}

/** Build an ICS calendar with one VEVENT per place. */
export function buildIcs(it: Itinerary): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trip.Planner//EN",
    "CALSCALE:GREGORIAN",
  ];
  const start = it.startDate ? new Date(it.startDate + "T00:00:00") : new Date();
  it.days.forEach((d, dayIdx) => {
    const dayDate = new Date(start);
    dayDate.setDate(dayDate.getDate() + dayIdx);
    let cursor = 9 * 60; // default start 09:00 if no time
    d.places.forEach((p) => {
      const m = parseTimeToMinutes(p.time);
      const startMin = m ?? cursor;
      const endMin = startMin + 60;
      cursor = endMin + 30;

      const sd = new Date(dayDate);
      sd.setHours(0, 0, 0, 0);
      sd.setMinutes(startMin);
      const ed = new Date(dayDate);
      ed.setHours(0, 0, 0, 0);
      ed.setMinutes(endMin);

      lines.push(
        "BEGIN:VEVENT",
        `UID:${p.id}-${it.id}@trip.planner`,
        `DTSTAMP:${fmtIcsDate(new Date())}`,
        `DTSTART:${fmtIcsDate(sd)}`,
        `DTEND:${fmtIcsDate(ed)}`,
        `SUMMARY:${escapeIcs(`Day ${d.day} · ${p.name}`)}`,
        `DESCRIPTION:${escapeIcs(p.description ?? "")}`,
        `GEO:${p.lat};${p.lng}`,
        `LOCATION:${escapeIcs(p.name)}`,
        "END:VEVENT",
      );
    });
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** Build a GPX file with one waypoint per place + tracks per day. */
export function buildGpx(it: Itinerary): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="Trip.Planner" xmlns="http://www.topografix.com/GPX/1/1">`,
    `<metadata><name>${esc(it.title)}</name></metadata>`,
  ];
  it.days.forEach((d) => {
    d.places.forEach((p) => {
      lines.push(
        `<wpt lat="${p.lat}" lon="${p.lng}">`,
        `<name>${esc(`D${d.day} · ${p.name}`)}</name>`,
        p.description ? `<desc>${esc(p.description)}</desc>` : "",
        p.type ? `<type>${esc(p.type)}</type>` : "",
        `</wpt>`,
      );
    });
    if (d.places.length > 1) {
      lines.push(
        `<trk><name>${esc(`Day ${d.day}`)}</name><trkseg>`,
        ...d.places.map((p) => `<trkpt lat="${p.lat}" lon="${p.lng}"></trkpt>`),
        `</trkseg></trk>`,
      );
    }
  });
  lines.push(`</gpx>`);
  return lines.filter(Boolean).join("\n");
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 50) || "trip";
}
