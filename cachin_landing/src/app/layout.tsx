import type { Metadata } from "next";
import { Fredoka, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "çachin | Spend more effortlessly across LATAM",
  description:
    "Fund Cachin globally, scan supported local QRs across LATAM, confirm the FX before paying, and pay like a local.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "çachin | Scan, confirm, paid",
    description:
      "A LATAM-first payments app for travelers, foreigners, and crypto-paid freelancers.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
