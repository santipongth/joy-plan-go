// Open-Meteo weather forecast (no API key required).
// Docs: https://open-meteo.com/en/docs

export interface DailyWeather {
  date: string; // YYYY-MM-DD
  tempMax: number;
  tempMin: number;
  precipMm: number;
  precipProb: number; // 0..100
  weatherCode: number;
}

const WMO_ICON: Record<number, { icon: string; label: string }> = {
  0: { icon: "☀️", label: "Clear" },
  1: { icon: "🌤️", label: "Mainly clear" },
  2: { icon: "⛅", label: "Partly cloudy" },
  3: { icon: "☁️", label: "Overcast" },
  45: { icon: "🌫️", label: "Fog" },
  48: { icon: "🌫️", label: "Rime fog" },
  51: { icon: "🌦️", label: "Light drizzle" },
  53: { icon: "🌦️", label: "Drizzle" },
  55: { icon: "🌦️", label: "Heavy drizzle" },
  61: { icon: "🌧️", label: "Light rain" },
  63: { icon: "🌧️", label: "Rain" },
  65: { icon: "🌧️", label: "Heavy rain" },
  71: { icon: "🌨️", label: "Light snow" },
  73: { icon: "🌨️", label: "Snow" },
  75: { icon: "❄️", label: "Heavy snow" },
  80: { icon: "🌧️", label: "Rain showers" },
  81: { icon: "⛈️", label: "Heavy showers" },
  82: { icon: "⛈️", label: "Violent showers" },
  95: { icon: "⛈️", label: "Thunderstorm" },
  96: { icon: "⛈️", label: "Thunderstorm w/ hail" },
  99: { icon: "⛈️", label: "Severe thunderstorm" },
};

export function weatherIcon(code: number): { icon: string; label: string } {
  return WMO_ICON[code] ?? { icon: "🌡️", label: "Weather" };
}

export interface FetchWeatherInput {
  lat: number;
  lng: number;
  startDate: string; // YYYY-MM-DD
  days: number;
}

const cache = new Map<string, { ts: number; data: DailyWeather[] }>();
const TTL_MS = 1000 * 60 * 60; // 1 hour

export async function fetchWeather(input: FetchWeatherInput): Promise<DailyWeather[]> {
  const key = `${input.lat.toFixed(3)},${input.lng.toFixed(3)}|${input.startDate}|${input.days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.data;

  const end = new Date(input.startDate);
  end.setDate(end.getDate() + Math.max(0, input.days - 1));
  const endStr = end.toISOString().slice(0, 10);

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(input.lat));
  url.searchParams.set("longitude", String(input.lng));
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
  );
  url.searchParams.set("start_date", input.startDate);
  url.searchParams.set("end_date", endStr);
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Weather API ${res.status}`);
  const json = await res.json();
  const d = json.daily ?? {};
  const out: DailyWeather[] = (d.time ?? []).map((date: string, i: number) => ({
    date,
    tempMax: d.temperature_2m_max?.[i] ?? 0,
    tempMin: d.temperature_2m_min?.[i] ?? 0,
    precipMm: d.precipitation_sum?.[i] ?? 0,
    precipProb: d.precipitation_probability_max?.[i] ?? 0,
    weatherCode: d.weather_code?.[i] ?? 0,
  }));
  cache.set(key, { ts: Date.now(), data: out });
  return out;
}

/** Returns true if forecast is reasonably likely to be available (Open-Meteo: ~16 days out). */
export function isForecastable(startDate: string, days: number): boolean {
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return false;
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 16);
  return end >= now && start <= horizon;
}
