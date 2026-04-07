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
        <div className="mx-auto flex max-w-[1240px] items-center px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <a href="https://www.placesleisure.org/" className="inline-flex items-center" aria-label="Places Leisure homepage">
            <img
              src="/places-leisure-logo.jpg"
              alt="Places Leisure"
              className="block h-[56px] w-auto object-contain sm:h-[72px]"
            />
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-[960px] px-4 sm:px-6 lg:px-8">
        <PlacesForPeopleGeorgeLiveAssistant />
      </div>

      <footer className="mt-10 bg-black text-white">
        <div className="mx-auto max-w-[960px] px-4 py-6 text-center sm:px-6 lg:px-8">
          <a
            href="https://askgeorge.app"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold tracking-[0.12em] text-white/90 transition hover:text-white"
          >
            GetGeorge.app
          </a>
        </div>
      </footer>
    </main>
  )
}
