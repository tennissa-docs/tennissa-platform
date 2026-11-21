import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TENNISSA", template: "%s · TENNISSA" },
  description: "Tennessee Islamic School Scholarship Alliance: scholarships for Tennessee families, funded by tax-credit gifts.",
  icons: { icon: "/brand/tennissa-icon-512.png" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the request makes every page dynamic, which the per-request CSP nonce needs.
  await headers();
  return (
    // suppressHydrationWarning: browser extensions (e.g. Grammarly) add attributes to html/body; applies to these two elements only
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh" suppressHydrationWarning>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-bg focus:px-4 focus:py-2 focus:shadow-pop">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
