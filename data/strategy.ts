/**
 * How Orion judges a funder. Code owns weights and thresholds;
 * Jev supplies the per-option, per-factor judgments (Orion's own rule).
 *
 * Weights are example assumptions for an early, pre-revenue team. They are shown
 * in the UI and meant to be argued with: set them from your own situation.
 */
export const FACTORS = [
  { id: "odds", label: "Odds of a yes", weight: 0.20,
    why: "An early team with no pilots yet: a long shot costs time it does not have." },
  { id: "cash", label: "Cash vs the ask", weight: 0.14,
    why: "The plan needs the round; a small cheque helps only as one tranche." },
  { id: "speed", label: "Speed to money in the bank", weight: 0.12,
    why: "Slow money means thin runway." },
  { id: "thesis", label: "Fit with the product thesis", weight: 0.14,
    why: "Funders whose thesis matches the product give more than cash." },
  { id: "entity", label: "Works without forming a new entity", weight: 0.10,
    why: "Forming a new company abroad costs months and money before any cheque." },
  { id: "signal", label: "Traction and credibility it earns us", weight: 0.12,
    why: "Intros, design partners and validation count even without cash." },
  { id: "terms", label: "Terms if it works (dilution, strings)", weight: 0.08,
    why: "Judged only on the deal it would produce: founder-friendly terms keep the next round clean." },
  { id: "focus", label: "Founder time left to chase revenue", weight: 0.10,
    why: "A small team: any process that eats weeks must earn it." },
] as const;

export type OptionKey = "now" | "later" | "skip";

export const OPTIONS: { key: OptionKey; reversibility: number; tier: string }[] = [
  { key: "now", reversibility: 0.7, tier: "Look into now" },
  { key: "later", reversibility: 0.9, tier: "Park until revenue" },
  { key: "skip", reversibility: 0.6, tier: "Skip" },
];

export const TIER: Record<OptionKey | "tie" | "review", string> = {
  now: "Look into now",
  later: "Park until revenue",
  skip: "Skip",
  tie: "Too close to call",
  review: "Needs review",
};

export const STAKES = "significant" as const;
