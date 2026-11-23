import { expect, test } from "bun:test";
import { issue, safeNext, valid, MAX_AGE_S } from "./session";

test("a fresh token is valid; wrong secret, tampering, expiry and junk are not", async () => {
  const t = await issue("s3cret", 1_000);
  expect(await valid(t, "s3cret", 2_000)).toBe(true);
  expect(await valid(t, "other", 2_000)).toBe(false);
  const [exp, sig] = t.split(".");
  expect(await valid(`${Number(exp) + 999_999}.${sig}`, "s3cret", 2_000)).toBe(false); // extend expiry
  expect(await valid(t, "s3cret", 1_000 + MAX_AGE_S * 1000 + 1)).toBe(false); // expired
  for (const junk of [undefined, "", "abc", "1.2.3", "x.y", `${exp}.`]) expect(await valid(junk, "s3cret", 2_000)).toBe(false);
});

test("safeNext only allows same-site paths", () => {
  expect(safeNext("/api/orion")).toBe("/api/orion");
  for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "evil", "", null, undefined]) expect(safeNext(bad as string)).toBe("/");
});
