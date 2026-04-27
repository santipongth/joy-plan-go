import { createServerFn } from "@tanstack/react-start";

export interface AIPlace {
  name: string;
  description: string;
  type: string;
  time: string;
  lat: number;
  lng: number;
}

export interface AIDay {
  day: number;
  title: string;
  places: AIPlace[];
}

export interface AIPlanResult {
  title: string;
  days: AIDay[];
  citiesCount: number;
  error?: string;
}

interface PlanInput {
  origin?: string;
  destination: string;
  durationDays: number;
  startDate?: string;
  interests?: string[];
  budget?: string;
  pace?: string;
  lang: "th" | "en";
}

export const planTrip = createServerFn({ method: "POST" })
  .inputValidator((input: PlanInput) => {
    if (!input.destination || typeof input.destination !== "string") {
      throw new Error("destination required");
    }
    const days = Math.max(1, Math.min(14, Number(input.durationDays) || 3));
    return { ...input, durationDays: days };
  })
  .handler(async ({ data }): Promise<AIPlanResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { title: "", days: [], citiesCount: 0, error: "LOVABLE_API_KEY not configured" };
    }

    const langInstr =
      data.lang === "th"
        ? "ตอบเป็นภาษาไทย ใช้ชื่อสถานที่ภาษาท้องถิ่น/อังกฤษตามที่นิยม คำอธิบายเป็นภาษาไทย"
        : "Respond in English. Use commonly known place names. Descriptions in English.";

    const sys = `You are an expert travel planner. Generate a realistic day-by-day itinerary with 3-5 places per day. Each place must include accurate latitude/longitude coordinates (decimal degrees). Group nearby places on the same day to minimize travel. ${langInstr}`;

    const user = `Plan a ${data.durationDays}-day trip${data.origin ? ` starting from ${data.origin}` : ""} to ${data.destination}.${
      data.interests?.length ? ` Interests: ${data.interests.join(", ")}.` : ""
    }${data.budget ? ` Budget: ${data.budget}.` : ""}${data.pace ? ` Pace: ${data.pace}.` : ""} Provide a creative trip title.`;

    const tool = {
      type: "function" as const,
      function: {
        name: "create_itinerary",
        description: "Return the structured itinerary",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Catchy trip title" },
            citiesCount: { type: "number" },
            days: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day: { type: "number" },
                  title: { type: "string", description: "Theme of the day" },
                  places: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                        type: {
                          type: "string",
                          description: "landmark|food|nature|shopping|culture|nightlife|hotel",
                        },
                        time: { type: "string", description: "e.g. 09:00" },
                        lat: { type: "number" },
                        lng: { type: "number" },
                      },
                      required: ["name", "description", "type", "time", "lat", "lng"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["day", "title", "places"],
                additionalProperties: false,
              },
            },
          },
          required: ["title", "citiesCount", "days"],
          additionalProperties: false,
        },
      },
    };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
          tools: [tool],
          tool_choice: { type: "function", function: { name: "create_itinerary" } },
        }),
      });

      if (res.status === 429) {
        return { title: "", days: [], citiesCount: 0, error: "RATE_LIMIT" };
      }
      if (res.status === 402) {
        return { title: "", days: [], citiesCount: 0, error: "PAYMENT_REQUIRED" };
      }
      if (!res.ok) {
        const t = await res.text();
        console.error("AI gateway error", res.status, t);
        return { title: "", days: [], citiesCount: 0, error: "AI_ERROR" };
      }

      const json = await res.json();
      const call = json.choices?.[0]?.message?.tool_calls?.[0];
      if (!call?.function?.arguments) {
        return { title: "", days: [], citiesCount: 0, error: "NO_TOOL_CALL" };
      }
      const parsed = JSON.parse(call.function.arguments) as AIPlanResult;
      return {
        title: parsed.title || data.destination,
        citiesCount: parsed.citiesCount || 1,
        days: parsed.days || [],
      };
    } catch (e) {
      console.error("planTrip failed", e);
      return { title: "", days: [], citiesCount: 0, error: "EXCEPTION" };
    }
  });
