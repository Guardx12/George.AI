import type { Metadata } from "next"
import Image from "next/image"
import { Menu, MapPin, Phone, Clock3 } from "lucide-react"
import { PlacesForPeopleGeorgeLiveAssistant } from "@/components/placesforpeople-george-live-assistant"

export const metadata: Metadata = {
  title: "Steyning Leisure Centre | Meet George",
  description:
    "A cleaner Steyning Leisure Centre styled George page with a simple layout, live timetable-aware assistant, and direct centre links.",
  alternates: { canonical: "https://askgeorge.app/placesforpeople" },
  openGraph: {
    title: "Steyning Leisure Centre | Meet George",
    description:
      "A cleaner Steyning Leisure Centre styled George page with a simple layout, live timetable-aware assistant, and direct centre links.",
    url: "https://askgeorge.app/placesforpeople",
    type: "website",
  },
}

const utilityLinks = [
  { label: "Swimming & Lessons", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/swimming-lessons/" },
  { label: "Fitness & Health", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/fitness-health/" },
  { label: "Sports", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/sports/" },
  { label: "Family & Kids", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/family-kids/" },
]

export default function PlacesForPeoplePage() {
  return (
    <main className="min-h-screen bg-[#f4f4ef] text-[#173632] places-leisure-theme">
      <header>
        <div className="bg-[#0f4d47] text-white">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-3 text-[15px] sm:px-6 lg:px-8">
            <nav className="flex flex-wrap items-center gap-5">
              <a href="https://www.placesleisure.org/our-purpose/" className="hover:opacity-80">Our purpose</a>
              <a href="https://www.placesleisure.org/our-people/" className="hover:opacity-80">Our people</a>
              <a href="https://www.placesleisure.org/find-centre/" className="hover:opacity-80">Our centres</a>
              <a href="https://www.placesleisure.org/membership/" className="hover:opacity-80">Join now</a>
              <a href="https://www.placesleisure.org/contact-us/" className="hover:opacity-80">Contact us</a>
            </nav>
            <div className="text-sm font-semibold tracking-[0.18em] uppercase">Places Leisure</div>
          </div>
        </div>

        <div className="border-b border-[#d8ddd8] bg-white">
          <div className="mx-auto flex max-w-[1240px] items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
            <a href="https://www.placesleisure.org/" className="text-[26px] font-black tracking-tight text-[#ef7d00] sm:text-[32px]">
              Places <span className="text-[#0f4d47]">Leisure</span>
            </a>
            <button type="button" aria-label="Main Menu" className="rounded-full border border-[#d8ddd8] p-3 text-[#173632]">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <section className="border-b border-[#d8ddd8] bg-white">
        <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="text-[15px] font-medium text-[#5a6664]">Places Leisure</div>
          <div className="mt-1 text-[30px] font-black tracking-tight text-[#173632] sm:text-[36px]">Steyning Leisure Centre</div>
          <div className="mt-2 text-[15px] font-semibold text-[#5a6664]">Closes today at 9.00pm</div>

          <div className="mt-5 flex flex-wrap gap-3">
            {utilityLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="rounded-full border border-[#d9dfdb] bg-[#f7f8f5] px-4 py-2 text-sm font-semibold text-[#173632] transition hover:bg-[#eff2ed]"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#d8ddd8] bg-[#e8f3ed]">
        <div className="mx-auto max-w-[1240px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="text-[14px] font-bold uppercase tracking-[0.16em] text-[#0f4d47]">Partial Pool Closure</div>
          <p className="mt-2 max-w-[980px] text-[15px] leading-7 text-[#355552]">
            Please be aware that part of the pool is closed until further notice due to a fault with the movable floor. All lane swims will operate as general swim only, and only half of the pool will be available.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="grid gap-6 rounded-[24px] border border-[#d8ddd8] bg-[#fbfbf8] p-5 sm:p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
            <div>
              <div className="text-[14px] font-bold uppercase tracking-[0.16em] text-[#0f4d47]">Meet George</div>
              <h1 className="mt-3 text-[34px] font-black leading-tight tracking-tight text-[#173632] sm:text-[48px]">
                George for Steyning Leisure Centre
              </h1>
              <p className="mt-4 max-w-[700px] text-[17px] leading-8 text-[#556462]">
                A simpler Steyning page with George front and centre. George can help with memberships, swimming, classes,
                centre information, opening times, directions around the centre, and guided gym sessions.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-[15px] font-medium text-[#355552]">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm"><MapPin className="h-4 w-4 text-[#ef7d00]" /> Horsham Road, Steyning, West Sussex, BN44 3AA</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm"><Phone className="h-4 w-4 text-[#ef7d00]" /> 01903 879666</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm"><Clock3 className="h-4 w-4 text-[#ef7d00]" /> Open now · closes at 9.00pm</span>
              </div>
            </div>
            <div className="rounded-[24px] bg-[linear-gradient(180deg,#0f4d47_0%,#15655c_100%)] p-6 text-white shadow-[0_24px_60px_rgba(15,77,71,0.22)]">
              <div className="text-[14px] font-bold uppercase tracking-[0.16em] text-[#c8efe5]">Live with George</div>
              <p className="mt-4 text-[17px] leading-8 text-white/92">
                Tap George and speak naturally. He can answer centre questions, use the live timetable, and guide gym users step by step based on whether they are beginner, intermediate, or advanced.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <PlacesForPeopleGeorgeLiveAssistant />
      </section>

      <footer className="border-t border-[#d8ddd8] bg-[#0f4d47] text-white">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-6 px-4 py-10 text-center sm:px-6 lg:flex-row lg:px-8 lg:text-left">
          <div>
            <div className="text-[28px] font-black tracking-tight text-[#ef7d00]">
              Places <span className="text-white">Leisure</span>
            </div>
            <div className="mt-3 text-sm text-white/75">A George page for Steyning Leisure Centre</div>
            <a href="https://getgeorge.app" className="mt-3 inline-block text-sm font-semibold text-white underline underline-offset-4">
              getgeorge.app
            </a>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative h-[70px] w-[70px] overflow-hidden rounded-full border border-white/20 bg-white/10">
              <Image src="/george-logo.png" alt="George" fill className="object-contain p-2" />
            </div>
            <div className="text-sm leading-7 text-white/80">
              Helpful buttons stay underneath George so visitors can still jump straight to the official Steyning pages.
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
