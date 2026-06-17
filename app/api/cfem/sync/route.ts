import { NextResponse } from "next/server";

import { triggerCfemSync } from "@/lib/n8n/triggers";

export const runtime = "nodejs";

export async function POST() {
  const result = await triggerCfemSync();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
