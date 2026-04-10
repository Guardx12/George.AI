import type { Metadata } from "next"
import { CoachGeorgeLiveAssistant } from "@/components/coach-george-live-assistant"

export const metadata: Metadata = {
  title: "GEORGE",
  description: "George premium fitness coaching product.",
  alternates: { canonical: "https://askgeorge.app/coachgeorge" },
}

export default function CoachGeorgePage() {
  return (
    <main className="min-h-screen bg-[#04070b] text-white">
      <CoachGeorgeLiveAssistant />
    </main>
  )
}
