import type { Metadata } from "next"
import { FishersGeorgeLiveAssistant } from "@/components/fishers-george-live-assistant"

export const metadata: Metadata = {
  title: "Fishers Farm Adventure Park | Meet George",
  description:
    "Meet George for Fishers Farm Adventure Park — a friendly English-only assistant for tickets, opening times, attractions, animals, food, events, short breaks, and directions around the park.",
  alternates: { canonical: "https://askgeorge.app/fishersfarmpark" },
  openGraph: {
    title: "Fishers Farm Adventure Park | Meet George",
    description:
      "Meet George for Fishers Farm Adventure Park — a friendly English-only assistant for tickets, opening times, attractions, animals, food, events, short breaks, and directions around the park.",
    url: "https://askgeorge.app/fishersfarmpark",
    type: "website",
  },
}

export default function FishersFarmParkGeorgePage() {
  return (
    <main className="min-h-screen bg-[#f7efe4] text-[#4e2a12]">
      <FishersGeorgeLiveAssistant />
    </main>
  )
}
