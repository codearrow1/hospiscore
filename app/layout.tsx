import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Geist_Mono } from "next/font/google";
import JsonLd from "@/components/JsonLd";
import ScrollProgress from "@/components/marketing/ScrollProgress";
import BackToTop from "@/components/marketing/BackToTop";
import ThemeInit from "@/components/account/ThemeInit";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL, ogImage } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "hotel PMS",
    "hotel property management system",
    "hotel software",
    "channel manager",
    "booking engine",
    "restaurant POS",
    "housekeeping software",
    "hotel management",
    "hospitality software",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: ogImage(`${SITE_NAME} — ${SITE_TAGLINE}`), width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [ogImage(`${SITE_NAME} — ${SITE_TAGLINE}`)],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeInit />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <ScrollProgress />
        <BackToTop />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                name: SITE_NAME,
                url: SITE_URL,
                logo: `${SITE_URL}/og?title=HospiOS`,
                description: SITE_DESCRIPTION,
              },
              {
                "@type": "WebSite",
                name: SITE_NAME,
                url: SITE_URL,
                description: SITE_DESCRIPTION,
              },
            ],
          }}
        />
        {children}
      </body>
    </html>
  );
}
