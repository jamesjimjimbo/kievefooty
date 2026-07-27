import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Kieve Footy", template: "%s · Kieve Footy" },
  description: "A private Premier League picks competition between friends.",
  openGraph: {
    title: "Kieve Footy",
    description: "Pick smart. Back your mates. Win the week.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Kieve Footy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kieve Footy",
    description: "Pick smart. Back your mates. Win the week.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
