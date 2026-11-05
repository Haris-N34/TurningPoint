import type { Metadata } from "next";
import { Geist, Geist_Mono, Lora } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/site/Header";
import { Housekeeping } from "@/components/practice/Housekeeping";
import { DemoPanel } from "@/components/demo/DemoPanel";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const storyFont = Lora({ variable: "--font-story", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Turning Point",
  description: "Show how you handle it when the plan breaks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${storyFont.variable}`}>
      <body
        className="antialiased"
      >
        <Header />
        <Housekeeping />
        <DemoPanel />
        <div id="main-content" tabIndex={-1}>{children}</div>
      </body>
    </html>
  );
}
