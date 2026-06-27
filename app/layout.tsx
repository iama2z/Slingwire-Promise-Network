import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slingwire Promise Network",
  description: "Zero-tracking Wichita local events feed.",
};

/**
 * No analytics, pixels, or third-party client scripts are included here.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-zinc-900">{children}</body>
    </html>
  );
}
