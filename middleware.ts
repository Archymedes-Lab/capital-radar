import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, valid } from "@/lib/session";

/**
 * The data includes the company dossier (revenue, investor feedback), so everything sits behind a login.
 * Needs SITE_PASSWORD and SESSION_SECRET. On Vercel it fails closed without them; locally it is open.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const password = process.env.SITE_PASSWORD;
  const secret = process.env.SESSION_SECRET;

  if (!password || !secret) {
    if (process.env.VERCEL) return new NextResponse("Not configured", { status: 503 });
    return NextResponse.next(); // local development
  }
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();
  if (await valid(req.cookies.get(COOKIE)?.value, secret)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
