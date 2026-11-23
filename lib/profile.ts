import type { Sector, Stage } from "./types";

/**
 * The investee: who is raising. This is an example; replace it with your own company.
 * The full narrative Orion judges against lives in your dossier file (see lib/dossier.ts).
 */
export const PROFILE = {
  name: "Example Labs",
  tagline: "Open-source developer tools",
  base: "Nairobi, Kenya",
  stage: "pre-seed" as Stage,
  ask: 500_000,
  revenue: 0,
  lead: ["Example CLI (shipped, open source)", "Example Cloud (beta)"],
  sectors: ["dev-tools", "ai", "open-source"] as Sector[],
  traction: "Replace with your measured traction (downloads, active users, design partners)",
  bar: "Replace with the bar investors have told you to clear",
};
