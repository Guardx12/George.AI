import type { Metadata } from "next"
import Image from "next/image"
import { CheckCircle2, Dumbbell, Flame, ShieldCheck, UtensilsCrossed } from "lucide-react"
import { GeorgeLiveAssistant } from "@/components/george-live-assistant"

export const metadata: Metadata = {
  title: "Coach George | Daily Fitness Coach",
  description:
    "Coach George is a live voice fitness coach built to help busy people stay on track with food, workouts, accountability, and real-life consistency.",
  alternates: { canonical: "https://askgeorge.app/george" },
}

const features = [
  "Daily calorie and protein guidance without overthinking it",
  "Quick support when you go off track and need to reset fast",
  "Workout help for home or gym based on your time and level",
  "A real coach-style voice experience that fits around your life",
  "Simple accountability so you stop starting over every Monday",
]

export default function GeorgePage() {
  return (
    <main className="min-h-screen bg-[#07111F] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-500/12 blur-3xl" />
        <div className="absolute right-0 top-40 h-[24rem] w-[24rem] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-[-6rem] h-[22rem] w-[22rem] rounded-full bg-sky-400/10 blur-3xl" />
      </div>

      <section className="relative mx-auto w-full max-w-7xl px-6 py-10 sm:px-8 lg:px-10 lg:py-12">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.22)] backdrop-blur">
              <Image src="/george-logo.png" alt="Coach George" width={112} height={28} className="h-7 w-auto" priority />
            </div>
            <span className="hidden rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100 sm:inline-flex">
              Coach George
            </span>
          </div>
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl pt-2 lg:pt-6">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-100">
              <ShieldCheck className="h-4 w-4" />
              Built for busy people who keep falling off
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Life gets busy.
              <span className="block bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent">
                George keeps you on track anyway.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
              A live voice coach that helps you with food, workouts, accountability, and getting back on track fast — on your schedule, not someone else's.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="flex items-center gap-3 text-sm text-cyan-100">
                  <UtensilsCrossed className="h-4 w-4" />
                  Food guidance without the overwhelm
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Know what to eat next, log food quickly, and get back on track without turning it into a full-time job.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="flex items-center gap-3 text-sm text-cyan-100">
                  <Dumbbell className="h-4 w-4" />
                  Workouts when you need them
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Gym or home, short or longer — George helps you keep momentum without overthinking every session.
                </p>
              </div>
            </div>
          </div>

          <div className="w-full">
            <GeorgeLiveAssistant />
          </div>
        </div>
      </section>

      <section className="relative mx-auto grid w-full max-w-7xl gap-8 px-6 pb-12 sm:px-8 lg:grid-cols-[1fr_0.85fr] lg:px-10 lg:pb-20">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-center gap-3 text-cyan-100">
            <Flame className="h-5 w-5" />
            <span className="text-sm uppercase tracking-[0.18em]">What you get</span>
          </div>
          <div className="grid gap-4">
            {features.map((feature) => (
              <div key={feature} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-[#0a1628]/70 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                <p className="text-base leading-7 text-slate-200">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.12),rgba(8,20,36,0.9))] p-6 shadow-[0_24px_80px_rgba(6,182,212,0.15)] sm:p-8">
          <h2 className="text-3xl font-semibold text-white sm:text-4xl">George Coaching</h2>
          <p className="mt-3 max-w-md text-base leading-7 text-slate-300">
            Built for people who know what to do, but keep falling off when life gets busy.
          </p>
          <div className="mt-8 rounded-3xl border border-white/10 bg-[#07111F]/70 p-5">
            <div className="text-sm uppercase tracking-[0.18em] text-cyan-100/80">Membership</div>
            <div className="mt-2 text-5xl font-semibold text-white">£24.99</div>
            <div className="mt-2 text-base text-slate-300">per month after your 3-day free trial</div>
          </div>
        </div>
      </section>
    </main>
  )
}
