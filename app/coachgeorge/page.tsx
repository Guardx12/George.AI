import type { Metadata } from "next"
import { CoachGeorgeLiveAssistant } from "@/components/coach-george-live-assistant"

export const metadata: Metadata = {
  title: "Coach George | Your Fitness Coach",
  description: "Talk to Coach George for meals, training, daily guidance, and getting back on track when life happens.",
  alternates: { canonical: "https://askgeorge.app/coachgeorge" },
  openGraph: {
    title: "Coach George | Your Fitness Coach",
    description: "Talk to Coach George for meals, training, daily guidance, and getting back on track when life happens.",
    url: "https://askgeorge.app/coachgeorge",
    type: "website",
  },
}

export default function CoachGeorgePage() {
  return (
    <main className="min-h-screen bg-[#060a12] text-white">
      <header className="border-b border-white/10 bg-[#0a101b]">
        <div className="mx-auto max-w-[960px] px-4 py-5 text-center sm:px-6 lg:px-8">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Coach George</h1>
          <p className="mt-1 text-sm text-[#9fb4dc]">Your fitness coach for meals, training, and daily guidance.</p>
        </div>
      </header>

      <div className="mx-auto max-w-[960px] px-4 sm:px-6 lg:px-8">
        <CoachGeorgeLiveAssistant />
      </div>
    </main>
  )
}
