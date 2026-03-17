import type { Metadata } from "next"
import { FishersFooter } from "@/components/fishers-footer"
import { FishersGeorgeLiveAssistant } from "@/components/fishers-george-live-assistant"
import { FishersNavigation } from "@/components/fishers-navigation"

export const metadata: Metadata = {
  title: "Fishers Farm Park | Ask George",
  description: "George for Fishers Farm Park. A live English-speaking digital member of staff that reads approved Fishers pages and helps visitors plan, book, and explore.",
}

export default function FishersGeorgePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f8ffef_0%,#eff8dc_22%,#fdf9e8_100%)] text-[#23401a]">
      <FishersNavigation />
      <FishersGeorgeLiveAssistant />
      <FishersFooter />
    </main>
  )
}
