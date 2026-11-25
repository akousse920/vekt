import CookieBanner from "@/components/cookie-banner";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { COMPANY_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AuthProvider from "./providers";

const inter = localFont({
  src: "./fonts/Inter-VariableFont_opsz,wght.ttf",
  variable: "--font-sans",
});

const geistSans = localFont({
  src: "./fonts/Geist-VariableFont_wght.ttf",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-VariableFont_wght.ttf",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: `${COMPANY_NAME} — Recrutement`,
  description: "Découvrez les offres et postulez simplement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={cn("font-sans", inter.variable)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} readable-ui antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </AuthProvider>
        <Toaster richColors={true} theme="light" position="top-center"/>
        <CookieBanner />
      </body>
    </html>
  );
}
