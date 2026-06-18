import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // In a real application, you would process the audio file here
  // For now, we return a mock transcript.
  return NextResponse.json({ text: 'Hi, I want to create a promotional video for my new product launch next week.' });
}