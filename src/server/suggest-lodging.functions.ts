import { createServerFn } from "@tanstack/react-start";
import type { LodgingType } from "@/lib/types";

interface SuggestLodgingInput {
  destination: string;
  centerLat?: number;
  centerLng?: number;
  budget?: "low" | "medium" | "high";
  travelers?: number;
  nights?: number;
  preferences?: string[]; // e.g. ["near-transit", "breakfast", "pool"]
  lang: "th" | "en";
}

export interface AILodging {
  name: string;
  type: LodgingType;
  lat: number;
  lng: number;
  address?: string;
  pricePerNight?: number;
  currency?: string;
  rating?: number;
  description?: string;
  amenities?: string[];
}

export interface SuggestLodgingResult {
  lodgings: AILodging[];
  error?: string;
}

const LODGING_TYPES: LodgingType[] = [
  "hotel",
  "hostel",
  "resort",
  "guesthouse",
  "apartment",
];

export const suggestLodging = createServerFn({ method: "POST" })
  .inputValidator((input: SuggestLodgingInput) => {
    if (!input.destination) throw new Error("destination required");
    return input;
  })
  .handler(async ({ data }): Promise<SuggestLodgingResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { lodgings: [], error: "NO_KEY" };

    const langInstr =
      data.lang === "th"
        ? "ตอบเป็นภาษาไทย ใช้ชื่อโรงแรม/ที่พักจริงในพื้นที่"
        : "Respond in English. Use real hotel/lodging names that exist in the area.";
    const center =
      typeof data.centerLat === "number" && typeof data.centerLng === "number"
        ? ` Center the recommendations near (${data.centerLat.toFixed(4)}, ${data.centerLng.toFixed(4)}).`
        : "";
    const prefs = (data.preferences ?? []).filter(Boolean).join(", ");
    const budgetText = data.budget
      ? ` Budget tier: ${data.budget} (low=hostel/budget, medium=mid-range hotel, high=luxury).`
      : "";
    const travelersText = data.travelers ? ` Travelers: ${data.travelers}.` : "";
    const nightsText = data.nights ? ` Nights: ${data.nights}.` : "";
    const prefsText = prefs ? ` Preferences: ${prefs}.` : "";

    const sys = `You are a local hotel concierge. Recommend 5 real, well-reviewed lodging options for the destination with accurate latitude/longitude. Mix types when relevant (hotel, hostel, guesthouse, apartment, resort). ${langInstr}`;
    const user = `Destination: ${data.destination}.${center}${budgetText}${travelersText}${nightsText}${prefsText} Return 5 distinct options spread across price points unless a tier is specified.`;

    const tool = {
      type: "function" as const,
      function: {
        name: "recommend_lodgings",
        description: "Return 5 lodging recommendations",
        parameters: {
          type: "object",
          properties: {
            lodgings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { type: "string", enum: LODGING_TYPES },
                  lat: { type: "number" },
                  lng: { type: "number" },
                  address: { type: "string" },
                  pricePerNight: { type: "number", description: "Approximate price per night in local currency" },
                  currency: { type: "string", description: "ISO 4217 code, e.g. THB, USD, JPY" },
                  rating: { type: "number", description: "0 to 5" },
                  description: { type: "string" },
                  amenities: { type: "array", items: { type: "string" } },
                },
                required: ["name", "type", "lat", "lng", "description"],
                additionalProperties: false,
              },
            },
          },
          required: ["lodgings"],
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
          tool_choice: { type: "function", function: { name: "recommend_lodgings" } },
        }),
      });
      if (res.status === 429) return { lodgings: [], error: "RATE_LIMIT" };
      if (res.status === 402) return { lodgings: [], error: "PAYMENT_REQUIRED" };
      if (!res.ok) return { lodgings: [], error: "AI_ERROR" };
      const json = await res.json();
      const call = json.choices?.[0]?.message?.tool_calls?.[0];
      if (!call?.function?.arguments) return { lodgings: [], error: "NO_TOOL_CALL" };
      const parsed = JSON.parse(call.function.arguments) as { lodgings: AILodging[] };
      const cleaned = (parsed.lodgings || []).filter(
        (l) =>
          l &&
          typeof l.lat === "number" &&
          typeof l.lng === "number" &&
          Number.isFinite(l.lat) &&
          Number.isFinite(l.lng) &&
          !!l.name,
      );
      return { lodgings: cleaned };
    } catch (e) {
      console.error("suggestLodging failed", e);
      return { lodgings: [], error: "EXCEPTION" };
    }
  });
