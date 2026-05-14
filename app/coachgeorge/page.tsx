import type { Metadata } from "next";
import { CoachGeorgeLiveAssistant } from "@/components/coach-george-live-assistant";

export const metadata: Metadata = {
  title: "Coach George | Meals, Training & Daily Guidance",
  description:
    "Coach George helps you with meals, training, staying on track, and getting back on it when life happens.",
  alternates: { canonical: "https://askgeorge.app/coachgeorge" },
  openGraph: {
    title: "Coach George | Your Fitness Coach",
    description:
      "Your coach for meals, training, daily guidance, and getting back on track when life happens.",
    url: "https://askgeorge.app/coachgeorge",
    type: "website",
  },
};

export default function CoachGeorgePage() {
  return (
    <main className="min-h-screen bg-[#050913] text-white">
      <CoachGeorgeLiveAssistant />
    </main>
  );
}
