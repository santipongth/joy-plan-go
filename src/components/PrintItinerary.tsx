import type { Itinerary } from "@/lib/types";
import { dayColor } from "@/components/MapView";

interface Props {
  itinerary: Itinerary;
  t: (k: any) => string;
}

export default function PrintItinerary({ itinerary, t }: Props) {
  return (
    <div className="print-doc">
      <header className="print-cover">
        <h1>{itinerary.title}</h1>
        <p className="print-meta">
          {itinerary.destination}
          {itinerary.origin ? ` · ${t("startingFrom")} ${itinerary.origin}` : ""}
        </p>
        <p className="print-meta">
          {itinerary.durationDays} {t("days")}
          {itinerary.startDate ? ` · ${itinerary.startDate}` : ""}
        </p>
      </header>

      {itinerary.days.map((d) => {
        const color = dayColor(d.day - 1);
        return (
          <section key={d.day} className="print-day">
            <div className="print-day-header" style={{ borderLeftColor: color }}>
              <div className="print-day-badge" style={{ background: color }}>{d.day}</div>
              <div>
                <h2>
                  {t("day")} {d.day}
                </h2>
                {d.title && <p className="print-day-title">{d.title}</p>}
              </div>
            </div>

            <table className="print-places">
              <thead>
                <tr>
                  <th style={{ width: "5%" }}>#</th>
                  <th style={{ width: "12%" }}>{t("time")}</th>
                  <th style={{ width: "25%" }}>{t("placeName")}</th>
                  <th style={{ width: "43%" }}>{t("note")}</th>
                  <th style={{ width: "15%" }}>Lat / Lng</th>
                </tr>
              </thead>
              <tbody>
                {d.places.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td>{p.time || "—"}</td>
                    <td>
                      <strong>{p.name}</strong>
                      {p.type && <div className="print-type">{p.type}</div>}
                    </td>
                    <td>{p.description || ""}</td>
                    <td className="print-coords">
                      {p.lat.toFixed(4)}
                      <br />
                      {p.lng.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
