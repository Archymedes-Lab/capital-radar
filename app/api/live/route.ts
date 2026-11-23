import { NextResponse } from "next/server";
import { readLive } from "@/lib/liveStore";
import { readOnly } from "@/lib/mode";

export const dynamic = "force-dynamic";

export async function GET() {
  const live = await readLive();
  return NextResponse.json({ ...live, enabled: Boolean(process.env.EXA_API_KEY) && !readOnly(), readOnly: readOnly() });
}
