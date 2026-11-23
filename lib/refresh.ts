import { opportunities } from "@/data/opportunities";
import { exaSearch, hostOf, toHits, type Fetcher } from "./exa";
import { readLive, writeLive } from "./liveStore";
import type { Candidate, LiveData } from "./live-types";
import type { Opportunity, Region } from "./types";

const DISCOVERY: { region: Region; query: string }[] = [
  { region: "US", query: "pre-seed fund or accelerator accepting applications for AI developer tools and open source startups, United States" },
  { region: "EU", query: "grant or pre-seed fund for open source AI and security startups in Europe, applications open" },
  { region: "UK", query: "UK pre-seed investor or grant for AI developer tooling startups accepting international founders" },
  { region: "APAC", query: "Asia Pacific accelerator or seed fund for AI developer tools startups, applications open" },
];

const HIGHLIGHTS = { highlights: { maxCharacters: 900, query: "funding amount, investment size, application deadline, eligibility, cohort dates" } };

let running: Promise<LiveData> | null = null;

/** Single-flight: concurrent callers (cron + button) share one run. */
export function refreshLive(opts: { apiKey?: string; fetcher?: Fetcher } = {}): Promise<LiveData> {
  running ??= run(opts).finally(() => { running = null; });
  return running;
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

async function run({ apiKey = process.env.EXA_API_KEY, fetcher }: { apiKey?: string; fetcher?: Fetcher }): Promise<LiveData> {
  if (!apiKey) throw new Error("EXA_API_KEY is not set");
  const prev = await readLive();
  const next: LiveData = { ...prev, signals: { ...prev.signals }, failed: 0, error: null };
  const now = new Date().toISOString();
  let lastErr: string | null = null;

  const known = new Set(opportunities.map((o) => hostOf(o.url)));

  await pool<Opportunity>(opportunities, 4, async (o) => {
    try {
      const host = hostOf(o.url);
      const results = await exaSearch(apiKey, {
        query: `${o.name} funding amount application deadline eligibility`,
        type: "auto",
        numResults: 4,
        includeDomains: [host],
        contents: HIGHLIGHTS,
      }, fetcher);
      const hits = toHits(results);
      // A failed or empty lookup keeps the last good signal instead of erasing it.
      if (hits.length) next.signals[o.id] = { fetchedAt: now, hits };
    } catch (e) {
      next.failed++;
      lastErr = e instanceof Error ? e.message : String(e);
    }
  });

  const found = new Map<string, Candidate>();
  for (const p of prev.candidates) found.set(p.host, p);
  for (const d of DISCOVERY) {
    try {
      const results = await exaSearch(apiKey, {
        query: d.query, type: "auto", numResults: 8,
        startPublishedDate: new Date(Date.now() - 365 * 864e5).toISOString(),
        contents: HIGHLIGHTS,
      }, fetcher);
      for (const r of results) {
        const host = hostOf(r.url);
        if (!host || known.has(host) || found.has(host)) continue;
        found.set(host, {
          url: r.url, host, title: r.title?.trim() || host, region: d.region, foundAt: now,
          snippet: (r.highlights?.[0] ?? "").replace(/\s+/g, " ").slice(0, 240),
        });
      }
    } catch (e) {
      next.failed++;
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  next.candidates = [...found.values()].sort((a, b) => b.foundAt.localeCompare(a.foundAt)).slice(0, 60);

  const total = opportunities.length + DISCOVERY.length;
  next.refreshedAt = now;
  next.error = next.failed ? `${next.failed}/${total} lookups failed${lastErr ? `: ${lastErr}` : ""}` : null;
  await writeLive(next);
  // New signals feed Orion's context; unchanged funders are served from its cache.
  if (process.env.ORION_AUTO !== "off") void import("./orion-run").then((m) => m.runOrionRank()).catch(() => {});
  return next;
}

export function intervalHours(): number {
  const h = Number(process.env.EXA_REFRESH_HOURS ?? 24);
  return Number.isFinite(h) && h >= 1 ? h : 24;
}
