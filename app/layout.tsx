import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Archymedes Capital Radar",
  description: "Funding opportunities across the US, EU, UK and APAC, ranked by ORION.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
