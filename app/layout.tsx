import CookieBanner from "@/components/cookie-banner";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { getCompanyName } from "@/lib/brand";
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

// The company name is admin-editable and read from the database, so pages must
// render at request time (the Docker build has no database to prerender from).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const companyName = await getCompanyName();
  return {
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    title: `${companyName} - Recrutement`,
    description: "Découvrez les offres et postulez simplement.",
    openGraph: { siteName: companyName, locale: "fr_FR", type: "website" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const companyName = await getCompanyName();
  return (
    <html lang="fr" className={cn("font-sans", inter.variable)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} readable-ui antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          <SiteHeader companyName={companyName} />
          {children}
          <SiteFooter companyName={companyName} />
        </AuthProvider>
        <Toaster richColors={true} theme="light" position="top-center"/>
        <CookieBanner />
      </body>
    </html>
  );
}
