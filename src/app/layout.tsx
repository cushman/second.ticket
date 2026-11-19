import type { Metadata } from "next";
import { Big_Shoulders, DM_Mono, DM_Sans } from "next/font/google";
import "../../design/tokens.css";
import "./globals.css";

const display = Big_Shoulders({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
  adjustFontFallback: false,
  fallback: ["Arial Narrow", "sans-serif"],
});
const body = DM_Sans({ variable: "--font-body", subsets: ["latin"] });
const mono = DM_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Branson Explorer",
  description: "Tickets for every show and attraction in Branson, Missouri.",
};

// Applies the saved light/dark choice before first paint so the page never flashes.
const themeScript = `try{var t=localStorage.getItem("be-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
