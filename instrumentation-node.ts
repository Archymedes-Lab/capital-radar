/** Starts the periodic Exa refresh and Orion re-rank inside the long-running Node server. */
export async function startScheduler() {
  if (process.env.EXA_SCHEDULER === "off" || process.env.VERCEL || process.env.READ_ONLY === "1") return;
  const g = globalThis as { __invScheduler?: boolean };
  if (g.__invScheduler) return;
  g.__invScheduler = true;

  const { refreshLive, intervalHours } = await import("./lib/refresh");
  const { readLive } = await import("./lib/liveStore");

  // Hourly tick; only refresh once the data is older than the interval, so
  // restarts and dev reloads don't burn Exa credits.
  const tick = async () => {
    if (process.env.ORION_AUTO !== "off") {
      const { readOrion } = await import("./lib/orionStore");
      const { runOrionRank } = await import("./lib/orion-run");
      const { runAt } = await readOrion();
      if (!runAt || Date.now() - Date.parse(runAt) > intervalHours() * 3_600_000) void runOrionRank().catch(() => {});
    }
    if (!process.env.EXA_API_KEY) return;
    const { refreshedAt } = await readLive();
    const age = refreshedAt ? Date.now() - Date.parse(refreshedAt) : Infinity;
    if (age < intervalHours() * 3_600_000) return;
    try { await refreshLive(); console.log("[exa] refresh complete"); }
    catch (e) { console.error("[exa] refresh failed:", e instanceof Error ? e.message : e); }
  };
  setTimeout(tick, 5_000).unref();
  setInterval(tick, 3_600_000).unref();
}
