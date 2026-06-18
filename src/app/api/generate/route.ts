import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const { input, type, options } = await req.json();

  // In a real application, this would kick off a job
  const jobId = uuidv4();

  return NextResponse.json({ jobId, status: 'queued', estimatedTime: 120 });
}