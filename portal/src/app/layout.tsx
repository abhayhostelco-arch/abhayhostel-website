import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import { Inter } from "next/font/google";
import Script from "next/script";
import { NavigationProgress } from "@/components/navigation-progress";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { ThemeProvider } from "@/components/theme-provider";
import { themeBootstrapScript } from "@/lib/theme-bootstrap";
import { LIGHT_THEME_COLOR } from "@/lib/theme";
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
  manifest: "/manifest.webmanifest",
  applicationName: "Abhay Hostel",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Abhay Hostel" },
  icons: { apple: "/icon-192.png" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: LIGHT_THEME_COLOR,
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <Script
          id="theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
        <ThemeProvider>
          <Suspense fallback={null}><NavigationProgress /></Suspense>
          <ServiceWorkerRegistration />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
