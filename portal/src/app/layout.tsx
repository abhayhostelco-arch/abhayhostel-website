import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Inter } from "next/font/google";
import { NavigationProgress } from "@/components/navigation-progress";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Abhay Hostel Portal",
    template: "%s | Abhay Hostel",
  },
  description:
    "Secure student routine tracking and hostel administration for Abhay Hostel.",
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Suspense fallback={null}><NavigationProgress /></Suspense>
        {children}
      </body>
    </html>
  );
}
