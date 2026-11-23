import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { COOKIE, MAX_AGE_S, issue, safeNext } from "@/lib/session";

export const dynamic = "force-dynamic";

// Best-effort throttle: per server instance, so it slows guessing rather than guaranteeing a cap.
const fails = new Map<string, { n: number; first: number }>();
const WINDOW = 15 * 60_000, LIMIT = 5;

const digest = (s: string) => createHash("sha256").update(s).digest();

export async function POST(req: Request) {
  const password = process.env.SITE_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  const form = await req.formData().catch(() => null);
  const next = safeNext(String(form?.get("next") ?? "/"));
  const back = (error: string, status = 303) => {
    const u = new URL("/login", req.url);
    u.searchParams.set("error", error);
    if (next !== "/") u.searchParams.set("next", next);
    return NextResponse.redirect(u, status);
  };
  if (!password || !secret) return new NextResponse("Not configured", { status: 503 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const now = Date.now();
  const rec = fails.get(ip);
  if (rec && now - rec.first > WINDOW) fails.delete(ip);
  if ((fails.get(ip)?.n ?? 0) >= LIMIT) return back("locked");

  const given = String(form?.get("password") ?? "");
  // Hash both sides so lengths match and the comparison is constant-time.
  if (!timingSafeEqual(digest(given), digest(password))) {
    const cur = fails.get(ip) ?? { n: 0, first: now };
    fails.set(ip, { n: cur.n + 1, first: cur.first });
    await new Promise((r) => setTimeout(r, 700)); // slows online guessing
    return back("wrong");
  }
  fails.delete(ip);

  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set(COOKIE, await issue(secret), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: MAX_AGE_S,
    secure: (req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")) === "https",
  });
  return res;
}
