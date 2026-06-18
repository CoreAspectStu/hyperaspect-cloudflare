import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ message: 'Job ID is required.' }, { status: 400 });
  }

  // Simulate progress for demo purposes
  const progress = Math.floor(Math.random() * 101); // 0-100
  let status = 'processing';
  let message = `Rendering scenes... (Progress: ${progress}%)`;

  if (progress === 100) {
    status = 'completed';
    message = 'Video generation complete!';
  } else if (progress < 20) {
    message = 'Initializing...';
  } else if (progress < 50) {
    message = 'Analyzing input...';
  } else if (progress < 80) {
    message = 'Composing scenes...';
  }

  return NextResponse.json({ status, progress, message });
}