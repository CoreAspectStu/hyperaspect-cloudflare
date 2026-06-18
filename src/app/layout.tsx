import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css'; // Keep this for now, even if empty/minimal
import { CREAM_BG, DARK_TEXT } from '@/lib/constants'; // Use the constants
import Navbar from '../components/Navbar'; // Relative import for Navbar

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'HyperAspect',
  description: 'AI-powered video creation platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={inter.className}
        style={{
          backgroundColor: CREAM_BG,
          color: DARK_TEXT,
          margin: 0,
          padding: 0,
          overflowX: 'hidden', // Prevent horizontal scroll
        }}
      >
        <Navbar />
        {children}
      </body>
    </html>
  );
}
