import type { Metadata } from "next"
import Image from "next/image"
import { ArrowRight, CheckCircle2, Flame, ShieldCheck, Sparkles } from "lucide-react"
import { CoachGeorgeLiveAssistant } from "@/components/coach-george-live-assistant"

export const metadata: Metadata = {
  title: "Coach George | Daily Fitness Coach",
  description:
    "Coach George is a live voice fitness coach built to help busy people stay on track with food, workouts, accountability, and real-life consistency.",
  alternates: { canonical: "https://askgeorge.app/george" },
}

const features = [
  "Know what to do each day without overthinking it",
  "Get back on track fast when life gets busy",
  "Log meals quickly and see where you stand",
  "Get simple workout help for home or gym",
]

export default function GeorgePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#06111c] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_28%),linear-gradient(180deg,#06111c_0%,#071522_48%,#06111c_100%)]" />
        <div className="absolute left-1/2 top-20 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute right-[-5rem] top-[18rem] h-[22rem] w-[22rem] rounded-full bg-emerald-400/8 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-[-6rem] h-[22rem] w-[22rem] rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <section className="relative mx-auto flex w-full max-w-7xl flex-col px-6 pb-10 pt-8 sm:px-8 lg:px-10 lg:pb-16">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.22)] backdrop-blur">
              <Image src="/george-logo.png" alt="George" width={112} height={28} className="h-7 w-auto" priority />
            </div>
            <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100 sm:inline-flex">
              Coach George
            </span>
          </div>
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Start your 3-day trial
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="mx-auto mt-8 max-w-3xl text-center lg:mt-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-100">
            <ShieldCheck className="h-4 w-4" />
            Built for busy people who keep falling off
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Life gets busy.
            <span className="mt-1 block bg-gradient-to-r from-white via-cyan-100 to-emerald-200 bg-clip-text text-transparent">
              George keeps you on track anyway.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
            Your live fitness coach for food, workouts, accountability, and getting back on track fast — whenever you’re ready.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-300">
            {['Food guidance','Workouts','Accountability','Real-life consistency'].map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{item}</span>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-8 w-full max-w-4xl lg:mt-10">
          <CoachGeorgeLiveAssistant />
        </div>
      </section>

      <section className="relative mx-auto grid w-full max-w-7xl gap-6 px-6 pb-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:pb-20">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-center gap-3 text-cyan-100">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm uppercase tracking-[0.18em]">What you get</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <div key={feature} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-[#0b1828]/75 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <p className="text-base leading-7 text-slate-200">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        <div id="pricing" className="rounded-[2rem] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.1),rgba(8,20,36,0.92))] p-6 shadow-[0_24px_80px_rgba(8,145,178,0.18)] sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
            One simple membership
          </div>
          <h2 className="mt-5 text-3xl font-semibold text-white sm:text-4xl">Coach George</h2>
          <p className="mt-3 max-w-md text-base leading-7 text-slate-300">
            For people who are sick of starting over every Monday and want something they’ll actually use.
          </p>

          <div className="mt-8 rounded-3xl border border-white/10 bg-[#07111f]/70 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Membership</div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-5xl font-semibold text-white">£24.99</span>
            </div>
            <div className="mt-3 text-base text-slate-300">per month after your 3-day free trial</div>
            <div className="mt-6 space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-2"><Flame className="h-4 w-4 text-emerald-300" /> Daily guidance without overthinking it</div>
              <div className="flex items-center gap-2"><Flame className="h-4 w-4 text-emerald-300" /> Real accountability when life gets busy</div>
              <div className="flex items-center gap-2"><Flame className="h-4 w-4 text-emerald-300" /> Food, workouts, and resets on your schedule</div>
            </div>
            <a
              href="#"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-95"
            >
              Start your 3-day trial
              <ArrowRight className="h-4 w-4" />
            </a>
            <p className="mt-3 text-center text-xs text-slate-500">Cancel any time before the trial ends.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
