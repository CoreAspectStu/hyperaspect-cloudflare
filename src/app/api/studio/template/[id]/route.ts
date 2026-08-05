import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/template-store/store";

/**
 * GET /api/studio/template/[id] — load a template (native, no relay).
 * Replaces the legacy proxy /api/template-load → render.coreaspectai.com, and the
 * broken /api/manifest (which 404'd on the relay). Returns the template + its
 * scene model + slots; the composition HTML is fetched separately when rendering.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const template = await getStore().get(id);
  if (!template) {
    return NextResponse.json(
      { error: `template not found: ${id}` },
      { status: 404 },
    );
  }
  return NextResponse.json(template);
}
