import { expect, test } from "bun:test";
import { opportunities } from "../data/opportunities";
import { score } from "./score";

test("scores stay within 0-100", () => {
  for (const o of opportunities) {
    const s = score(o);
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(100);
  }
});

test("ids are unique and urls are https", () => {
  const ids = new Set(opportunities.map((o) => o.id));
  expect(ids.size).toBe(opportunities.length);
  for (const o of opportunities) expect(o.url.startsWith("https://")).toBe(true);
});

test("every requested region is covered", () => {
  for (const r of ["US", "EU", "UK", "APAC"])
    expect(opportunities.some((o) => o.region === r)).toBe(true);
});

test("restricted access caps the score below an open equivalent", () => {
  const base = opportunities.find((o) => o.access === "open")!;
  const restricted = { ...base, access: "restricted" as const };
  expect(score(restricted).total).toBeLessThan(score(base).total);
});
