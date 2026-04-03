import type React from "react"
import type { Metadata } from "next"
import Image from "next/image"
import { Inter } from "next/font/google"
import "./globals.css"
import Script from "next/script"
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: " | Conversational Digital Member of Staff for Your Website",
    template: "%s",
  },
  description:
    " — your conversational digital member of staff for your website. He talks to website visitors, answers questions about services and facilities, explains pricing and options, guides visitors toward becoming enquiries, and captures enquiry details automatically.",
  generator: "v0.app",
  icons: {
    icon: "/favicon.ico",
  },
  metadataBase: new URL("https://askgeorge.app"),
  openGraph: {
    siteName: "George",
    type: "website",
    locale: "en_GB",
    url: "https://askgeorge.app",
    images: [{ url: "/george-preview.png?v=8", width: 1200, height: 630, alt: ", your conversational digital member of staff for your website" }],
  },
  twitter: {
    card: "summary_large_image",
    title: " | Conversational Digital Member of Staff for Your Website | GuardX",
    description:
      " — your conversational digital member of staff for your website. He talks to website visitors, answers questions about services and facilities, explains pricing and options, guides visitors toward becoming enquiries, and captures enquiry details automatically.",
    images: ["/george-preview.png?v=8"],
  },
  alternates: { canonical: "https://askgeorge.app" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <Script id="facebook-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '643792238797788');
          fbq('track', 'PageView');
        `}
      </Script>

      <Script src="https://www.googletagmanager.com/gtag/js?id=AW-17521993303" strategy="afterInteractive" />

      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-17521993303');
        `}
      </Script>

      <body className="min-h-screen bg-background pb-28 text-foreground antialiased sm:pb-32">
        {children}
{/* Facebook Pixel noscript */}
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=643792238797788&ev=PageView&noscript=1"
          />
        </noscript>
      
        <Script id="guardx-localbusiness-schema" type="application/ld+json" strategy="afterInteractive">
          {`
          {
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": "GuardX Limited",
            "url": "https://www.guardxnetwork.com",
            "logo": "https://www.guardxnetwork.com/images/guardx-logo.png",
            "image": "https://www.guardxnetwork.com/images/guardx-logo.png",
            "description": " — your conversational digital member of staff for your website. He talks to website visitors, answers questions about services and facilities, explains pricing and options, guides visitors toward becoming enquiries, and captures enquiry details automatically.",
            "areaServed": {
              "@type": "Country",
              "name": "United Kingdom"
            },
            "address": {
              "@type": "PostalAddress",
              "addressCountry": "GB",
              "addressRegion": "West Sussex"
            },
            "sameAs": [
              "https://www.guardxnetwork.com"
            ]
          }
          `}
        </Script>

        


      </body>
    </html>
  )
}
