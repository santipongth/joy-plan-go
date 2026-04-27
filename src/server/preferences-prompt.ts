export interface PreferencesLike {
  interests?: string[];
  budget?: string;
  pace?: string;
  companions?: string;
  travelStyle?: string[];
  accommodation?: string;
  rhythm?: string[];
  otherNeeds?: string;
}

function dedupeCI(items: (string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    if (!raw) continue;
    const s = String(raw).trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function buildPreferencesBlock(p: PreferencesLike): string {
  const lines: string[] = [];
  const interests = dedupeCI(p.interests || []);
  const styles = dedupeCI(p.travelStyle || []).filter(
    (s) => !interests.some((i) => i.toLowerCase() === s.toLowerCase()),
  );
  let rhythms = dedupeCI(p.rhythm || []);
  const hasEarly = rhythms.some((r) => r.toLowerCase().indexOf("early") !== -1);
  const hasLate = rhythms.some((r) => r.toLowerCase().indexOf("late") !== -1);
  if (hasEarly && hasLate) rhythms = ["Flexible (mixed early starts and late nights)"];
  const otherNeeds = (p.otherNeeds || "").trim().slice(0, 1000);

  if (p.companions) lines.push(`- Travel companions: ${p.companions}`);
  if (styles.length) lines.push(`- Travel style: ${styles.join(", ")}`);
  if (interests.length) lines.push(`- Interests: ${interests.join(", ")}`);
  if (p.budget) lines.push(`- Budget: ${p.budget}`);
  if (p.pace) lines.push(`- Pace: ${p.pace}`);
  if (p.accommodation) lines.push(`- Accommodation: ${p.accommodation}`);
  if (rhythms.length) lines.push(`- Day rhythm: ${rhythms.join(", ")}`);
  if (otherNeeds) lines.push(`- Other needs: ${otherNeeds}`);

  if (!lines.length) return "";
  return `\n\nUser Preferences:\n${lines.join("\n")}\n\nStrictly respect these preferences. If two conflict, prioritise the more specific one and briefly note the trade-off in the day title or a place description.`;
}
