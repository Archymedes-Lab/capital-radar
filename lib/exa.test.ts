import { expect, test } from "bun:test";
import { pickSignals, toHits } from "./exa";
import { refreshLive } from "./refresh";

test("pickSignals keeps money/deadline sentences only", () => {
  const s = pickSignals(["We love founders. Applications close on 5 March 2027 for the next cohort. Invest up to $500K per team."]);
  expect(s.length).toBe(2);
  expect(s.join(" ")).not.toContain("love founders");
});

test("toHits drops results with no signal", () => {
  expect(toHits([{ url: "https://a.com", highlights: ["Just a tagline here, nothing else."] }])).toEqual([]);
});

test("refresh uses the injected fetcher and survives failures", async () => {
  process.env.LIVE_DATA_PATH = "/tmp/claude-1000/live-test.json";
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    if (calls % 5 === 0) return new Response("boom", { status: 500 });
    return Response.json({ results: [{ url: "https://new-fund.example/apply", title: "New Fund",
      highlights: ["Applications are open with a deadline of 1 Dec 2026 and cheques of $250K."] }] });
  }) as unknown as typeof fetch;
  const out = await refreshLive({ apiKey: "test", fetcher });
  expect(out.refreshedAt).not.toBeNull();
  expect(out.failed).toBeGreaterThan(0);
  expect(Object.keys(out.signals).length).toBeGreaterThan(0);
  expect(out.candidates.some((c) => c.host === "new-fund.example")).toBe(true);
});
