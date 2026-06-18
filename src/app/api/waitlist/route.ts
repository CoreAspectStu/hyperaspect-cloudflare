import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

const DATA_DIR = path.join(process.cwd(), 'data');
const WAITLIST_FILE = path.join(DATA_DIR, 'waitlist.txt');

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ message: 'Invalid email address.' }, { status: 400 });
    }

    // Ensure data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });

    let existingEmails: string[] = [];
    try {
      const content = await fs.readFile(WAITLIST_FILE, 'utf-8');
      existingEmails = content.split('\\n')
                               .map(line => line.split(',')[0])
                               .filter(Boolean); // Filter out empty strings
    } catch (readError: any) {
      if (readError.code !== 'ENOENT') { // Ignore file not found error
        console.error('Error reading waitlist file:', readError);
        return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
      }
    }

    if (existingEmails.includes(email)) {
      return NextResponse.json({ message: 'Email already on waitlist.' }, { status: 409 });
    }

    const timestamp = new Date().toISOString();
    const newEntry = `${email},${timestamp}\\n`;

    await fs.appendFile(WAITLIST_FILE, newEntry, 'utf-8');

    return NextResponse.json({ message: 'Successfully joined waitlist!' }, { status: 200 });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
