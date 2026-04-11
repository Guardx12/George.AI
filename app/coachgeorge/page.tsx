import type { Metadata } from "next"
import { CoachGeorgeLiveAssistant } from "@/components/coach-george-live-assistant"

export const metadata: Metadata = {
  title: "Coach George",
  description: "Coach George is a premium voice-first fitness coach for calories, macros, workouts, accountability, and staying on track.",
  alternates: { canonical: "https://askgeorge.app/coachgeorge" },
  openGraph: {
    title: "Coach George",
    description: "A premium voice-first fitness coach for calories, macros, workouts, accountability, and staying on track.",
    url: "https://askgeorge.app/coachgeorge",
    siteName: "Coach George",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Coach George",
    description: "A premium voice-first fitness coach for calories, macros, workouts, accountability, and staying on track.",
  },
}

export default function CoachGeorgePage() {
  return (
    <main className="min-h-screen bg-[#030507] text-white">
      <CoachGeorgeLiveAssistant />
    </main>
  )
}
