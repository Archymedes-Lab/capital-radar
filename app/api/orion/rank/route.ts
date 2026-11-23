import { NextResponse } from "next/server";
import { readOnly } from "@/lib/mode";
import { runOrionRank } from "@/lib/orion-run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Ask Orion to (re)assess. Protected by REFRESH_SECRET when set. `?force=1` re-scores every funder. */
export async function POST(req: Request) {
  if (readOnly()) return NextResponse.json({ error: "This deployment is a read-only snapshot" }, { status: 405 });
  const secret = process.env.REFRESH_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const force = new URL(req.url).searchParams.get("force") === "1";
  return NextResponse.json({ ...(await runOrionRank({ force })), running: false });
}
