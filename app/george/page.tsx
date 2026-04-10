import type { Metadata } from "next"
import Image from "next/image"
import { ArrowRight, CheckCircle2, Dumbbell, Flame, Mic, MoonStar, ShieldCheck, UtensilsCrossed } from "lucide-react"

export const metadata: Metadata = {
  title: "George | Daily Fitness Coach",
  description:
    "George is a daily digital fitness coach built to help busy people stay on track with food, workouts, accountability, and real-life consistency.",
  alternates: { canonical: "https://askgeorge.app/george" },
}

const stats = [
  { label: "Calories left", value: "1,240" },
  { label: "Protein left", value: "86g" },
  { label: "Current streak", value: "6 days" },
]

const quickActions = ["Log meal", "I went off track", "What should I eat?", "Give me a workout"]

const features = [
  "Daily calorie and protein targets set for you",
  "Simple meal logging without a complicated app",
  "Instant support when life gets busy and you slip",
  "Workouts when you need them, based on your time and level",
  "A coach-style voice experience that fits around your schedule",
  "Ongoing accountability so you stop starting over every Monday",
]

export default function GeorgePage() {
  return (
    <main className="min-h-screen bg-[#07111F] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-500/12 blur-3xl" />
        <div className="absolute right-0 top-40 h-[24rem] w-[24rem] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-[-6rem] h-[22rem] w-[22rem] rounded-full bg-sky-400/10 blur-3xl" />
      </div>

      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-10 sm:px-8 lg:px-10 lg:py-14">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.22)] backdrop-blur">
              <Image src="/george-logo.png" alt="George" width={112} height={28} className="h-7 w-auto" priority />
            </div>
            <span className="hidden rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100 sm:inline-flex">
              Daily digital coach
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

        <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-2xl pt-4 lg:pt-10">
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
              A coach-style fitness page that tells you what to do, keeps you accountable, and gives you support when
              you actually need it — on your schedule, not someone else’s.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="flex items-center gap-3 text-sm text-cyan-100">
                  <UtensilsCrossed className="h-4 w-4" />
                  Food guidance without the overwhelm
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Know what to eat, log it quickly, and get back on track fast when the day goes sideways.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="flex items-center gap-3 text-sm text-cyan-100">
                  <Dumbbell className="h-4 w-4" />
                  Workouts when you need them
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Gym or home, short or longer — George helps you keep momentum without overthinking it.
                </p>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6">
              <div className="rounded-[1.6rem] border border-white/10 bg-[#081424]/95 p-6">
                <div className="flex justify-center pb-6 pt-2">
                  <button
                    type="button"
                    className="group relative flex h-56 w-56 items-center justify-center rounded-full border border-cyan-300/30 bg-[radial-gradient(circle_at_30%_30%,rgba(125,211,252,0.45),rgba(14,116,144,0.24),rgba(2,6,23,0.85))] shadow-[0_0_0_10px_rgba(255,255,255,0.02),0_0_100px_rgba(34,211,238,0.25)] transition duration-300 hover:scale-[1.02]"
                  >
                    <div className="absolute inset-4 rounded-full border border-white/10" />
                    <div className="absolute inset-0 animate-pulse rounded-full bg-cyan-300/10 blur-2xl" />
                    <div className="relative z-10 flex flex-col items-center gap-3 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10">
                        <Mic className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <div className="text-xl font-semibold">Talk to George</div>
                        <div className="mt-1 text-sm text-cyan-100/85">Tap when you’re ready</div>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {stats.map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{stat.label}</div>
                      <div className="mt-2 text-2xl font-semibold text-white">{stat.value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Quick starts</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {quickActions.map((action) => (
                      <button
                        key={action}
                        type="button"
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-cyan-400/15 bg-cyan-400/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/75">Today’s message</div>
                  <p className="mt-2 text-base leading-7 text-cyan-50">
                    “Long day? No problem. We’re not starting over — we’re just picking it back up. Tell me what’s gone
                    on so far and I’ll help you sort the rest.”
                  </p>
                </div>
              </div>
            </div>
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

        <div id="pricing" className="rounded-[2rem] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.12),rgba(8,20,36,0.9))] p-6 shadow-[0_24px_80px_rgba(6,182,212,0.15)] sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
            <MoonStar className="h-4 w-4" />
            One simple membership
          </div>
          <h2 className="mt-5 text-3xl font-semibold text-white sm:text-4xl">George Coaching</h2>
          <p className="mt-3 max-w-md text-base leading-7 text-slate-300">
            Built for people who know what to do, but keep falling off when life gets busy. George keeps the plan moving
            and keeps you honest.
          </p>

          <div className="mt-8 rounded-3xl border border-white/10 bg-[#07111f]/70 p-5">
            <div className="flex items-end gap-2">
              <span className="text-5xl font-semibold text-white">£24.99</span>
              <span className="pb-1 text-sm text-slate-400">/ month</span>
            </div>
            <div className="mt-3 text-sm text-cyan-100">Includes a 3-day free trial</div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
              <li>• Daily accountability and support from George</li>
              <li>• Meal guidance, food logging, and reset help when you slip</li>
              <li>• On-demand workouts for gym or home</li>
              <li>• A coach that fits around your schedule</li>
            </ul>
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
