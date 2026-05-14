import type { Metadata } from "next"
import { CoachGeorgeLiveAssistant } from "@/components/coach-george-live-assistant"

export const metadata: Metadata = {
  title: "Coach George | Stay on Track",
  description: "Talk to Coach George for food, training, motivation, and staying on track.",
  alternates: { canonical: "https://askgeorge.app/coachgeorge" },
  openGraph: {
    title: "Coach George | Stay on Track",
    description: "Your coach for food, training, motivation, and getting back on track when life happens.",
    url: "https://askgeorge.app/coachgeorge",
    type: "website",
    images: [{ url: "https://askgeorge.app/george-preview.png" }],
  },
}

export default function CoachGeorgePage() {
  return <CoachGeorgeLiveAssistant />
}
