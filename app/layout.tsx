import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "725 Solar",
  description: "Deye solar inverter and battery monitoring dashboard.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "725 Solar",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c1431",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
