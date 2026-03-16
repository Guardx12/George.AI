import type { Metadata } from "next"
import { GoatleyFooter } from "@/components/goatley-footer"
import { GoatleyLiveAssistant } from "@/components/goatley-live-assistant"
import { GoatleyNavigation } from "@/components/goatley-navigation"

export const metadata: Metadata = {
  title: "R & D Goatley | Meet George",
  description:
    "George for R & D Goatley. Ask about windows, doors, conservatories, pergolas, pricing guidance and booking a visit.",
  alternates: { canonical: "https://guardxnetwork.com/rd-goatley-george" },
  openGraph: {
    title: "R & D Goatley | Meet George",
    description:
      "George for R & D Goatley. Ask about windows, doors, conservatories, pergolas, pricing guidance and booking a visit.",
    url: "https://guardxnetwork.com/rd-goatley-george",
    type: "website",
    images: [
      {
        url: "https://guardxnetwork.com/goatleys-logo.jpg",
        width: 1048,
        height: 310,
        alt: "R & D Goatley Ltd",
      },
    ],
  },
}

export default function RDGoatleyGeorgePage() {
  return (
    <main className="min-h-screen bg-[#111111] text-[#f4ecd2]">
      <GoatleyNavigation />
      <GoatleyLiveAssistant />
      <GoatleyFooter />
    </main>
  )
}
