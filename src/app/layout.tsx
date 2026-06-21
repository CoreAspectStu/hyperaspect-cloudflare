import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = "https://video.coreaspectai.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: SITE_URL,
  },
  title: "HyperAspect — AI Video Generator for Businesses & Creators",
  description:
    "Create professional videos in 30 seconds. Pick a template, describe your business, and get a polished video with narration, music, and captions. No editing skills required.",
  keywords: [
    "AI video generator",
    "business video maker",
    "marketing video",
    "video creator",
    "automated video production",
    "social media video",
    "product demo video",
  ],
  authors: [{ name: "Core Aspect" }],
  creator: "Core Aspect",
  openGraph: {
    title: "HyperAspect — AI Video Generator",
    description:
      "Create professional videos in 30 seconds. 50+ templates, AI narration, brand kit, one-click YouTube upload.",
    url: "https://video.coreaspectai.com",
    siteName: "HyperAspect",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "HyperAspect — AI Video Generator",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HyperAspect — AI Video Generator",
    description:
      "Create professional videos in 30 seconds. 50+ templates, AI narration, brand kit.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0f0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "HyperAspect",
              applicationCategory: "MultimediaApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              creator: {
                "@type": "Organization",
                name: "Core Aspect",
                url: "https://coreaspectai.com",
              },
            }),
          }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
