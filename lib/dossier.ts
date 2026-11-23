import { promises as fs } from "node:fs";
import path from "node:path";
import { PROFILE } from "./profile";

/**
 * The company context handed to Orion with every judgment. It is read from a plain-text file you keep outside the
 * repo (DOSSIER_FILE), so your raise, numbers and investor feedback never need to be committed. Without that file the
 * example in data/dossier.example.md is used.
 */
export interface Dossier {
  builtAt: string;
  brief: string;
  facts: Record<string, string | number | null>;
  sources: { path: string; used: string; found: boolean }[];
}

const EXAMPLE = path.join(process.cwd(), "data/dossier.example.md");

async function read(p: string): Promise<string | null> {
  try { return await fs.readFile(p, "utf8"); } catch { return null; }
}

export async function buildDossier(): Promise<Dossier> {
  const own = process.env.DOSSIER_FILE;
  const ownText = own ? await read(own) : null;
  const text = ownText ?? (await read(EXAMPLE)) ?? `COMPANY: ${PROFILE.name}, ${PROFILE.tagline}, based in ${PROFILE.base}.`;
  const sources: Dossier["sources"] = [];
  if (own) sources.push({ path: own, used: "company dossier", found: ownText !== null });
  sources.push({ path: "data/dossier.example.md", used: "example dossier (used when DOSSIER_FILE is not set)", found: ownText === null });
  const brief = text.split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
  return {
    builtAt: new Date().toISOString(),
    brief,
    facts: { raise: PROFILE.ask, revenueUsd: PROFILE.revenue },
    sources,
  };
}
