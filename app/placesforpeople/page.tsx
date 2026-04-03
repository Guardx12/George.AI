import type { Metadata } from "next"
import Image from "next/image"
import { Menu } from "lucide-react"
import { PlacesForPeopleGeorgeLiveAssistant } from "@/components/placesforpeople-george-live-assistant"

export const metadata: Metadata = {
  title: "Steyning Leisure Centre | Meet George",
  description:
    "A Steyning Leisure Centre styled George page with Places Leisure inspired dark slate, orange, and light grey styling.",
  alternates: { canonical: "https://askgeorge.app/placesforpeople" },
  openGraph: {
    title: "Steyning Leisure Centre | Meet George",
    description:
      "A Steyning Leisure Centre styled George page with Places Leisure inspired dark slate, orange, and light grey styling.",
    url: "https://askgeorge.app/placesforpeople",
    type: "website",
  },
}

export default function PlacesForPeoplePage() {
  return (
    <main className="min-h-screen bg-[#efefef] text-[#394553]">
      <header className="bg-[#394553] text-white">
        <div className="mx-auto max-w-[1240px] px-4 pt-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between rounded-full border border-white/35 bg-[#d8d8dd] px-5 py-3 text-black shadow-[0_1px_0_rgba(255,255,255,0.4)_inset] sm:mx-auto sm:max-w-[520px]">
            <div className="h-6 w-6 rounded-sm border-[3px] border-black border-t-[5px] border-b-0" />
            <div className="text-[20px] font-black tracking-tight sm:text-[22px]">placesleisure.org</div>
            <div className="text-[28px] leading-none">↻</div>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-4 pb-6 pt-8 sm:px-6 lg:px-8">
          <a href="https://www.placesleisure.org/" className="flex items-center gap-3" aria-label="Places Leisure homepage">
            <div className="flex h-12 w-12 items-center justify-center text-[#f47c00]">
              <svg viewBox="0 0 42 42" className="h-12 w-12 fill-current" aria-hidden="true">
                <path d="M19.2 2.7 8.3 13.6c-2.3 2.3-2.3 6 0 8.3l10.1 10.1c2 2 5.2 2 7.2 0l8.2-8.2-6.1-6.1-6.7 6.7-6.8-6.8 10.9-10.9-5.9-5.9Z" />
              </svg>
            </div>
            <div className="leading-none">
              <div className="text-[28px] font-black tracking-tight sm:text-[32px]">Places</div>
              <div className="-mt-1 text-[28px] font-black tracking-tight sm:text-[32px]">Leisure</div>
              <div className="mt-1 text-[11px] text-white/90">Part of Places for People</div>
            </div>
          </a>

          <button type="button" aria-label="Main Menu" className="text-white">
            <Menu className="h-14 w-14 stroke-[2.5]" />
          </button>
        </div>
      </header>

      <section className="border-b border-[#dddddd] bg-[#ffffff]">
        <div className="mx-auto max-w-[1240px] px-4 py-4 text-[16px] sm:px-6 lg:px-8">
          <span className="text-[#f47c00]">Home</span>
          <span className="px-3 text-[#394553]">&gt;</span>
          <span className="text-[#f47c00]">Steyning Leisure Centre</span>
        </div>
      </section>

      <section className="bg-[#efefef]">
        <div className="mx-auto max-w-[980px] px-4 py-8 sm:px-6 sm:py-10 lg:py-14">
          <div className="text-center">
            <div className="text-[24px] font-black leading-none text-[#394553] sm:text-[32px] lg:text-[40px]">Welcome to</div>
            <h1 className="mt-3 text-[clamp(2.7rem,10vw,5.25rem)] font-black leading-[0.95] tracking-tight text-[#394553]">
              Steyning Leisure
              <br />
              Centre
            </h1>
            <p className="mx-auto mt-6 max-w-[760px] text-[18px] leading-[1.8] text-[#394553] sm:mt-8 sm:text-[22px] lg:text-[26px]">
              Tap the big round button to speak. George can help with memberships, the live timetable, swimming,
              classes, centre questions, directions around the centre, and guided gym workouts.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#efefef] pb-12">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
          <PlacesForPeopleGeorgeLiveAssistant />
        </div>
      </section>

      <footer className="bg-[#60656d] text-white">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-5 px-4 py-8 sm:px-6 lg:flex-row lg:px-8">
          <div className="text-center lg:text-left">
            <div className="text-[20px] font-semibold">George</div>
            <a href="https://getgeorge.app" className="mt-2 inline-block text-[16px] text-white underline underline-offset-4 sm:text-[18px]">
              getgeorge.app
            </a>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative h-[74px] w-[74px] overflow-hidden rounded-full border border-white/25 bg-black/10 sm:h-[78px] sm:w-[78px]">
              <Image src="/george-logo.png" alt="George" fill className="object-contain p-2" />
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
