import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ConditionalWhatsAppBubble } from "@/components/conditional-whatsapp-bubble"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Meet George | 24/7 AI Receptionist for Business Websites",
    template: "%s",
  },
  description:
    "Meet George, your 24/7 AI receptionist for business websites. He answers questions, explains services, gives pricing guidance, captures enquiries, and helps turn visitors into customers.",
  icons: {
    icon: "/favicon.ico",
  },
  metadataBase: new URL("https://george.ai"),
  openGraph: {
    siteName: "George",
    type: "website",
    locale: "en_GB",
    url: "https://george.ai",
    images: [{ url: "/george-preview.png", width: 1200, height: 630, alt: "Meet George, your AI assistant" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Meet George | 24/7 AI Receptionist for Business Websites",
    description:
      "Meet George, your 24/7 AI receptionist for business websites. He answers questions, explains services, gives pricing guidance, captures enquiries, and helps turn visitors into customers.",
    images: ["/george-preview.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <ConditionalWhatsAppBubble />
      </body>
    </html>
  )
}
