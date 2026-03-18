import type { Metadata } from "next"
import { TulleysLiveAssistant } from "@/components/tulleys-live-assistant"

export const metadata: Metadata = {
  title: "Tulleys Farm | Meet George",
  description: "George for Tulleys Farm. A live English-speaking digital member of staff trained from approved live Tulleys pages and event websites.",
  alternates: { canonical: "https://askgeorge.app/tullys" },
}

export default function TulleysPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,212,120,0.22),rgba(255,255,255,0)_28%),linear-gradient(180deg,#1f120d_0%,#4a2410_45%,#8c4b1c_100%)] text-white">
      <TulleysLiveAssistant />
    </main>
  )
}
