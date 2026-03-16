import type { Metadata } from "next"
import { GoatleyGeorgeLiveAssistant } from "@/components/goatley-george-live-assistant"
import { GoatleyNavigation } from "@/components/goatley-navigation"

export const metadata: Metadata = {
  title: "R & D Goatley | Meet George",
  description: "George for R & D Goatley. A live digital member of staff for the Goatley website, with the Goatley enquiry form underneath.",
}

export default function RDGoatleyGeorgePage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#121212_0%,#1a1a1a_55%,#111111_100%)] text-white">
      <GoatleyNavigation />
      <GoatleyGeorgeLiveAssistant />
    </main>
  )
}
