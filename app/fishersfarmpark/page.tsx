import type { Metadata } from "next"
import { FishersGeorgeLiveAssistant } from "@/components/fishers-george-live-assistant"

export const metadata: Metadata = {
  title: "Fishers Farm Park | Meet George",
  description:
    "George for Fishers Farm Park — a friendly English-only assistant for tickets, opening times, attractions, animals, food, short breaks, annual passes, and visitor questions.",
  alternates: { canonical: "https://askgeorge.app/fishersfarmpark" },
  openGraph: {
    title: "Fishers Farm Park | Meet George",
    description:
      "George for Fishers Farm Park — a friendly English-only assistant for tickets, opening times, attractions, animals, food, short breaks, annual passes, and visitor questions.",
    url: "https://askgeorge.app/fishersfarmpark",
    type: "website",
  },
}

export default function FishersFarmParkGeorgePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fbf3b9_0%,#d9f3d1_18%,#d6f0de_34%,#fefdf8_72%,#ffffff_100%)] text-[#1f2937]">
      <FishersGeorgeLiveAssistant />
    </main>
  )
}
