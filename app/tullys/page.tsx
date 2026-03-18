import type { Metadata } from "next"
import { Bebas_Neue, Oswald } from "next/font/google"
import { TullysLiveAssistant } from "@/components/tullys-live-assistant"

const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas" })
const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-oswald" })

export const metadata: Metadata = {
  title: "Tulleys Farm | Meet George",
  description: "George for Tulleys Farm. A live English-speaking digital member of staff trained from approved Tulleys pages and related event websites.",
}

export default function TullysPage() {
  return (
    <main className={`${bebas.variable} ${oswald.variable} min-h-screen font-[var(--font-oswald)] text-[#F6E6C5]`}>
      <div
        className="min-h-screen"
        style={{
          backgroundColor: "#2e2017",
          backgroundImage:
            "radial-gradient(circle at 20% 15%, rgba(134,91,56,0.18), transparent 26%), radial-gradient(circle at 80% 12%, rgba(98,67,41,0.2), transparent 24%), linear-gradient(90deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.01) 2px, transparent 2px, transparent 86px), linear-gradient(0deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.015) 2px, transparent 2px, transparent 56px), linear-gradient(180deg, #4d3627 0%, #38271d 12%, #2b1d16 54%, #241811 100%)",
          backgroundSize: "auto, auto, 86px 100%, 100% 56px, auto",
        }}
      >
        <div className="mx-auto max-w-[1600px] px-2 py-4 sm:px-4 lg:px-6">
          <TullysLiveAssistant />
        </div>
      </div>
    </main>
  )
}
