import { NextResponse } from "next/server";
import { readOnly } from "@/lib/mode";
import { refreshLive } from "@/lib/refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Manual / external-cron trigger. If REFRESH_SECRET is set it must be sent as a bearer token. */
export async function POST(req: Request) {
  if (readOnly()) return NextResponse.json({ error: "This deployment is a read-only snapshot" }, { status: 405 });
  const secret = process.env.REFRESH_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.EXA_API_KEY)
    return NextResponse.json({ error: "EXA_API_KEY is not set" }, { status: 503 });
  try {
    return NextResponse.json(await refreshLive());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "refresh failed" }, { status: 500 });
  }
}
