import { PROFILE } from "./profile";
import type { Opportunity, ScoreBreakdown } from "./types";

/**
 * Transparent 0–100 fit score. Each component is shown in the UI so the number
 * can be argued with. Weights: sector 40, stage 25, ticket 20, access 15.
 */
export function score(o: Opportunity, ask = PROFILE.ask): ScoreBreakdown {
  const specific = PROFILE.sectors.filter((s) => o.sectors.includes(s)).length;
  const sector = o.sectors.includes("generalist") && specific === 0
    ? 15
    : Math.min(40, Math.round((specific / 3) * 40));

  const stage = o.stages.includes(PROFILE.stage)
    ? 25
    : o.stages.includes("grant")
      ? 20
      : o.stages.includes("seed")
        ? 10
        : 0;

  let ticket = 8; // unknown size: neutral-low
  if (o.ticket) {
    const [lo, hi] = o.ticket;
    if (ask >= lo && ask <= hi) ticket = 20;
    else if (hi >= ask * 0.5 && lo <= ask) ticket = 14;
    else if (hi >= ask * 0.2) ticket = 10; // useful as one tranche of the round
    else ticket = 5;
  }

  const access = o.access === "open" ? 15 : o.access === "conditional" ? 8 : 0;

  return { sector, stage, ticket, access, total: sector + stage + ticket + access };
}

export function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

export function fmtTicket(t: Opportunity["ticket"]): string {
  return t ? (t[0] === t[1] ? fmtUsd(t[0]) : `${fmtUsd(t[0])}–${fmtUsd(t[1])}`) : "Not stated";
}
