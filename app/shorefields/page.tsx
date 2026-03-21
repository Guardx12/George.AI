import type { Metadata } from "next"
import { ShorefieldsGeorgeLiveAssistant } from "@/components/shorefields-george-live-assistant"

export const metadata: Metadata = {
  title: "Shorefield Country Park | Meet George",
  description:
    "Meet George for Shorefield Country Park — a friendly English-only assistant for stays, facilities, entertainment, food, nearby attractions, and directions around the park.",
  alternates: { canonical: "https://askgeorge.app/shorefields" },
  openGraph: {
    title: "Shorefield Country Park | Meet George",
    description:
      "Meet George for Shorefield Country Park — a friendly English-only assistant for stays, facilities, entertainment, food, nearby attractions, and directions around the park.",
    url: "https://askgeorge.app/shorefields",
    type: "website",
  },
}

export default function ShorefieldsGeorgePage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f3fbf9_0%,#eef7f6_42%,#f8fbfb_100%)] text-[#17344d]">
      <ShorefieldsGeorgeLiveAssistant />
    </main>
  )
}
