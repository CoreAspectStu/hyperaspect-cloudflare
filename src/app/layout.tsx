import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{
          __html: `
            :root {
              --header-height: 80px;
              --max-w: 1280px;
              --bg-base: #fef6e4;
              --bg-surface: #fff;
              --text: #0a0a0a;
              --text-muted: #6b6b6b;
              --text-secondary: #0a0a0a;
              --border: #0a0a0a;
              --border-secondary: #e5e7eb;
              --border-width: 3px;
              --accent: #ff0000;
              --yellow: #ffd60a;
              --cyan: #00e5ff;
              --lime: #b8ff00;
              --pink: #ff6ec7;
              --shadow: 4px 4px 0px var(--border);
              --shadow-lg: 6px 6px 0px var(--border);
              --font-display: 'Inter', sans-serif;
              --font-body: 'Inter', sans-serif;
            }
            body {
              background-color: var(--bg-base);
              color: var(--text);
              font-family: var(--font-body);
              margin: 0;
              padding: 0;
            }
            *,
            *::before,
            *::after {
              box-sizing: border-box;
              --tw-border-spacing-x: 0;
              --tw-border-spacing-y: 0;
              --tw-translate-x: 0;
              --tw-translate-y: 0;
              --tw-rotate: 0;
              --tw-skew-x: 0;
              --tw-skew-y: 0;
              --tw-scale-x: 1;
              --tw-scale-y: 1;
              --tw-pan-x: ;
              --tw-pan-y: ;
              --tw-pinch-zoom: ;
              --tw-scroll-snap-strictness: proximity;
              --tw-gradient-from-position: ;
              --tw-gradient-via-position: ;
              --tw-gradient-to-position: ;
              --tw-ordinal: ;
              --tw-slashed-zero: ;
              --tw-numeric-figure: ;
              --tw-numeric-spacing: ;
              --tw-numeric-fraction: ;
              --tw-ring-inset: ;
              --tw-ring-offset-width: 0px;
              --tw-ring-offset-color: #fff;
              --tw-ring-color: rgb(59 130 246 / 0.5);
              --tw-ring-offset-shadow: 0 0 #0000;
              --tw-ring-shadow: 0 0 #0000;
              --tw-shadow: 0 0 #0000;
              --tw-shadow-colored: 0 0 #0000;
              --tw-blur: ;
              --tw-brightness: ;
              --tw-contrast: ;
              --tw-grayscale: ;
              --tw-hue-rotate: ;
              --tw-invert: ;
              --tw-saturate: ;
              --tw-sepia: ;
              --tw-drop-shadow: ;
              --tw-backdrop-blur: ;
              --tw-backdrop-brightness: ;
              --tw-backdrop-contrast: ;
              --tw-backdrop-grayscale: ;
              --tw-backdrop-hue-rotate: ;
              --tw-backdrop-invert: ;
              --tw-backdrop-opacity: ;
              --tw-backdrop-saturate: ;
              --tw-backdrop-sepia: ;
              --tw-contain-size: ;
              --tw-contain-layout: ;
              --tw-contain-paint: ;
              --tw-contain-style: ;
            }
          `
        }} />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
