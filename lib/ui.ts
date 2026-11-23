import type { Access, Kind, PipelineStatus } from "./types";

export const KIND_LABEL: Record<Kind, string> = {
  vc: "VC", accelerator: "Accelerator", grant: "Grant", angel: "Angel", strategic: "Strategic",
};
export const ACCESS_LABEL: Record<Access, string> = {
  open: "Open", conditional: "Conditional", restricted: "Local entity",
};
export const ACCESS_LONG: Record<Access, string> = {
  open: "Open to teams from abroad", conditional: "Conditional — confirm eligibility", restricted: "Needs a local entity",
};
export const STATUSES: { v: PipelineStatus; label: string }[] = [
  { v: "new", label: "New" },
  { v: "researching", label: "Researching" },
  { v: "intro-needed", label: "Needs intro" },
  { v: "contacted", label: "Contacted" },
  { v: "meeting", label: "Meeting" },
  { v: "passed", label: "Passed" },
  { v: "won", label: "Won" },
];

// Ticket axis: log scale, $1K → $2.5M.
const LO = Math.log10(1_000);
const HI = Math.log10(2_500_000);
export const axisPos = (usd: number) =>
  Math.min(100, Math.max(0, ((Math.log10(Math.max(usd, 1_000)) - LO) / (HI - LO)) * 100));
