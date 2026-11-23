import { NextResponse } from "next/server";
import { readOnly } from "@/lib/mode";
import { orionRunning } from "@/lib/orion-run";
import { readOrion } from "@/lib/orionStore";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ...(await readOrion()), running: orionRunning(), readOnly: readOnly() });
}
