export type Region = "US" | "EU" | "UK" | "APAC";
export type Kind = "vc" | "accelerator" | "grant" | "angel" | "strategic";
export type Stage = "pre-seed" | "seed" | "grant";
export type Sector =
  | "dev-tools"
  | "ai"
  | "ai-safety"
  | "security"
  | "open-source"
  | "generalist";
export type Access = "open" | "conditional" | "restricted";

export interface Opportunity {
  id: string;
  name: string;
  region: Region;
  country: string;
  kind: Kind;
  stages: Stage[];
  sectors: Sector[];
  /** Approximate cheque / award in USD; null when not publicly stated. */
  ticket: [number, number] | null;
  /** Can a team from outside the funder's region apply? */
  access: Access;
  /** What to confirm before outreach (eligibility, entity, residency). */
  caveat: string;
  /** Optional one-line pitch angle: your own, per funder. */
  angle?: string;
  url: string;
}

export type PipelineStatus =
  | "new"
  | "researching"
  | "intro-needed"
  | "contacted"
  | "meeting"
  | "passed"
  | "won";

export interface PipelineEntry {
  status: PipelineStatus;
  note: string;
  updated: string;
}

export interface ScoreBreakdown {
  sector: number;
  stage: number;
  ticket: number;
  access: number;
  total: number;
}
