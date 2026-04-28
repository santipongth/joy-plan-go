import { createServerFn } from "@tanstack/react-start";

interface SimilarInput {
  destination: string;
  reference: { name: string; lat: number; lng: number; type?: string };
  existing: { name: string; lat: number; lng: number }[];
  radiusKm?: number;
  lang: "th" | "en";
}

export interface SuggestedPlace {
  name: string;
  description: string;
  type: string;
  lat: number;
  lng: number;
}

export interface SimilarResult {
  places: SuggestedPlace[];
  error?: string;
}

async function callGateway(body: unknown): Promise<any> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { __err: "NO_KEY" };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) return { __err: "RATE_LIMIT" };
  if (res.status === 402) return { __err: "PAYMENT_REQUIRED" };
  if (!res.ok) return { __err: "AI_ERROR" };
  return res.json();
}

export const suggestSimilarPlaces = createServerFn({ method: "POST" })
  .inputValidator((input: SimilarInput) => {
    if (!input.destination || !input.reference?.name) throw new Error("invalid input");
    return input;
  })
  .handler(async ({ data }): Promise<SimilarResult> => {
    const langInstr =
      data.lang === "th" ? "ตอบเป็นภาษาไทย" : "Respond in English.";
    const radius = data.radiusKm ?? 3;
    const sys = `You are a local travel expert. Suggest 3 distinct places SIMILAR in vibe/category to the reference place, located within ~${radius}km of the reference coordinates. Each must have accurate lat/lng, be unique, and NOT duplicate any of the existing places. ${langInstr}`;
    const existingList = data.existing
      .map((p) => `${p.name} (${p.lat.toFixed(4)},${p.lng.toFixed(4)})`)
      .join("; ");
    const user = `Destination: ${data.destination}. Reference place: ${data.reference.name} at (${data.reference.lat.toFixed(4)},${data.reference.lng.toFixed(4)})${
      data.reference.type ? `, category: ${data.reference.type}` : ""
    }. Suggest 3 similar nearby spots. Avoid these existing places: ${existingList || "(none)"}.`;
    const tool = {
      type: "function" as const,
      function: {
        name: "suggest_places",
        description: "Return 3 similar places",
        parameters: {
          type: "object",
          properties: {
            places: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  type: { type: "string" },
                  lat: { type: "number" },
                  lng: { type: "number" },
                },
                required: ["name", "description", "type", "lat", "lng"],
                additionalProperties: false,
              },
            },
          },
          required: ["places"],
          additionalProperties: false,
        },
      },
    };
    const json = await callGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "suggest_places" } },
    });
    if (json?.__err) return { places: [], error: json.__err };
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) return { places: [], error: "NO_TOOL_CALL" };
    try {
      const parsed = JSON.parse(call.function.arguments);
      return { places: Array.isArray(parsed.places) ? parsed.places.slice(0, 3) : [] };
    } catch {
      return { places: [], error: "PARSE_ERROR" };
    }
  });

interface TipsInput {
  destination: string;
  startDate?: string;
  durationDays: number;
  lang: "th" | "en";
}

export interface TipsResult {
  dressCode?: string;
  tipping?: string;
  language?: string;
  hours?: string;
  festivals?: string;
  etiquette?: string;
  safety?: string;
  error?: string;
}

export const getLocalTips = createServerFn({ method: "POST" })
  .inputValidator((input: TipsInput) => {
    if (!input.destination) throw new Error("destination required");
    return input;
  })
  .handler(async ({ data }): Promise<TipsResult> => {
    const langInstr =
      data.lang === "th"
        ? "ตอบเป็นภาษาไทยทั้งหมด สั้น กระชับ"
        : "Respond in English. Be concise.";
    const sys = `You are a knowledgeable local guide. Provide concise, accurate cultural and practical tips for travelers. Each field should be 1-2 short sentences. ${langInstr}`;
    const user = `Destination: ${data.destination}. Trip length: ${data.durationDays} days${
      data.startDate ? ` starting ${data.startDate}` : ""
    }. Provide local tips covering dress code, tipping norms, key local language phrases, typical opening hours, notable festivals/events during this period, etiquette to know, and safety considerations.`;
    const tool = {
      type: "function" as const,
      function: {
        name: "local_tips",
        description: "Structured local tips",
        parameters: {
          type: "object",
          properties: {
            dressCode: { type: "string" },
            tipping: { type: "string" },
            language: { type: "string" },
            hours: { type: "string" },
            festivals: { type: "string" },
            etiquette: { type: "string" },
            safety: { type: "string" },
          },
          required: ["dressCode", "tipping", "language", "hours", "etiquette", "safety"],
          additionalProperties: false,
        },
      },
    };
    const json = await callGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "local_tips" } },
    });
    if (json?.__err) return { error: json.__err };
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) return { error: "NO_TOOL_CALL" };
    try {
      return JSON.parse(call.function.arguments);
    } catch {
      return { error: "PARSE_ERROR" };
    }
  });

interface MealsInput {
  destination: string;
  dayPlaces: { name: string; lat: number; lng: number; kind?: string }[];
  lang: "th" | "en";
}

export interface MealSuggestion {
  name: string;
  description: string;
  time: string;
  lat: number;
  lng: number;
  cuisine?: string;
}

export interface MealsResult {
  meals: MealSuggestion[];
  error?: string;
}

export const suggestMeals = createServerFn({ method: "POST" })
  .inputValidator((input: MealsInput) => {
    if (!input.destination) throw new Error("destination required");
    return input;
  })
  .handler(async ({ data }): Promise<MealsResult> => {
    const langInstr = data.lang === "th" ? "ตอบเป็นภาษาไทย" : "Respond in English.";
    const sys = `You are a local food expert. Suggest 2-3 meal stops (lunch and dinner, optionally breakfast) along the day's route. Pick well-rated, popular local spots near the existing places with accurate lat/lng. ${langInstr}`;
    const list = data.dayPlaces
      .map((p) => `${p.name} (${p.lat.toFixed(4)},${p.lng.toFixed(4)})`)
      .join("; ");
    const user = `Destination: ${data.destination}. The day's existing places (in order): ${list}. Suggest meals near these, with realistic times (e.g. 12:30 lunch, 19:00 dinner).`;
    const tool = {
      type: "function" as const,
      function: {
        name: "suggest_meals",
        description: "Meal suggestions for the day",
        parameters: {
          type: "object",
          properties: {
            meals: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  time: { type: "string" },
                  lat: { type: "number" },
                  lng: { type: "number" },
                  cuisine: { type: "string" },
                },
                required: ["name", "description", "time", "lat", "lng"],
                additionalProperties: false,
              },
            },
          },
          required: ["meals"],
          additionalProperties: false,
        },
      },
    };
    const json = await callGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "suggest_meals" } },
    });
    if (json?.__err) return { meals: [], error: json.__err };
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) return { meals: [], error: "NO_TOOL_CALL" };
    try {
      const parsed = JSON.parse(call.function.arguments);
      return { meals: Array.isArray(parsed.meals) ? parsed.meals : [] };
    } catch {
      return { meals: [], error: "PARSE_ERROR" };
    }
  });

// ---------- AI Suggest (refine a day) ----------

interface SuggestPlanInput {
  destination: string;
  dayNumber: number;
  dayTitle?: string;
  currentPlaces: { name: string; lat: number; lng: number; type?: string; time?: string }[];
  budget: "low" | "medium" | "high";
  travelTime: "short" | "balanced" | "long";
  styles: string[];
  lang: "th" | "en";
}

export interface SuggestedDayPlace {
  name: string;
  description: string;
  type: string;
  time: string;
  lat: number;
  lng: number;
}

export interface SuggestPlanResult {
  title?: string;
  places: SuggestedDayPlace[];
  error?: string;
}

export const aiSuggestPlan = createServerFn({ method: "POST" })
  .inputValidator((input: SuggestPlanInput) => {
    if (!input.destination || !input.dayNumber) throw new Error("invalid input");
    return input;
  })
  .handler(async ({ data }): Promise<SuggestPlanResult> => {
    const langInstr = data.lang === "th" ? "ตอบเป็นภาษาไทย" : "Respond in English.";
    const styleStr = data.styles.length ? data.styles.join(", ") : "balanced";
    const tt =
      data.travelTime === "short"
        ? "Keep travel time minimal — cluster nearby spots."
        : data.travelTime === "long"
          ? "Allow longer travel between spots; reach further/landmark places."
          : "Balanced pacing.";
    const sys = `You are a meticulous travel planner. Build a single day's plan with 4-6 places ordered by realistic time. Respect budget tier and travel-style. Keep places clustered geographically as possible. Each place must include accurate lat/lng. ${langInstr}`;
    const cur = data.currentPlaces.length
      ? data.currentPlaces.map((p) => `${p.name} (${p.lat.toFixed(4)},${p.lng.toFixed(4)})`).join("; ")
      : "(none yet)";
    const user = `Destination: ${data.destination}. Refining Day ${data.dayNumber}${
      data.dayTitle ? ` — "${data.dayTitle}"` : ""
    }. Current places to consider keeping: ${cur}. Budget: ${data.budget}. Style: ${styleStr}. ${tt} Produce an improved day plan with concise descriptions and realistic times like "09:00".`;
    const tool = {
      type: "function" as const,
      function: {
        name: "suggest_day_plan",
        description: "Refined plan for one day",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            places: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  type: { type: "string" },
                  time: { type: "string" },
                  lat: { type: "number" },
                  lng: { type: "number" },
                },
                required: ["name", "description", "type", "time", "lat", "lng"],
                additionalProperties: false,
              },
            },
          },
          required: ["places"],
          additionalProperties: false,
        },
      },
    };
    const json = await callGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "suggest_day_plan" } },
    });
    if (json?.__err) return { places: [], error: json.__err };
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) return { places: [], error: "NO_TOOL_CALL" };
    try {
      const parsed = JSON.parse(call.function.arguments);
      return {
        title: parsed.title,
        places: Array.isArray(parsed.places) ? parsed.places.slice(0, 8) : [],
      };
    } catch {
      return { places: [], error: "PARSE_ERROR" };
    }
  });

// ---------- Caption a photo ----------

interface CaptionInput {
  imageUrl: string;
  context?: string;
  lang: "th" | "en";
}

export interface CaptionResult {
  caption: string;
  error?: string;
}

export const captionPhoto = createServerFn({ method: "POST" })
  .inputValidator((input: CaptionInput) => {
    if (!input.imageUrl) throw new Error("imageUrl required");
    return input;
  })
  .handler(async ({ data }): Promise<CaptionResult> => {
    const langInstr =
      data.lang === "th"
        ? "ตอบเป็นภาษาไทย เขียนคำบรรยายหนึ่งประโยค สั้น กระชับ บรรยากาศการท่องเที่ยว"
        : "Respond in English with a single, vivid one-sentence travel caption.";
    const sys = `You write short, evocative captions for travel photos. ${langInstr}`;
    const userText = data.context
      ? `Context: ${data.context}. Write one short caption for this photo.`
      : "Write one short caption for this photo.";
    const json = await callGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: data.imageUrl } },
          ],
        },
      ],
    });
    if (json?.__err) return { caption: "", error: json.__err };
    const text = json.choices?.[0]?.message?.content;
    const caption = typeof text === "string" ? text.trim().replace(/^["']|["']$/g, "") : "";
    return { caption };
  });
