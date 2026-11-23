import type { OptionKey } from "@/data/strategy";

export interface OrionBand { jev: number; low: number; high: number }

export interface OrionResult {
  id: string;
  status: "assessed" | "unavailable";
  assessedAt: string;
  /** Hash of everything that fed the judgment; a change triggers re-scoring. */
  inputHash: string;
  /** Why it could not be assessed. Never papered over with invented numbers. */
  error?: string;
  verdict?: "recommend" | "tie" | "no-viable-option" | "insufficient-information";
  /** The engine's pick. Absent for ties and unassessed entries. */
  pick?: OptionKey;
  tier?: string;
  /** Adjusted score gap to the runner-up (engine units, roughly -10..+10). */
  gap?: number | null;
  confidence?: number;
  needsReview?: boolean;
  stable?: boolean;
  bands?: Record<OptionKey, OrionBand | undefined>;
  /** Score used for ranking "worth looking into": JEV of pursuing now. */
  nowScore?: number | null;
  reasons?: string[];
  flips?: string[];
  drivers?: { label: string; impact: number }[];
  blocked?: { option: OptionKey; reason: string }[];
  /** Raw Jev judgments, kept so re-weighting never needs another model call. */
  scores?: { optionId: OptionKey; factorId: string; value: number; probabilityConfidence: number }[];
}

export interface OrionData {
  runAt: string | null;
  running: boolean;
  /** True on a deployed snapshot: nothing can be refreshed or re-ranked from here. */
  readOnly?: boolean;
  server: { url: string; reachable: boolean; model?: string } | null;
  weightsHash: string | null;
  dossier: { builtAt: string; brief: string; sources: { path: string; used: string; found: boolean }[]; facts: Record<string, string | number | null> } | null;
  error: string | null;
  results: Record<string, OrionResult>;
}

export const EMPTY_ORION: OrionData = {
  runAt: null, running: false, server: null, weightsHash: null, dossier: null, error: null, results: {},
};
