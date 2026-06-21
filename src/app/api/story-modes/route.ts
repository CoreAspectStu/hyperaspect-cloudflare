import { NextResponse } from "next/server";
import { STORY_MODES } from "@/lib/story-modes";

export async function GET() {
  return NextResponse.json({ modes: STORY_MODES });
}
