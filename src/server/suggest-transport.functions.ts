import { createServerFn } from "@tanstack/react-start";
import type { TransportMode } from "@/lib/types";

interface DayPlaceLite {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface SuggestTransportInput {
  destination: string;
  startLabel?: string;
  startLat?: number;
  startLng?: number;
  places: DayPlaceLite[]; // ordered for the day
  preferredMode?: "any" | "walking" | "transit" | "mixed";
  lang: "th" | "en";
}

export interface AITransportLeg {
  fromIndex: number; // -1 means from the day start anchor
  toIndex: number; // index in places
  mode: TransportMode;
  durationMin?: number;
  distanceKm?: number;
  costEstimate?: number;
  currency?: string;
  instructions?: string;
  alternatives?: Array<{
    mode: TransportMode;
    durationMin?: number;
    costEstimate?: number;
    note?: string;
  }>;
}

export interface SuggestTransportResult {
  legs: AITransportLeg[];
  error?: string;
}

const MODES: TransportMode[] = [
  "walk",
  "transit",
  "subway",
  "bus",
  "train",
  "taxi",
  "rideshare",
  "ferry",
  "bike",
  "car",
];

export const suggestTransport = createServerFn({ method: "POST" })
  .inputValidator((input: SuggestTransportInput) => {
    if (!input.destination) throw new Error("destination required");
    if (!Array.isArray(input.places) || input.places.length === 0)
      throw new Error("places required");
    return input;
  })
  .handler(async ({ data }): Promise<SuggestTransportResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { legs: [], error: "NO_KEY" };

    const langInstr =
      data.lang === "th"
        ? "ตอบเป็นภาษาไทย คำแนะนำกระชับ ใช้ชื่อสถานี/สายรถจริงในเมืองนั้น"
        : "Respond in English. Concise instructions; mention real station / line names where applicable.";

    const startLine =
      data.startLabel || (typeof data.startLat === "number" && typeof data.startLng === "number")
        ? `Start anchor: ${data.startLabel ?? "Start"}${
            typeof data.startLat === "number" && typeof data.startLng === "number"
              ? ` (${data.startLat.toFixed(4)}, ${data.startLng.toFixed(4)})`
              : ""
          }.`
        : "";

    const placeList = data.places
      .map(
        (p, i) => `${i}. ${p.name} (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)})`,
      )
      .join("\n");

    const preferred =
      data.preferredMode && data.preferredMode !== "any"
        ? ` The traveler prefers ${data.preferredMode}.`
        : "";

    const sys = `You are a local transport expert. For each consecutive pair of stops in a day's itinerary, recommend the best realistic transport mode (consider local context: e.g. Bangkok BTS/MRT, Tokyo subway, Paris Metro, walking when <1.5km). Provide approximate duration in minutes, distance in km, cost estimate in local currency, and one short instruction line. Optionally include 1-2 alternatives. ${langInstr}`;

    const user = `Destination: ${data.destination}.${preferred}\n${startLine}\nOrdered stops for the day:\n${placeList}\n\nReturn one leg per consecutive transition. ${
      data.startLat != null && data.startLng != null
        ? "Include a leg from the start anchor (fromIndex = -1) to the first stop."
        : "Skip the leg from the anchor; start with leg from index 0 to index 1."
    }`;

    const tool = {
      type: "function" as const,
      function: {
        name: "recommend_transport",
        description: "Return one transport leg per consecutive pair",
        parameters: {
          type: "object",
          properties: {
            legs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  fromIndex: { type: "number", description: "-1 for start anchor, otherwise 0-based" },
                  toIndex: { type: "number" },
                  mode: { type: "string", enum: MODES },
                  durationMin: { type: "number" },
                  distanceKm: { type: "number" },
                  costEstimate: { type: "number" },
                  currency: { type: "string" },
                  instructions: { type: "string" },
                  alternatives: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        mode: { type: "string", enum: MODES },
                        durationMin: { type: "number" },
                        costEstimate: { type: "number" },
                        note: { type: "string" },
                      },
                      required: ["mode"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["fromIndex", "toIndex", "mode"],
                additionalProperties: false,
              },
            },
          },
          required: ["legs"],
          additionalProperties: false,
        },
      },
    };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
          tools: [tool],
          tool_choice: { type: "function", function: { name: "recommend_transport" } },
        }),
      });
      if (res.status === 429) return { legs: [], error: "RATE_LIMIT" };
      if (res.status === 402) return { legs: [], error: "PAYMENT_REQUIRED" };
      if (!res.ok) return { legs: [], error: "AI_ERROR" };
      const json = await res.json();
      const call = json.choices?.[0]?.message?.tool_calls?.[0];
      if (!call?.function?.arguments) return { legs: [], error: "NO_TOOL_CALL" };
      const parsed = JSON.parse(call.function.arguments) as { legs: AITransportLeg[] };
      return { legs: parsed.legs ?? [] };
    } catch (e) {
      console.error("suggestTransport failed", e);
      return { legs: [], error: "EXCEPTION" };
    }
  });
