import type { Metadata } from "next"
import { FishersLiveAssistant } from "@/components/fishers-live-assistant"

export const metadata: Metadata = {
  title: "Fishers Farm Park | ",
  description:
    "George for Fishers Farm Park. A live English-speaking digital member of staff trained from approved Fishers website pages, including visitor help and directions around the park.",
}

export default function FishersPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fbf7e8_0%,#f2eccd_32%,#edf4df_100%)] text-[#1f3518]">
      <FishersLiveAssistant />
    </main>
  )
}
