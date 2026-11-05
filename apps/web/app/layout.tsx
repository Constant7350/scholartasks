import type { ReactNode } from "react";
import type { Viewport } from "next";
import "./globals.css";
import { InAppLinks } from "./in-app-links";
import { AiConsent } from "./ai-consent";
import { PhoneReminders } from "./phone-reminders";
import { THEME_BOOT } from "../lib/theme";

export const metadata = {
  metadataBase: new URL("https://scholartasks.com"),
  title: "ScholarTasks",
  description: "College, scholarships, state aid, grades and test prep for families, from 8th grade to graduation.",
  openGraph: { siteName: "ScholarTasks", type: "website", images: ["/presentation/slide-cover.jpg"] },
  // Opened from the phone's home screen, run full screen like an app (no browser bars).
  appleWebApp: { capable: true, title: "ScholarTasks", statusBarStyle: "default" as const },
};

export const viewport: Viewport = { themeColor: "#14305a" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the color theme saved on this device before the page paints. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <InAppLinks />
        {children}
        <AiConsent />
        <PhoneReminders />
      </body>
    </html>
  );
}
