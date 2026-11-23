/**
 * Asks Orion what is worth looking into.
 *   bun scripts/orion-rank.ts [--force] [--only <id>]
 *
 * Jev (via the Orion server) judges each funder against the full Archymedes
 * dossier; Orion's deterministic engine decides. Judgments are cached by input
 * hash, so re-runs only spend model calls when a funder's facts, live signals
 * or the dossier actually changed — and weight changes need no calls at all.
 */
import { opportunities } from "../data/opportunities";
import { buildDossier } from "../lib/dossier";
import { readLive } from "../lib/liveStore";
import { contextFor, fetchScores, hashInputs, judge, loadEngine, orionApi, orionDir, weightsHash } from "../lib/orion-assess";
import { readOrion, writeOrion } from "../lib/orionStore";
import type { OrionData, OrionResult } from "../lib/orion-types";

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const MAX_AGE_MS = 14 * 864e5;

const api = orionApi();
const prev = await readOrion();
const base: OrionData = { ...prev, running: false, weightsHash: weightsHash(), error: null };

let reachable = false;
let model: string | undefined;
try {
  const h = await fetch(`${api}/health`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json()) as { jev?: boolean; aiConfigured?: boolean };
  reachable = Boolean(h.aiConfigured);
  if (!reachable) base.error = "Orion server is up but has no AI configured";
} catch {
  base.error = `Orion server not reachable at ${api}. Start it with: cd ~/orion && bun run server`;
}
base.server = { url: api, reachable };

if (!reachable) {
  await writeOrion(base);
  console.error(`[orion] ${base.error}`);
  process.exit(2);
}

const engine = await loadEngine(orionDir());
const dossier = await buildDossier();
const live = await readLive();
const results: Record<string, OrionResult> = { ...prev.results };
let called = 0, failed = 0;
const now = new Date().toISOString();

const todo = opportunities.filter((o) => !only || o.id === only);
let i = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (i < todo.length) {
    const o = todo[i++];
    const context = contextFor(o, dossier.brief, live.signals[o.id]);
    const inputHash = hashInputs(o, context);
    const cached = results[o.id];
    const fresh = cached?.scores && cached.inputHash === inputHash && Date.now() - Date.parse(cached.assessedAt) < MAX_AGE_MS;
    try {
      let scores = fresh ? cached.scores! : null;
      let assessedAt = cached?.assessedAt ?? now;
      if (!scores || force) {
        ({ scores, model } = await fetchScores(api, o, context));
        called++;
        assessedAt = now;
      }
      results[o.id] = { id: o.id, assessedAt, inputHash, ...judge(engine, o, scores!) };
      console.log(`[orion] ${o.id.padEnd(22)} ${results[o.id].tier ?? results[o.id].verdict}`);
    } catch (e) {
      failed++;
      const error = e instanceof Error ? e.message : String(e);
      // Keep the last good assessment if there is one; otherwise say so plainly.
      results[o.id] = cached?.status === "assessed"
        ? { ...cached, error: `Refresh failed, showing the previous assessment: ${error}` }
        : { id: o.id, status: "unavailable", assessedAt: now, inputHash, error };
      console.error(`[orion] ${o.id}: ${error}`);
    }
  }
}));

await writeOrion({
  ...base,
  runAt: now,
  server: { url: api, reachable, model },
  dossier: { builtAt: dossier.builtAt, brief: dossier.brief, sources: dossier.sources, facts: dossier.facts },
  error: failed ? `${failed} of ${todo.length} funders could not be scored` : null,
  results,
});
console.log(`[orion] done: ${todo.length} funders, ${called} model calls, ${failed} failed`);
