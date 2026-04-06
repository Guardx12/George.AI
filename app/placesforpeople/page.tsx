import type { Metadata } from "next"
import { PlacesForPeopleGeorgeLiveAssistant } from "@/components/placesforpeople-george-live-assistant"

export const metadata: Metadata = {
  title: "Steyning Leisure Centre | George",
  description: "Talk to George about memberships, the live timetable, classes, swimming and centre questions.",
  alternates: { canonical: "https://askgeorge.app/placesforpeople" },
  openGraph: {
    title: "Steyning Leisure Centre | George",
    description: "Talk to George about memberships, the live timetable, classes, swimming and centre questions.",
    url: "https://askgeorge.app/placesforpeople",
    type: "website",
  },
}

export default function PlacesForPeoplePage() {
  return (
    <main className="min-h-screen bg-[#efefef] text-[#394553]">
      <header className="bg-[#394553] text-white">
        <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
          <a href="https://www.placesleisure.org/" className="inline-flex items-center gap-3" aria-label="Places Leisure homepage">
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
        </div>
      </header>

      <section className="bg-[#efefef] pb-12 pt-8 sm:pb-16 sm:pt-10">
        <div className="mx-auto max-w-[960px] px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-[36px] font-black tracking-tight text-[#394553] sm:text-[48px]">Talk to George</h1>
            <p className="mx-auto mt-4 max-w-[760px] text-[18px] leading-8 text-[#394553] sm:text-[20px]">
              George can recommend the right membership, check the live timetable, answer questions about the centre,
              and help guide you through joining.
            </p>
          </div>

          <div className="mt-8 sm:mt-10">
            <PlacesForPeopleGeorgeLiveAssistant />
          </div>
        </div>
      </section>
    </main>
  )
}
