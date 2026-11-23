import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { opportunities } from "../data/opportunities";
import { FACTORS, OPTIONS } from "../data/strategy";
import { buildDossier } from "./dossier";
import { contextFor, fetchScores, judge, loadEngine, orionDir, optionLabels, type Score } from "./orion-assess";

const hasOrion = existsSync(path.join(orionDir(), "src/decision-engine/index.ts"));
const t = hasOrion ? test : test.skip;

const mk = (v: Record<string, Record<string, number>>, conf = 0.8): Score[] =>
  OPTIONS.flatMap((x) => FACTORS.map((f) => ({ optionId: x.key, factorId: f.id, value: v[x.key]?.[f.id] ?? 0, probabilityConfidence: conf })));
const all = (o: number, l: number, s: number) => ({
  now: Object.fromEntries(FACTORS.map((f) => [f.id, o])), later: Object.fromEntries(FACTORS.map((f) => [f.id, l])), skip: Object.fromEntries(FACTORS.map((f) => [f.id, s])),
});

test("weights sum to 1 and option labels fit Orion's 80-char limit", () => {
  expect(FACTORS.reduce((a, f) => a + f.weight, 0)).toBeCloseTo(1, 6);
  for (const f of FACTORS) expect(f.label.length).toBeLessThanOrEqual(40);
  for (const o of opportunities) for (const l of Object.values(optionLabels(o))) expect(l.length).toBeLessThanOrEqual(80);
});

test("dossier brief and every funder context fit Orion's 4000-char limit", async () => {
  const d = await buildDossier();
  expect(d.brief.length).toBeLessThan(3000);
  for (const o of opportunities) expect(contextFor(o, d.brief).length).toBeLessThanOrEqual(4000);
});

t("clear lead for 'now' is recommended", async () => {
  const e = await loadEngine();
  const r = judge(e, opportunities.find((o) => o.access === "open")!, mk(all(7, 1, -6)));
  expect(r.verdict).toBe("recommend");
  expect(r.pick).toBe("now");
  expect(r.tier).toBe("Look into now");
});

t("restricted funders can never be 'now'", async () => {
  const e = await loadEngine();
  const r = judge(e, opportunities.find((o) => o.access === "restricted")!, mk(all(9, 2, -5)));
  expect(r.pick).not.toBe("now");
  expect(r.blocked?.some((b) => b.option === "now")).toBe(true);
  expect(r.nowScore).toBeNull();
});

t("all-zero judgments are declined, never ranked", async () => {
  const e = await loadEngine();
  const r = judge(e, opportunities[0], mk(all(0, 0, 0), 0.15));
  expect(r.status).toBe("unavailable");
  expect(r.pick).toBeUndefined();
});

t("a strong penalty on one factor does not sink an otherwise dominant option", async () => {
  const e = await loadEngine();
  const o = opportunities.find((x) => x.access === "open")!;
  const s = mk({ now: { odds: -8, cash: 9, speed: 9, thesis: 9, entity: 9, signal: 9, terms: 9, focus: 9 }, later: all(2, 2, 2).later, skip: all(0, 0, 0).skip });
  expect(judge(e, o, s).pick).toBe("now");
});

test("fetchScores waits out Orion's 429 using Retry-After, then succeeds", async () => {
  const good = OPTIONS.flatMap((x) => FACTORS.map((f) => ({ optionId: x.key, factorId: f.id, value: 1, probabilityConfidence: 0.5 })));
  let calls = 0;
  const waits: number[] = [];
  const fetcher = (async () => {
    calls++;
    return calls < 3
      ? new Response(JSON.stringify({ error: "Too many requests" }), { status: 429, headers: { "retry-after": "7" } })
      : Response.json({ scores: good, ai: { model: "m" } });
  }) as unknown as typeof fetch;
  const r = await fetchScores("http://x", opportunities[0], "ctx", fetcher, async (ms) => { waits.push(ms); });
  expect(calls).toBe(3);
  expect(waits).toEqual([7000, 7000]);
  expect(r.scores.length).toBe(24);
});

test("fetchScores rejects a malformed score set instead of trusting it", async () => {
  const fetcher = (async () => Response.json({ scores: [{ optionId: "now", factorId: "odds", value: 99, probabilityConfidence: 2 }] })) as unknown as typeof fetch;
  await expect(fetchScores("http://x", opportunities[0], "ctx", fetcher)).rejects.toThrow(/incomplete or out-of-range/);
});
