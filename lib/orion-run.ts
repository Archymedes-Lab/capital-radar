import { spawn } from "node:child_process";
import path from "node:path";
import { readOrion } from "./orionStore";
import type { OrionData } from "./orion-types";

let running: Promise<OrionData> | null = null;
export const orionRunning = () => running !== null;

/**
 * Runs scripts/orion-rank.ts in its own Bun process. Orion's engine is TypeScript
 * with .ts imports, so it runs under Bun rather than being bundled into Next.
 * Single-flight: the button, the scheduler and the Exa hook share one run.
 */
export function runOrionRank(opts: { force?: boolean } = {}): Promise<OrionData> {
  running ??= new Promise<OrionData>((resolve) => {
    const bun = process.env.BUN_PATH ?? "bun";
    const child = spawn(bun, [path.join(process.cwd(), "scripts/orion-rank.ts"), ...(opts.force ? ["--force"] : [])], {
      cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"],
    });
    let err = "";
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", (e) => { err = `Could not start Bun (${e.message}). Set BUN_PATH.`; resolve(readOrion().then((d) => ({ ...d, error: err }))); });
    child.on("close", async () => resolve(await readOrion()));
  }).finally(() => { running = null; });
  return running;
}
