import type { Metadata } from "next"
import Image from "next/image"
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react"
import { PlacesForPeopleGeorgeLiveAssistant } from "@/components/placesforpeople-george-live-assistant"

export const metadata: Metadata = {
  title: "Steyning Leisure Centre | Meet George",
  description:
    "A polished Steyning Leisure Centre George page with Places Leisure inspired styling and guided membership help.",
  alternates: { canonical: "https://askgeorge.app/placesforpeople" },
  openGraph: {
    title: "Steyning Leisure Centre | Meet George",
    description:
      "A polished Steyning Leisure Centre George page with Places Leisure inspired styling and guided membership help.",
    url: "https://askgeorge.app/placesforpeople",
    type: "website",
  },
}

const heroLinks = [
  {
    label: "Join now",
    href: "https://www.placesleisure.org/membership/",
  },
  {
    label: "View timetable",
    href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/timetable",
  },
]

export default function PlacesForPeoplePage() {
  return (
    <main className="min-h-screen bg-[#eef0f2] text-[#394553]">
      <header className="relative overflow-hidden bg-[#394553] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,124,0,0.18),transparent_34%),radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_28%)]" />
        <div className="relative mx-auto max-w-[1240px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="flex items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm sm:px-6">
            <a href="https://www.placesleisure.org/" className="flex items-center gap-3" aria-label="Places Leisure homepage">
              <div className="flex h-11 w-11 items-center justify-center text-[#f47c00] sm:h-12 sm:w-12">
                <svg viewBox="0 0 42 42" className="h-11 w-11 fill-current sm:h-12 sm:w-12" aria-hidden="true">
                  <path d="M19.2 2.7 8.3 13.6c-2.3 2.3-2.3 6 0 8.3l10.1 10.1c2 2 5.2 2 7.2 0l8.2-8.2-6.1-6.1-6.7 6.7-6.8-6.8 10.9-10.9-5.9-5.9Z" />
                </svg>
              </div>
              <div className="leading-none">
                <div className="text-[26px] font-black tracking-tight sm:text-[30px]">Places</div>
                <div className="-mt-1 text-[26px] font-black tracking-tight sm:text-[30px]">Leisure</div>
                <div className="mt-1 text-[11px] text-white/80">Part of Places for People</div>
              </div>
            </a>

            <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 sm:flex">
              <Sparkles className="h-4 w-4 text-[#f47c00]" />
              Meet George
            </div>
          </div>
        </div>
      </header>

      <section className="border-b border-[#dde2e7] bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-[1240px] px-4 py-4 text-[15px] sm:px-6 lg:px-8">
          <span className="text-[#f47c00]">Home</span>
          <span className="px-3 text-[#687381]">&gt;</span>
          <span className="text-[#f47c00]">Steyning Leisure Centre</span>
        </div>
      </section>

      <section className="bg-[#eef0f2]">
        <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
          <div className="overflow-hidden rounded-[32px] border border-[#d9dee4] bg-white shadow-[0_28px_60px_rgba(57,69,83,0.10)]">
            <div className="grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.2fr_0.8fr] lg:px-12 lg:py-12">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#f47c00]/20 bg-[#fff6ed] px-4 py-2 text-sm font-semibold text-[#cc6500]">
                  <Sparkles className="h-4 w-4" />
                  Digital front-of-house for Steyning Leisure Centre
                </div>
                <div className="mt-5 text-[22px] font-black leading-none text-[#394553] sm:text-[28px] lg:text-[34px]">Welcome to</div>
                <h1 className="mt-3 text-[clamp(2.6rem,7vw,5.1rem)] font-black leading-[0.92] tracking-tight text-[#394553]">
                  Steyning Leisure
                  <br />
                  Centre
                </h1>
                <p className="mt-6 max-w-[760px] text-[17px] leading-[1.8] text-[#4f5d6c] sm:text-[20px] lg:text-[22px]">
                  Tap the round button to speak to George. He can help with memberships, the live timetable, swimming,
                  classes, centre questions, and the exact join process — including which button to click next.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  {heroLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      className="inline-flex items-center gap-2 rounded-full bg-[#f47c00] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 sm:text-base"
                    >
                      {link.label}
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-[#e5e7eb] bg-[#f7f8fa] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-6">
                <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#687381]">What George helps with</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {[
                    "Find the right membership",
                    "Walk through joining step by step",
                    "Check today’s classes and swims",
                    "Answer centre and facility questions",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-[#e1e5ea] bg-white px-4 py-4 text-sm font-semibold text-[#394553] shadow-sm">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl bg-[#394553] px-5 py-5 text-white">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-white/10">
                      <Image src="/george-logo.png" alt="George" fill className="object-contain p-2" />
                    </div>
                    <div>
                      <div className="text-sm font-bold uppercase tracking-[0.16em] text-white/70">Best starting prompts</div>
                      <div className="mt-1 text-base font-semibold">“I’m 22 and just want the gym”</div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm leading-7 text-white/90">George will recommend the right option, explain why, and tell visitors exactly which button to use next.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#eef0f2] pb-12 lg:pb-16">
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
