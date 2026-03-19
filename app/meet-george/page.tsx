import type { Metadata } from "next"
import { Footer } from "@/components/footer"
import { GeorgeLiveAssistantCompact } from "@/components/george-live-assistant-compact"
import { Navigation } from "@/components/navigation"

export const metadata: Metadata = {
  title: "Meet George | 24/7 Digital Guide for Attractions, Holiday Parks, and Visitor Websites",
  description:
    "Meet George — a trained digital guide and member of staff for attractions, holiday parks, campsites, and visitor destinations. He helps visitors plan, get answers instantly, find directions, know what to do next, and get more from their visit.",
  alternates: { canonical: "https://askgeorge.app" },
}

export default function MeetGeorgePage() {
  return (
    <main className="min-h-screen bg-white text-[#0F172A]">
      <Navigation />
      <GeorgeLiveAssistantCompact />
      <Footer />
    </main>
  )
}
