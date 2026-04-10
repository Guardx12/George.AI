import type { Metadata } from "next"
import { CoachGeorgeLiveAssistant } from "@/components/coach-george-live-assistant"

export const metadata: Metadata = {
  title: "Coach George | Product",
  description: "Coach George product interface.",
  alternates: { canonical: "https://askgeorge.app/george" },
}

export default function GeorgePage() {
  return (
    <main className="min-h-screen bg-[#04070b] text-white">
      <CoachGeorgeLiveAssistant />
    </main>
  )
}
