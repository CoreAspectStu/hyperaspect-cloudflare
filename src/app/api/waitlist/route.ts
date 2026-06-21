import { NextRequest, NextResponse } from 'next/server';

// Waitlist endpoint — logs emails to Workers logs (visible via wrangler tail)
// For persistent storage, would need Cloudflare KV or D1 binding

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { message: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // Log the email — visible in Cloudflare dashboard > Workers > Logs
    console.log(`WAITLIST_SIGNUP: ${email} at ${new Date().toISOString()}`);

    return NextResponse.json(
      { message: "You're on the list! We'll be in touch soon." },
      { status: 200 }
    );
  } catch (error) {
    console.error('Waitlist error:', error);
    return NextResponse.json(
      { message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
