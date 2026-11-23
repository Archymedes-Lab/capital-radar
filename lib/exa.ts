import type { LiveHit } from "./live-types";

const BASE = process.env.EXA_BASE_URL ?? "https://api.exa.ai";

export type Fetcher = typeof fetch;

interface ExaResult {
  url: string;
  title?: string | null;
  publishedDate?: string | null;
  highlights?: string[];
}

export async function exaSearch(
  apiKey: string,
  body: Record<string, unknown>,
  fetcher: Fetcher = fetch,
): Promise<ExaResult[]> {
  const res = await fetcher(`${BASE}/search`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Exa ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { results?: ExaResult[] };
  return json.results ?? [];
}

const SIGNAL = /[$€£]\s?\d|\b\d[\d,.]*\s?(k|m|million|thousand)\b|deadline|apply by|applications? (open|close|are|will)|rolling|cohort|batch|closes?\b/i;

/** Keep only sentences that carry a money / deadline / status signal. */
export function pickSignals(highlights: string[] | undefined, max = 3): string[] {
  const out: string[] = [];
  for (const h of highlights ?? []) {
    for (const s of h.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/)) {
      const t = s.trim();
      if (t.length >= 20 && t.length <= 280 && SIGNAL.test(t) && !out.includes(t)) out.push(t);
      if (out.length >= max) return out;
    }
  }
  return out;
}

export function toHits(results: ExaResult[]): LiveHit[] {
  return results
    .map((r) => ({
      url: r.url,
      title: r.title?.trim() || r.url,
      published: r.publishedDate ?? null,
      snippets: pickSignals(r.highlights),
    }))
    .filter((h) => h.snippets.length > 0);
}

export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
