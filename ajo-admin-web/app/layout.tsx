import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ajo Admin Console",
  description: "Platform administration for Ajo savings groups",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-canvas text-ink">{children}</body>
    </html>
  );
}
