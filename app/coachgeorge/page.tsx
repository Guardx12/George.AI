import type { Metadata } from "next"
import { CoachGeorgeLiveAssistant } from "@/components/coach-george-live-assistant"

export const metadata: Metadata = {
  title: "Coach George",
  description: "Talk to George about calories, macros, meals, weight updates, and staying on track.",
  alternates: { canonical: "https://askgeorge.app/coachgeorge" },
  openGraph: {
    title: "Coach George",
    description: "Talk to George about calories, macros, meals, weight updates, and staying on track.",
    url: "https://askgeorge.app/coachgeorge",
    type: "website",
  },
}

export default function CoachGeorgePage() {
  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-[960px] px-4 py-6 sm:px-6 lg:px-8">
        <CoachGeorgeLiveAssistant />
      </div>
    </main>
  )
}
