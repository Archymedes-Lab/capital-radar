import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { PROFILE } from "./profile";
import { FACTORS, OPTIONS, STAKES, TIER, type OptionKey } from "@/data/strategy";
import { fmtTicket } from "./score";
import type { LiveEntry } from "./live-types";
import type { OrionBand, OrionResult } from "./orion-types";
import type { Opportunity } from "./types";

/** Orion's deterministic engine, loaded from its own repo so the math is never re-implemented here. */
export interface Engine {
  scoreAll: (o: unknown[], f: unknown[]) => { optionId: string; jev: number; confidence: number }[];
  sensitivity: (o: unknown[], f: unknown[]) => { flips: { description: string }[]; dominantFactors: { label: string; impact: number }[]; stable: boolean };
  evaluatePolicy: (i: Record<string, unknown>) => {
    verdict: OrionResult["verdict"];
    recommendation: { optionId: string; confidence: number } | null;
    leader: { gap: number | null; confidence: number } | null;
    ranking: { optionId: string; score: number }[];
    blockedOptions: { optionId: string; reason: string }[];
    reasons: { text: string }[];
    needsReview: boolean;
  };
  uncertaintyBand: (o: unknown, f: unknown[]) => OrionBand;
  buildOptionsFromScores: (o: { id: string; label: string }[], f: unknown[], s: unknown[] | null, extras?: { reversibility?: Record<string, number> }) => unknown[];
  hasSignal: (o: unknown[]) => boolean;
}

export const orionDir = () => process.env.ORION_DIR ?? path.join(process.env.ARCHYMEDES_HOME ?? os.homedir(), "orion");
export const orionApi = () => (process.env.ORION_API ?? "http://127.0.0.1:3001").replace(/\/$/, "");

export async function loadEngine(dir = orionDir()): Promise<Engine> {
  const [eng, model] = await Promise.all([
    import(path.join(dir, "src/decision-engine/index.ts")),
    import(path.join(dir, "src/ai/model.ts")),
  ]);
  return { ...eng, buildOptionsFromScores: model.buildOptionsFromScores, hasSignal: model.hasSignal } as Engine;
}

const MAX_LABEL = 80;
const clip = (s: string) => (s.length <= MAX_LABEL ? s : `${s.slice(0, MAX_LABEL - 1)}…`);

export function optionLabels(o: Opportunity): Record<OptionKey, string> {
  const n = o.name.length > 46 ? `${o.name.slice(0, 45)}…` : o.name;
  return {
    now: clip(`Pursue ${n} now`),
    later: clip(`Park ${n} until revenue exists`),
    skip: clip(`Skip ${n}`),
  };
}

/** What Jev sees: the whole company dossier plus everything known about this one funder. Orion caps context at 4000 chars. */
export function contextFor(o: Opportunity, brief: string, live?: LiveEntry): string {
  const signals = (live?.hits ?? []).flatMap((h) => h.snippets).slice(0, 3).map((s) => `- ${s}`).join("\n");
  const funder = [
    `FUNDER: ${o.name} (${o.country}, ${o.region}). Type: ${o.kind}. Stages: ${o.stages.join("/")}. Typical cheque: ${fmtTicket(o.ticket)}. Sectors: ${o.sectors.join(", ")}.`,
    `ACCESS FOR A TEAM BASED IN ${PROFILE.base.toUpperCase()}: ${o.access}. ${o.caveat}`,
    o.angle ? `OUR ANGLE: ${o.angle}` : "",
    signals ? `RECENT PUBLIC SIGNALS (extracted, unverified):\n${signals}` : "",
  ].filter(Boolean).join("\n");
  const head = `DECISION: Should ${PROFILE.name} pursue ${o.name} for funding now, park it until revenue exists, or skip it? Judge each option on how well it serves ${PROFILE.name}'s real situation below, not on how prestigious the funder is.\n\n`;
  const full = `${head}${brief}\n\n${funder}`;
  return full.length <= 4000 ? full : `${head}${brief.slice(0, 4000 - head.length - funder.length - 4)}…\n\n${funder}`.slice(0, 4000);
}

export function hashInputs(o: Opportunity, context: string): string {
  return createHash("sha256").update(JSON.stringify([optionLabels(o), FACTORS.map((f) => f.label), context])).digest("hex").slice(0, 16);
}

export const weightsHash = () =>
  createHash("sha256").update(JSON.stringify([FACTORS.map((f) => [f.id, f.weight]), OPTIONS])).digest("hex").slice(0, 12);

export type Score = NonNullable<OrionResult["scores"]>[number];

const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One Orion decision: Jev scores every option × factor in a single batched request.
 * Orion rate-limits each client (60/min by default) and answers 429/503 with Retry-After;
 * we wait that long instead of failing the funder.
 */
export async function fetchScores(
  api: string, o: Opportunity, context: string, fetcher: typeof fetch = fetch, sleep: (ms: number) => Promise<unknown> = sleepMs,
): Promise<{ scores: Score[]; model?: string }> {
  const labels = optionLabels(o);
  const init = (): RequestInit => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      context, stakes: STAKES,
      options: OPTIONS.map((x) => ({ id: x.key, label: labels[x.key] })),
      factors: FACTORS.map((f) => ({ id: f.id, label: f.label })),
    }),
    signal: AbortSignal.timeout(90_000),
  });
  let res = await fetcher(`${api}/decision/score-factors`, init());
  for (let attempt = 1; attempt <= 4 && (res.status === 429 || res.status === 503); attempt++) {
    const wait = Math.min(65, Math.max(1, Number(res.headers.get("retry-after")) || 2 ** attempt)) * 1000;
    await sleep(wait);
    res = await fetcher(`${api}/decision/score-factors`, init());
  }
  const body = (await res.json().catch(() => ({}))) as { scores?: Score[]; ai?: { model?: string }; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Orion ${res.status}`);
  const scores = body.scores ?? [];
  const ok = scores.length === OPTIONS.length * FACTORS.length
    && scores.every((s) => OPTIONS.some((x) => x.key === s.optionId) && FACTORS.some((f) => f.id === s.factorId)
      && Number.isFinite(s.value) && Math.abs(s.value) <= 10 && s.probabilityConfidence >= 0 && s.probabilityConfidence <= 1);
  if (!ok) throw new Error("Orion returned an incomplete or out-of-range score set");
  return { scores, model: body.ai?.model };
}

/** Runs Orion's engine over stored judgments. No network; re-runs freely when weights change. */
export function judge(engine: Engine, o: Opportunity, scores: Score[]): Omit<OrionResult, "id" | "assessedAt" | "inputHash"> {
  const labels = optionLabels(o);
  const options = OPTIONS.map((x) => ({ id: x.key, label: labels[x.key] }));
  const factors = FACTORS.map((f) => ({ id: f.id, label: f.label, weight: f.weight, provenance: "MODEL_ASSUMED" }));
  const built = engine.buildOptionsFromScores(options, factors, scores, {
    reversibility: Object.fromEntries(OPTIONS.map((x) => [x.key, x.reversibility])),
  });

  // Deterministic rule from the data, not from the model: restricted funders cannot be pursued now.
  const constraints = o.access === "restricted"
    ? [{ id: "needs-local-entity", name: "Needs a local entity we do not have", type: "HARD", optionIds: ["now"] }]
    : [];

  const scored = engine.scoreAll(built, factors);
  const sens = engine.sensitivity(built, factors);
  const policy = engine.evaluatePolicy({
    scored, options: built, factors, constraints, sensitivity: sens,
    safety: "normal", stakes: STAKES, hasSignal: engine.hasSignal(built),
  });

  const bands = Object.fromEntries(
    built.map((b) => {
      const band = engine.uncertaintyBand(b, factors);
      return [(b as { id: string }).id, { jev: r2(band.jev), low: r2(band.low), high: r2(band.high) }];
    }),
  ) as Record<OptionKey, OrionBand>;

  const pick = policy.verdict === "recommend" ? (policy.recommendation?.optionId as OptionKey) : undefined;
  const tier = pick ? TIER[pick] : policy.verdict === "tie" ? TIER.tie : policy.verdict === "no-viable-option" ? TIER.review : undefined;
  const now = policy.ranking.find((x) => x.optionId === "now");

  return {
    status: policy.verdict === "insufficient-information" ? "unavailable" : "assessed",
    error: policy.verdict === "insufficient-information" ? "Orion had no usable estimates, so it declines to rank this funder." : undefined,
    verdict: policy.verdict,
    pick, tier,
    gap: policy.leader?.gap ?? null,
    confidence: policy.leader?.confidence ?? policy.recommendation?.confidence,
    needsReview: policy.needsReview,
    stable: sens.stable,
    bands,
    nowScore: now ? r2(now.score) : null,
    reasons: policy.reasons.map((x) => x.text).slice(0, 4),
    flips: sens.flips.map((f) => f.description).slice(0, 2),
    drivers: sens.dominantFactors.slice(0, 3).map((d) => ({ label: d.label, impact: d.impact })),
    blocked: policy.blockedOptions.map((b) => ({ option: b.optionId as OptionKey, reason: b.reason })),
    scores,
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
