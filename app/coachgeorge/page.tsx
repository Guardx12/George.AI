import type { Metadata } from "next";
import { CoachGeorgeLiveAssistant } from "@/components/coach-george-live-assistant";

export const metadata: Metadata = {
  title: "Coach George | Stay On Track",
  description:
    "Coach George helps you stay on track with food, training, motivation, bad days, and the next right decision.",
  alternates: { canonical: "https://askgeorge.app/coachgeorge" },
  openGraph: {
    title: "Coach George | Stay On Track",
    description:
      "Your coach for food, training, motivation, and getting back on track when life happens.",
    url: "https://askgeorge.app/coachgeorge",
    type: "website",
  },
};

export default function CoachGeorgePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <CoachGeorgeLiveAssistant />
    </main>
  );
}
