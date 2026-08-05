import { NextResponse } from "next/server";
import { getStore } from "@/lib/template-store/store";

/**
 * GET /api/studio/templates — list the template library (native, no relay).
 * Replaces the legacy proxy /api/template-list → render.coreaspectai.com.
 */
export async function GET() {
  const summaries = await getStore().list();
  return NextResponse.json({ templates: summaries });
}
