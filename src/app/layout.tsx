import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"]
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  fallback: ["Iowan Old Style", "Charter", "Georgia", "serif"]
});

export const metadata: Metadata = {
  title: "TTC Coffee POS Terminal",
  description: "Touch-optimized POS and stock system for neighborhood cafes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
