"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  BarChart3,
  ChevronRight,
  Dumbbell,
  Flame,
  Loader2,
  PhoneOff,
  Salad,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"
type ActivityLevel = "sedentary" | "lightly active" | "moderately active" | "very active"
type Goal = "lose fat" | "maintain" | "gain muscle"
type Sex = "male" | "female"
type Country = "UK" | "US"
type QuickActionKey = "log_meal" | "off_track" | "what_eat" | "workout"
type OnboardingStep = "goal" | "sex" | "age" | "height" | "weight" | "activity" | "country" | "done"

type CoachProfile = {
  country: Country
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goal: Goal
}

type CoachStats = {
  caloriesTarget: number
  proteinTarget: number
  caloriesUsed: number
  proteinUsed: number
  mealsToday: number
  streak: number
  lastActiveDate: string | null
}

const STORAGE_KEY = "coach-george-v3-messages"
const PROFILE_KEY = "coach-george-profile-v2"
const STATS_KEY = "coach-george-stats-v5"

const DEFAULT_PROFILE: CoachProfile = {
  country: "UK",
  sex: "male",
  age: 30,
  heightCm: 180,
  weightKg: 90,
  activityLevel: "moderately active",
  goal: "lose fat",
}

const DEFAULT_STATS: CoachStats = {
  caloriesTarget: 0,
  proteinTarget: 0,
  caloriesUsed: 0,
  proteinUsed: 0,
  mealsToday: 0,
  streak: 0,
  lastActiveDate: null,
}

const QUICK_ACTIONS: Array<{ key: QuickActionKey; label: string; icon: any; accent: string }> = [
  { key: "log_meal", label: "Log meal", icon: UtensilsCrossed, accent: "from-sky-400/25 to-sky-500/5" },
  { key: "off_track", label: "Went off track", icon: Flame, accent: "from-amber-400/25 to-amber-500/5" },
  { key: "what_eat", label: "What should I eat?", icon: Salad, accent: "from-emerald-400/25 to-emerald-500/5" },
  { key: "workout", label: "Give me a workout", icon: Dumbbell, accent: "from-cyan-400/25 to-cyan-500/5" },
]

function makeMessage(role: LiveMessage["role"], content: string): LiveMessage {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${role}-${Date.now()}-${Math.random()}`,
    role,
    content,
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayIso() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function markUsage(stats: CoachStats): CoachStats {
  const today = todayIso()
  if (stats.lastActiveDate === today) return stats
  if (stats.lastActiveDate === yesterdayIso()) return { ...stats, streak: stats.streak + 1, lastActiveDate: today }
  return { ...stats, streak: 1, lastActiveDate: today }
}

function calculateTargets(profile: CoachProfile) {
  const baseBmr =
    10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + (profile.sex === "male" ? 5 : -161)

  const multiplierMap: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    "lightly active": 1.375,
    "moderately active": 1.55,
    "very active": 1.725,
  }

  const maintenance = baseBmr * multiplierMap[profile.activityLevel]
  const calories = profile.goal === "lose fat" ? maintenance - 400 : profile.goal === "gain muscle" ? maintenance + 200 : maintenance
  const proteinMultiplier = profile.goal === "maintain" ? 1.8 : 2

  return {
    caloriesTarget: Math.round(calories / 50) * 50,
    proteinTarget: Math.round((profile.weightKg * proteinMultiplier) / 5) * 5,
  }
}

function caloriesLeft(stats: CoachStats) {
  return Math.max(0, stats.caloriesTarget - stats.caloriesUsed)
}

function proteinLeft(stats: CoachStats) {
  return Math.max(0, stats.proteinTarget - stats.proteinUsed)
}

function isProfileComplete(profile: CoachProfile | null, stats: CoachStats) {
  return Boolean(
    profile &&
      profile.age > 0 &&
      profile.heightCm > 0 &&
      profile.weightKg > 0 &&
      profile.goal &&
      profile.sex &&
      profile.activityLevel &&
      profile.country &&
      stats.caloriesTarget > 0 &&
      stats.proteinTarget > 0,
  )
}

function profileContext(profile: CoachProfile | null, stats: CoachStats) {
  if (!isProfileComplete(profile, stats)) {
    return `This user is not set up yet. You must onboard them first. Ask one question at a time and collect: goal, sex, age, height, weight, activity level, then country. Once complete, explain that their calories and protein are set and you’ll guide the rest. Do not skip setup.`
  }

  return `Saved profile:
- country: ${profile!.country}
- sex: ${profile!.sex}
- age: ${profile!.age}
- height: ${profile!.heightCm} cm
- weight: ${profile!.weightKg} kg
- activity: ${profile!.activityLevel}
- goal: ${profile!.goal}
- calorie target: ${stats.caloriesTarget}
- protein target: ${stats.proteinTarget}
- calories left right now: ${caloriesLeft(stats)}
- protein left right now: ${proteinLeft(stats)}
- meals logged today: ${stats.mealsToday}
- streak: ${stats.streak}
Use this automatically. Do not ask for stats again unless the user says they’ve changed.`
}

function parseSex(input: string): Sex | null {
  const t = input.toLowerCase()
  if (/(^|\b)(male|man|guy|bloke)(\b|$)/.test(t)) return "male"
  if (/(^|\b)(female|woman|girl|lady)(\b|$)/.test(t)) return "female"
  return null
}

function parseGoal(input: string): Goal | null {
  const t = input.toLowerCase()
  if (t.includes("lose") || t.includes("fat loss") || t.includes("cut") || t.includes("lean down")) return "lose fat"
  if (t.includes("gain") || t.includes("muscle") || t.includes("bulk")) return "gain muscle"
  if (t.includes("maintain") || t.includes("maintenance")) return "maintain"
  return null
}

function parseAge(input: string) {
  const m = input.match(/\b(1[6-9]|[2-8][0-9]|9[0-9])\b/)
  return m ? Number(m[1]) : null
}

function parseHeightCm(input: string) {
  const t = input.toLowerCase()
  const cm = t.match(/(\d{3})\s*cm/)
  if (cm) return Number(cm[1])
  const plain = t.match(/\b(1[4-9]\d|2[0-2]\d)\b/)
  if (plain) return Number(plain[1])
  const ftIn = t.match(/(\d)\s*(?:ft|foot|feet|')\s*(\d{1,2})?/) || t.match(/(\d)\s*(?:foot|feet)\s*(\d{1,2})/)
  if (ftIn) {
    const feet = Number(ftIn[1])
    const inches = Number(ftIn[2] || 0)
    return Math.round(feet * 30.48 + inches * 2.54)
  }
  return null
}

function parseWeightKg(input: string) {
  const t = input.toLowerCase()
  const kg = t.match(/(\d{2,3}(?:\.\d+)?)\s*kg/)
  if (kg) return Math.round(Number(kg[1]))
  const lbs = t.match(/(\d{2,3})\s*(?:lb|lbs|pounds?)/)
  if (lbs) return Math.round(Number(lbs[1]) * 0.453592)
  const stone = t.match(/(\d{1,2})\s*(?:st|stone)\s*(\d{1,2})?/) 
  if (stone) return Math.round(Number(stone[1]) * 6.35029 + Number(stone[2] || 0) * 0.453592)
  const plain = t.match(/\b(4\d|5\d|6\d|7\d|8\d|9\d|1\d\d|2[0-2]\d)\b/)
  return plain ? Number(plain[1]) : null
}

function parseActivity(input: string): ActivityLevel | null {
  const t = input.toLowerCase()
  if (t.includes("sedentary") || t.includes("desk") || t.includes("not very active")) return "sedentary"
  if (t.includes("light") || t.includes("few walks") || t.includes("lightly active")) return "lightly active"
  if (t.includes("moderate") || t.includes("moderately active") || t.includes("3 times") || t.includes("4 times")) return "moderately active"
  if (t.includes("very active") || t.includes("active") || t.includes("train a lot") || t.includes("5 times") || t.includes("6 times")) return "very active"
  return null
}

function parseCountry(input: string): Country | null {
  const t = input.toLowerCase()
  if (t.includes("uk") || t.includes("united kingdom") || t.includes("england") || t.includes("britain")) return "UK"
  if (t.includes("us") || t.includes("usa") || t.includes("america") || t.includes("united states")) return "US"
  return null
}

function getOnboardingStep(profile: CoachProfile | null, stats: CoachStats): OnboardingStep {
  if (!profile?.goal) return "goal"
  if (!profile?.sex) return "sex"
  if (!profile?.age) return "age"
  if (!profile?.heightCm) return "height"
  if (!profile?.weightKg) return "weight"
  if (!profile?.activityLevel) return "activity"
  if (!profile?.country) return "country"
  if (!(stats.caloriesTarget > 0 && stats.proteinTarget > 0)) return "country"
  return "done"
}

function applyOnboardingAnswer(step: OnboardingStep, input: string, prevProfile: CoachProfile): { profile: CoachProfile; complete: boolean } {
  const next = { ...prevProfile }
  if (step === "goal") {
    const value = parseGoal(input)
    if (value) next.goal = value
  } else if (step === "sex") {
    const value = parseSex(input)
    if (value) next.sex = value
  } else if (step === "age") {
    const value = parseAge(input)
    if (value) next.age = value
  } else if (step === "height") {
    const value = parseHeightCm(input)
    if (value) next.heightCm = value
  } else if (step === "weight") {
    const value = parseWeightKg(input)
    if (value) next.weightKg = value
  } else if (step === "activity") {
    const value = parseActivity(input)
    if (value) next.activityLevel = value
  } else if (step === "country") {
    const value = parseCountry(input)
    if (value) next.country = value
  }
  const complete = Boolean(next.goal && next.sex && next.age && next.heightCm && next.weightKg && next.activityLevel && next.country)
  return { profile: next, complete }
}

function nextOnboardingInstruction(step: OnboardingStep) {
  switch (step) {
    case "goal":
      return "Start setup. Ask only this: what’s your main goal right now — lose fat, maintain, or gain muscle?"
    case "sex":
      return "Good. Now ask only this: are you male or female?"
    case "age":
      return "Now ask only this: how old are you?"
    case "height":
      return "Now ask only this: what’s your height? Accept cm or feet and inches."
    case "weight":
      return "Now ask only this: what’s your current weight? Accept kg, lb, or stone."
    case "activity":
      return "Now ask only this: how active are you day to day — sedentary, lightly active, moderately active, or very active?"
    case "country":
      return "Now ask only this: are you in the UK or the US?"
    case "done":
      return "Setup is complete. Briefly confirm that their calories and protein are set, then ask what they want help with right now."
  }
}

function buildFirstResponseEvent(profile: CoachProfile | null, stats: CoachStats) {
  const complete = isProfileComplete(profile, stats)
  const instructions = complete
    ? `${profileContext(profile, stats)}\n\nGreet them like a returning user in one short line. Then ask what they want help with right now.`
    : `${profileContext(profile, stats)}\n\n${nextOnboardingInstruction(getOnboardingStep(profile ?? DEFAULT_PROFILE, stats))}`
  return {
    type: "response.create",
    response: { instructions },
  }
}

function buildQuickPrompt(actionKey: QuickActionKey, profile: CoachProfile | null, stats: CoachStats) {
  const context = profileContext(profile, stats)
  switch (actionKey) {
    case "log_meal":
      return `${context}\nThe user tapped Log meal. Ask what they had before estimating anything. Ask one short follow-up if portion is unclear. Then estimate calories and protein consistently, update what is left, and tell them the next best move.`
    case "off_track":
      return `${context}\nThe user tapped Went off track. Reset them calmly but firmly. Ask what actually happened. Do not shame them. Then tell them the next best move for today.`
    case "what_eat":
      return `${context}\nThe user tapped What should I eat. Consider how many meals are likely left today before recommending anything. Give specific portion sizes, rough calories, and rough protein for the next meal. Do not be vague.`
    case "workout":
      return `${context}\nThe user tapped Give me a workout. Ask only what you need, then give a simple structured workout they can do now.`
  }
}

function buildCoachGuidance(profile: CoachProfile | null, stats: CoachStats) {
  if (!isProfileComplete(profile, stats)) return "First time here? Tap to talk and George will get you set up properly."
  const cals = caloriesLeft(stats)
  const protein = proteinLeft(stats)
  if (stats.mealsToday === 0) return `You’re set for ${stats.caloriesTarget} kcal and ${stats.proteinTarget}g protein today.`
  if (stats.mealsToday === 1) return `You’ve got ${cals} kcal and ${protein}g protein left. Keep the next meal controlled.`
  return `${cals} kcal and ${protein}g protein left. Keep the rest of the day tight.`
}

export function CoachGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [statusText, setStatusText] = useState("Ready when you are")
  const [isModelSpeaking, setIsModelSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<CoachStats>(DEFAULT_STATS)
  const [profile, setProfile] = useState<CoachProfile | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const queuedPromptRef = useRef<string | null>(null)
  const onboardingProfileRef = useRef<CoachProfile>(DEFAULT_PROFILE)

  const profileReady = isProfileComplete(profile, stats)
  const latestAssistantMessage = useMemo(() => {
    const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant")
    return latestAssistant?.content || buildCoachGuidance(profile, stats)
  }, [messages, profile, stats])

  useEffect(() => {
    try {
      const rawMessages = window.localStorage.getItem(STORAGE_KEY)
      if (rawMessages) {
        const parsed = JSON.parse(rawMessages)
        if (Array.isArray(parsed?.messages)) setMessages(parsed.messages)
      }
    } catch {}

    try {
      const rawStats = window.localStorage.getItem(STATS_KEY)
      if (rawStats) {
        const parsed = JSON.parse(rawStats)
        if (parsed && typeof parsed === "object") setStats({ ...DEFAULT_STATS, ...parsed })
      }
    } catch {}

    try {
      const rawProfile = window.localStorage.getItem(PROFILE_KEY)
      if (rawProfile) {
        const parsed = JSON.parse(rawProfile)
        if (parsed && typeof parsed === "object") {
          setProfile(parsed)
          onboardingProfileRef.current = { ...DEFAULT_PROFILE, ...parsed }
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: messages.slice(-24) }))
    } catch {}
  }, [messages])

  useEffect(() => {
    try {
      window.localStorage.setItem(STATS_KEY, JSON.stringify(stats))
    } catch {}
  }, [stats])

  useEffect(() => {
    try {
      if (profile) window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
    } catch {}
  }, [profile])

  async function cleanupConversation() {
    dcRef.current?.close()
    dcRef.current = null
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => sender.track?.stop())
      pcRef.current.close()
      pcRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.srcObject = null
      audioRef.current.remove()
      audioRef.current = null
    }
    currentAssistantTextRef.current = ""
    currentAssistantMessageIdRef.current = null
    setIsModelSpeaking(false)
  }

  function appendOrUpdateAssistantPartial(delta: string, isFinal = false) {
    if (!delta) return
    if (!currentAssistantMessageIdRef.current) {
      const message = makeMessage("assistant", delta)
      currentAssistantMessageIdRef.current = message.id
      currentAssistantTextRef.current = delta
      setMessages((prev) => [...prev, message])
      if (isFinal) {
        currentAssistantMessageIdRef.current = null
        currentAssistantTextRef.current = ""
      }
      return
    }
    currentAssistantTextRef.current += delta
    const targetId = currentAssistantMessageIdRef.current
    setMessages((prev) => prev.map((m) => (m.id === targetId ? { ...m, content: currentAssistantTextRef.current } : m)))
    if (isFinal) {
      currentAssistantMessageIdRef.current = null
      currentAssistantTextRef.current = ""
    }
  }

  function addUserTranscript(text: string) {
    const cleaned = text.trim()
    if (!cleaned) return
    setMessages((prev) => [...prev, makeMessage("user", cleaned)])

    if (!profileReady) {
      const currentProfile = onboardingProfileRef.current
      const step = getOnboardingStep(currentProfile, stats)
      if (step !== "done") {
        const applied = applyOnboardingAnswer(step, cleaned, currentProfile)
        onboardingProfileRef.current = applied.profile

        if (applied.complete) {
          const targets = calculateTargets(applied.profile)
          const nextStats = {
            ...stats,
            ...targets,
            caloriesUsed: 0,
            proteinUsed: 0,
            mealsToday: 0,
          }
          setProfile(applied.profile)
          setStats((prev) => ({ ...prev, ...nextStats }))
          const dc = dcRef.current
          if (dc?.readyState === "open") {
            dc.send(JSON.stringify({ type: "response.create", response: { instructions: `${profileContext(applied.profile, nextStats)}\nSetup is complete. Briefly confirm their calorie and protein targets, then ask what they want help with right now.` } }))
          }
          return
        }

        const nextStep = getOnboardingStep(onboardingProfileRef.current, stats)
        const dc = dcRef.current
        if (dc?.readyState === "open") {
          dc.send(JSON.stringify({ type: "response.create", response: { instructions: nextOnboardingInstruction(nextStep) } }))
        }
      }
    }
  }

  function sendTextPrompt(prompt: string) {
    const dc = dcRef.current
    if (!dc || dc.readyState !== "open") return
    setMessages((prev) => [...prev, makeMessage("user", prompt)])
    dc.send(JSON.stringify({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: prompt }] } }))
    dc.send(JSON.stringify({ type: "response.create" }))
  }

  function handleRealtimeEvent(event: any) {
    const type = event?.type
    if (!type) return
    switch (type) {
      case "session.created":
      case "session.updated":
        setStatusText("George is live")
        break
      case "input_audio_buffer.speech_started":
        setStatusText("Listening…")
        break
      case "input_audio_buffer.speech_stopped":
        setStatusText("Thinking…")
        break
      case "response.created":
        setIsModelSpeaking(true)
        setStatusText("George is replying…")
        break
      case "response.output_audio.delta":
        setIsModelSpeaking(true)
        setStatusText("George is replying…")
        break
      case "response.output_audio.done":
        setIsModelSpeaking(false)
        setStatusText("Listening…")
        break
      case "response.output_audio_transcript.delta":
        appendOrUpdateAssistantPartial(typeof event.delta === "string" ? event.delta : "")
        break
      case "response.output_audio_transcript.done":
        appendOrUpdateAssistantPartial(typeof event.transcript === "string" ? event.transcript : "", true)
        break
      case "conversation.item.input_audio_transcription.completed":
        addUserTranscript(typeof event.transcript === "string" ? event.transcript : "")
        setStats((prev) => markUsage(prev))
        break
      case "error":
        setError(event?.error?.message || "George hit a voice error.")
        setStatusText("There was a connection problem")
        break
      default:
        break
    }
  }

  async function startConversation() {
    await cleanupConversation()
    setConnectionState("connecting")
    setError(null)
    setStatusText("Connecting George…")
    try {
      const tokenResponse = await fetch("/api/george-session", { method: "GET", cache: "no-store" })
      const tokenData = await tokenResponse.json().catch(() => null)
      if (!tokenResponse.ok) throw new Error(typeof tokenData?.error === "string" ? tokenData.error : "Could not create a secure live session.")
      const ephemeralKey = tokenData?.client_secret?.value || tokenData?.value
      if (typeof ephemeralKey !== "string" || !ephemeralKey) throw new Error("Live voice token was missing.")

      const pc = new RTCPeerConnection()
      pcRef.current = pc
      const audio = document.createElement("audio")
      audio.autoplay = true
      audio.playsInline = true
      audioRef.current = audio
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0]
        void audio.play().catch(() => {})
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })
      localStreamRef.current = stream
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      const dc = pc.createDataChannel("oai-events")
      dcRef.current = dc
      dc.addEventListener("open", () => {
        setConnectionState("connected")
        setStatusText("Listening…")
        setStats((prev) => markUsage(prev))
        window.setTimeout(() => {
          dc.send(JSON.stringify(buildFirstResponseEvent(profile, stats)))
          if (queuedPromptRef.current) {
            const prompt = queuedPromptRef.current
            queuedPromptRef.current = null
            window.setTimeout(() => sendTextPrompt(prompt), 350)
          }
        }, 150)
      })
      dc.addEventListener("message", (event) => {
        try {
          handleRealtimeEvent(JSON.parse(event.data))
        } catch {}
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${ephemeralKey}`, "Content-Type": "application/sdp" },
        body: offer.sdp,
      })
      const answerText = await response.text()
      if (!response.ok) throw new Error(answerText.trim() || "Could not connect George.")
      await pc.setRemoteDescription({ type: "answer", sdp: answerText })
      pc.addEventListener("connectionstatechange", () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          setConnectionState("error")
          setStatusText("Connection ended")
        }
      })
    } catch (err) {
      await cleanupConversation()
      setConnectionState("error")
      setStatusText("Could not connect George")
      setError(err instanceof Error ? err.message : "Could not connect George right now.")
    }
  }

  async function stopConversation() {
    await cleanupConversation()
    setConnectionState("idle")
    setStatusText("Ready when you are")
    setError(null)
  }

  function handleQuickAction(actionKey: QuickActionKey) {
    setStats((prev) => {
      let next = markUsage(prev)
      if (actionKey === "log_meal") next = { ...next, mealsToday: next.mealsToday + 1 }
      return next
    })
    const prompt = buildQuickPrompt(actionKey, profile, stats)
    if (connectionState === "connected") {
      sendTextPrompt(prompt)
      return
    }
    queuedPromptRef.current = prompt
    void startConversation()
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030507] text-white">
      <style jsx>{`
        @keyframes ringPulse {
          0%, 100% { transform: scale(1); opacity: 0.82; }
          50% { transform: scale(1.02); opacity: 1; }
        }
        @keyframes coreGlow {
          0%, 100% { box-shadow: 0 0 40px rgba(34,211,238,.14), inset 0 0 40px rgba(34,211,238,.08); }
          50% { box-shadow: 0 0 70px rgba(34,211,238,.23), inset 0 0 58px rgba(251,146,60,.10); }
        }
        @keyframes shimmer {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(18,214,214,0.17),transparent_24%),radial-gradient(circle_at_50%_32%,rgba(59,130,246,0.10),transparent_40%),linear-gradient(180deg,#010305_0%,#07101a_48%,#010305_100%)]" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:10px_10px]" />
        <div className="absolute left-1/2 top-28 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-cyan-400/12 blur-[110px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-10">
        <div className="text-center">
          <div className="text-[42px] font-semibold tracking-[0.28em] text-white sm:text-[52px]">GEORGE</div>
          <div className="mt-2 text-[12px] uppercase tracking-[0.5em] text-slate-400">Tap to talk</div>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            disabled={connectionState === "connecting"}
            onClick={connectionState === "connected" ? stopConversation : startConversation}
            className="group relative flex h-[350px] w-[350px] items-center justify-center rounded-full focus:outline-none disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 rounded-full border border-cyan-300/15 opacity-80" style={{ animation: "ringPulse 3.4s ease-in-out infinite" }} />
            <div className="absolute inset-[14px] rounded-full border border-cyan-400/18" />
            <div className="absolute inset-[28px] rounded-full border border-cyan-400/20" style={{ animation: "ringPulse 2.8s ease-in-out infinite" }} />
            <div className="absolute inset-[40px] rounded-full border border-amber-300/10" />
            <div className="absolute inset-[18px] rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,rgba(34,211,238,.0),rgba(34,211,238,.28),rgba(251,146,60,.14),rgba(34,211,238,.0))] opacity-90 blur-[1px]" style={{ animation: "shimmer 12s linear infinite" }} />
            <div className="absolute inset-[62px] rounded-full border border-cyan-200/8 bg-[radial-gradient(circle_at_50%_45%,rgba(22,163,184,.32),rgba(3,7,18,.95)_70%)]" style={{ animation: "coreGlow 4.3s ease-in-out infinite" }} />
            <div className="absolute inset-[82px] rounded-full bg-[radial-gradient(circle_at_50%_36%,rgba(148,163,184,.46),rgba(15,23,42,.12)_18%,rgba(2,6,23,.92)_58%)]" />
            <div className="absolute inset-[98px] rounded-full bg-[radial-gradient(circle_at_50%_28%,rgba(34,211,238,.18),transparent_18%),radial-gradient(circle_at_50%_62%,rgba(34,211,238,.08),transparent_50%)]" />
            <div className="absolute left-1/2 top-[102px] flex h-20 w-20 -translate-x-1/2 items-center justify-center rounded-full border border-white/18 bg-white/12 shadow-[0_12px_40px_rgba(0,0,0,.35)] backdrop-blur">
              <BarChart3 className="h-9 w-9 text-white/90" />
            </div>
            <div className="relative z-10 mt-16 text-center">
              <div className="text-[52px] font-semibold tracking-tight text-white">George</div>
              <div className="mt-2 text-2xl text-white/85">{connectionState === "connecting" ? "Connecting…" : connectionState === "connected" ? "Live now" : "Tap to talk"}</div>
            </div>
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          {[
            { label: "Calories left", value: stats.caloriesTarget > 0 ? caloriesLeft(stats) : "--" },
            { label: "Protein left", value: stats.proteinTarget > 0 ? `${proteinLeft(stats)}g` : "--" },
            { label: "Meals today", value: stats.mealsToday },
            { label: "Day streak", value: stats.streak },
          ].map((item, index) => (
            <div
              key={item.label}
              className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.92),rgba(2,8,20,.94))] px-6 py-5 shadow-[0_18px_55px_rgba(0,0,0,.28)]"
            >
              <div className="text-[10px] uppercase tracking-[0.34em] text-slate-500">{item.label}</div>
              <div className={`mt-4 text-[54px] font-semibold leading-none text-white ${index === 1 ? "text-[52px]" : ""}`}>{item.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.key}
                type="button"
                onClick={() => handleQuickAction(action.key)}
                className={`group relative flex w-full items-center gap-5 overflow-hidden rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.95),rgba(3,7,18,.96))] px-5 py-5 text-left shadow-[0_18px_55px_rgba(0,0,0,.24)] transition duration-200 hover:-translate-y-[1px] hover:border-white/20`}
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${action.accent} opacity-70`} />
                <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-cyan-200">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="relative z-10 flex flex-1 items-center justify-between gap-3">
                  <span className="text-[21px] font-medium tracking-tight text-white">{action.label}</span>
                  <ChevronRight className="h-5 w-5 text-slate-500 transition group-hover:text-white" />
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-6 rounded-[1.8rem] border border-cyan-400/16 bg-[linear-gradient(180deg,rgba(6,33,44,.74),rgba(2,8,20,.92))] px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,.28)]">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.34em] text-cyan-200/80">
            <Sparkles className="h-3.5 w-3.5" /> George status
          </div>
          <p className="mt-3 text-[19px] leading-9 text-white">{latestAssistantMessage}</p>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-4 text-sm leading-6 text-rose-200">{error}</div> : null}
        {connectionState === "connected" ? (
          <div className="mt-5 flex justify-center">
            <button type="button" onClick={stopConversation} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-95">
              <PhoneOff className="h-4 w-4" /> End conversation
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
