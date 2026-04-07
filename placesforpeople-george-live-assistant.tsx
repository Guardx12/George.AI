import type { Metadata } from "next"
import { GoatleyGeorgeLiveAssistant } from "@/components/goatley-george-live-assistant"
import { GoatleyNavigation } from "@/components/goatley-navigation"

export const metadata: Metadata = {
  title: "R & D Goatley | ",
  description: "George for R & D Goatley. A live digital member of staff for the Goatley website, with the Goatley enquiry form underneath.",
}

export default function RDGoatleyGeorgePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#34270d_0%,#121212_24%,#060606_60%,#000000_100%)] text-white">
      <GoatleyNavigation />
      <GoatleyGeorgeLiveAssistant />
    </main>
  )
}
