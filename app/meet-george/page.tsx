import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Sparkles, TrendingUp } from "lucide-react"
import { Footer } from "@/components/footer"
import { GeorgeLiveAssistant } from "@/components/george-live-assistant"
import { Navigation } from "@/components/navigation"

export const metadata: Metadata = {
  title: " | Conversational Digital Member of Staff for Your Website",
  description:
    " — your conversational digital member of staff for your website. He talks to website visitors, answers questions about services and facilities, explains pricing and options, guides visitors toward becoming enquiries, and captures enquiry details automatically.",
  alternates: { canonical: "https://askgeorge.app" },
}

const proofPoints = [
  "Answers questions before visitors leave your site",
  "Makes the value obvious fast by responding instantly",
  "Helps turn more of your existing traffic into real opportunities",
]

export default function MeetGeorgePage() {
  return (
    <main className="min-h-screen bg-white text-[#0F172A]">
      <Navigation />

      <section className="px-4 pb-8 pt-10 sm:px-6 lg:px-8 lg:pt-16">
        <div className="mx-auto max-w-6xl rounded-[32px] border border-[#DADCE0] bg-[radial-gradient(circle_at_top,rgba(191,219,254,0.30),rgba(255,255,255,1)_38%),linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-[0_24px_90px_rgba(15,23,42,0.08)] sm:p-8 lg:p-12">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2 text-sm font-semibold text-[#1D4ED8] shadow-sm">
              <Sparkles className="h-4 w-4" />
              
            </div>
            <div className="mt-7 flex justify-center">
              <Image src="/george-logo.png" alt="George" width={420} height={140} className="h-28 w-auto sm:h-32 premium-floating-card" priority />
            </div>
            <h1 className="mx-auto mt-6 max-w-4xl text-balance text-4xl font-extrabold tracking-tight text-[#0F172A] sm:text-5xl lg:text-6xl">
              George speaks to your visitors before they leave
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-[#475569] sm:text-xl">
              This is where the value clicks. George answers questions instantly, explains your services, helps with pricing, and guides visitors toward becoming enquiries or bookings.
            </p>
            <p className="mx-auto mt-4 max-w-3xl text-base font-semibold leading-7 text-[#0F172A] sm:text-lg">
              This is exactly what George would be doing on your website.
            </p>

            <div className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-3">
              {proofPoints.map((point) => (
                <div key={point} className="rounded-2xl border border-[#DBEAFE] bg-white p-5 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(29,78,216,0.10)]">
                  <TrendingUp className="h-5 w-5 text-[#1D4ED8]" />
                  <p className="mt-3 text-sm font-semibold leading-6 text-[#0F172A]">{point}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/contact" className="cta-button-primary inline-flex items-center justify-center gap-3 rounded-2xl px-7 py-4 text-base font-bold text-white">
                Try George free for 7 days <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="https://alderwoodponds.fish" target="_blank" rel="noopener noreferrer" className="cta-button-secondary inline-flex items-center justify-center rounded-2xl px-7 py-4 text-base font-semibold text-[#0F172A]">
                See George live on a site
              </Link>
            </div>
          </div>
        </div>
      </section>

      <GeorgeLiveAssistant />
      <Footer />
    </main>
  )
}
