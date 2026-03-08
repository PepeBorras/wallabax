import type { Metadata } from "next";
import { Manrope, Outfit } from "next/font/google";

import "@/app/globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Wallabax",
  description: "Create permanent clean reader pages from public X long-form URLs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${manrope.variable} app-home-bg text-slate-900 antialiased`}>{children}</body>
    </html>
  );
}
