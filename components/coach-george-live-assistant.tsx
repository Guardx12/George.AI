"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { BarChart3, Dumbbell, Flame, PhoneOff, Salad, UtensilsCrossed } from "lucide-react"

type LiveMessage = { id: string; role: "assistant" | "user" | "system"; content: string }
type ConnectionState = "idle" | "connecting" | "connected" | "error"
type ActivityLevel = "sedentary" | "lightly active" | "moderately active" | "very active"
type Goal = "lose fat" | "maintain" | "gain muscle"
type Sex = "male" | "female"
type Country = "UK" | "US"
type QuickActionKey = "log_meal" | "off_track" | "what_eat" | "workout"
type OnboardingStep = "goal" | "sex" | "age" | "height" | "weight" | "activity" | "country" | "done"

type CoachProfile = {
  country?: Country
  sex?: Sex
  age?: number
  heightCm?: number
  weightKg?: number
  activityLevel?: ActivityLevel
  goal?: Goal
  timeZone?: string
}

type CoachStats = {
  caloriesTarget: number
  proteinTarget: number
  carbsTarget: number
  fatTarget: number
  caloriesUsed: number
  proteinUsed: number
  carbsUsed: number
  fatUsed: number
  mealsToday: number
  streak: number
  lastActiveDate: string | null
}

const STORAGE_KEY = "coach-george-v7-messages"
const PROFILE_KEY = "coach-george-v7-profile"
const STATS_KEY = "coach-george-v7-stats"

const EMPTY_PROFILE: CoachProfile = {}
const DEFAULT_STATS: CoachStats = {
  caloriesTarget: 0,
  proteinTarget: 0,
  carbsTarget: 0,
  fatTarget: 0,
  caloriesUsed: 0,
  proteinUsed: 0,
  carbsUsed: 0,
  fatUsed: 0,
  mealsToday: 0,
  streak: 0,
  lastActiveDate: null,
}

const QUICK_ACTIONS: Array<{ key: QuickActionKey; label: string; subtitle: string; accent: string; icon: any }> = [
  { key: "log_meal", label: "Log meal", subtitle: "Track what you just had", accent: "from-sky-500/30 to-cyan-400/10", icon: UtensilsCrossed },
  { key: "off_track", label: "Went off track", subtitle: "Reset the day fast", accent: "from-amber-500/35 to-orange-400/10", icon: Flame },
  { key: "what_eat", label: "What should I eat?", subtitle: "Get the next meal sorted", accent: "from-emerald-500/30 to-cyan-400/10", icon: Salad },
  { key: "workout", label: "Give me a workout", subtitle: "Home or gym, right now", accent: "from-blue-500/35 to-indigo-400/10", icon: Dumbbell },
]

const FOOD_LIBRARY: Array<{ keywords: string[]; calories: number; protein: number; carbs: number; fat: number; meal?: boolean }> = [
  { keywords: ["chicken and rice", "chicken rice"], calories: 520, protein: 45, carbs: 52, fat: 10, meal: true },
  { keywords: ["steak and potatoes", "steak potatoes"], calories: 680, protein: 50, carbs: 48, fat: 28, meal: true },
  { keywords: ["salmon and rice", "salmon rice"], calories: 610, protein: 44, carbs: 48, fat: 25, meal: true },
  { keywords: ["chicken wrap"], calories: 460, protein: 34, carbs: 38, fat: 16, meal: true },
  { keywords: ["omelette", "eggs on toast"], calories: 360, protein: 24, carbs: 24, fat: 18, meal: true },
  { keywords: ["oats", "porridge", "oatmeal"], calories: 320, protein: 18, carbs: 42, fat: 7, meal: true },
  { keywords: ["protein shake", "shake"], calories: 120, protein: 24, carbs: 3, fat: 2 },
  { keywords: ["greek yogurt", "greek yoghurt", "yogurt", "yoghurt"], calories: 120, protein: 20, carbs: 8, fat: 0 },
  { keywords: ["burger"], calories: 520, protein: 28, carbs: 35, fat: 30, meal: true },
  { keywords: ["pizza"], calories: 700, protein: 28, carbs: 70, fat: 32, meal: true },
  { keywords: ["chicken breast", "chicken"], calories: 330, protein: 60, carbs: 0, fat: 7, meal: true },
  { keywords: ["steak"], calories: 400, protein: 50, carbs: 0, fat: 22, meal: true },
  { keywords: ["rice"], calories: 180, protein: 4, carbs: 40, fat: 1 },
  { keywords: ["potatoes", "jacket potato", "baked potato"], calories: 230, protein: 6, carbs: 50, fat: 0 },
]

function makeMessage(role: LiveMessage["role"], content: string): LiveMessage {
  return { id: `${role}-${Date.now()}-${Math.random()}`, role, content }
}

function localDayIso(timeZone?: string | null) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function yesterdayIso(timeZone?: string | null) {
  const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
  const now = new Date(localDayIso(tz))
  now.setDate(now.getDate() - 1)
  return now.toISOString().slice(0, 10)
}

function resetDailyTotals(stats: CoachStats): CoachStats {
  return { ...stats, caloriesUsed: 0, proteinUsed: 0, carbsUsed: 0, fatUsed: 0, mealsToday: 0 }
}

function rollDailyStats(stats: CoachStats, timeZone?: string | null): CoachStats {
  const today = localDayIso(timeZone)
  if (!stats.lastActiveDate || stats.lastActiveDate === today) return stats
  return resetDailyTotals(stats)
}

function markUsage(stats: CoachStats, timeZone?: string | null): CoachStats {
  const today = localDayIso(timeZone)
  const rolled = rollDailyStats(stats, timeZone)
  if (rolled.lastActiveDate === today) return rolled
  if (rolled.lastActiveDate === yesterdayIso(timeZone)) return { ...rolled, streak: Math.max(1, rolled.streak + 1), lastActiveDate: today }
  return { ...rolled, streak: 1, lastActiveDate: today }
}

function calculateTargets(profile: CoachProfile) {
  const weight = profile.weightKg || 0
  const height = profile.heightCm || 0
  const age = profile.age || 0
  const sex = profile.sex || "male"
  const goal = profile.goal || "lose fat"
  const activityLevel = profile.activityLevel || "moderately active"
  const baseBmr = 10 * weight + 6.25 * height - 5 * age + (sex === "male" ? 5 : -161)
  const multiplierMap: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    "lightly active": 1.375,
    "moderately active": 1.55,
    "very active": 1.725,
  }
  const maintenance = baseBmr * multiplierMap[activityLevel]
  const rawCalories = goal === "lose fat" ? maintenance - 400 : goal === "gain muscle" ? maintenance + 200 : maintenance
  const caloriesTarget = Math.round(rawCalories / 50) * 50
  const proteinTarget = Math.round((weight * (goal === "maintain" ? 1.8 : 2.0)) / 5) * 5
  const fatTarget = Math.round((((caloriesTarget * 0.25) / 9) / 5)) * 5
  const carbsTarget = Math.max(0, Math.round((((caloriesTarget - proteinTarget * 4 - fatTarget * 9) / 4) / 5)) * 5)
  return { caloriesTarget, proteinTarget, carbsTarget, fatTarget }
}

const caloriesLeft = (stats: CoachStats) => Math.max(0, stats.caloriesTarget - stats.caloriesUsed)
const proteinLeft = (stats: CoachStats) => Math.max(0, stats.proteinTarget - stats.proteinUsed)
const carbsLeft = (stats: CoachStats) => Math.max(0, stats.carbsTarget - stats.carbsUsed)
const fatLeft = (stats: CoachStats) => Math.max(0, stats.fatTarget - stats.fatUsed)

function progressPct(used: number, target: number) {
  if (!target) return 0
  return Math.max(0, Math.min(100, Math.round((used / target) * 100)))
}

function macroPercentages(stats: CoachStats) {
  const total = stats.proteinUsed + stats.carbsUsed + stats.fatUsed
  if (!total) return { protein: 0, carbs: 0, fats: 0 }
  return {
    protein: Math.round((stats.proteinUsed / total) * 100),
    carbs: Math.round((stats.carbsUsed / total) * 100),
    fats: Math.round((stats.fatUsed / total) * 100),
  }
}

function pieSegments(stats: CoachStats) {
  const total = stats.proteinUsed + stats.carbsUsed + stats.fatUsed
  if (!total) return [] as Array<{ color: string; dash: number; offset: number }>
  const values = [stats.proteinUsed, stats.carbsUsed, stats.fatUsed]
  const colors = ["#3ad7ff", "#4f7cff", "#ffb24a"]
  const circumference = 2 * Math.PI * 42
  let cumulative = 0
  return values.map((value, index) => {
    const dash = (value / total) * circumference
    const offset = -cumulative
    cumulative += dash
    return { color: colors[index], dash, offset }
  })
}

function parseSex(input: string): Sex | null {
  const t = input.toLowerCase()
  if (/(^|\b)(male|man|guy|bloke)(\b|$)/.test(t)) return "male"
  if (/(^|\b)(female|woman|girl|lady)(\b|$)/.test(t)) return "female"
  return null
}
function parseGoal(input: string): Goal | null {
  const t = input.toLowerCase()
  if (t.includes("lose") || t.includes("fat loss") || t.includes("cut") || t.includes("lean")) return "lose fat"
  if (t.includes("gain") || t.includes("bulk") || t.includes("muscle")) return "gain muscle"
  if (t.includes("maintain")) return "maintain"
  return null
}
function parseAge(input: string) { const m = input.match(/\b(1[6-9]|[2-8][0-9]|9[0-9])\b/); return m ? Number(m[1]) : null }
function parseHeightCm(input: string) {
  const t = input.toLowerCase()
  const cm = t.match(/(\d{3})\s*cm/)
  if (cm) return Number(cm[1])
  const ftIn = t.match(/(\d)\s*(?:ft|foot|feet|')\s*(\d{1,2})?/) 
  if (ftIn) return Math.round(Number(ftIn[1]) * 30.48 + Number(ftIn[2] || 0) * 2.54)
  const plain = t.match(/\b(1[4-9]\d|2[0-2]\d)\b/)
  return plain ? Number(plain[1]) : null
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
  if (t.includes("light") || t.includes("lightly active")) return "lightly active"
  if (t.includes("moderate") || t.includes("moderately active") || t.includes("3 times") || t.includes("4 times")) return "moderately active"
  if (t.includes("very active") || t.includes("active") || t.includes("5 times") || t.includes("6 times")) return "very active"
  return null
}
function parseCountry(input: string): Country | null {
  const t = input.toLowerCase()
  if (t.includes("uk") || t.includes("england") || t.includes("britain") || t.includes("united kingdom")) return "UK"
  if (t.includes("usa") || t.includes("us") || t.includes("america") || t.includes("united states")) return "US"
  return null
}

function isProfileComplete(profile: CoachProfile | null, stats: CoachStats) {
  return Boolean(
    profile?.goal && profile?.sex && profile?.age && profile?.heightCm && profile?.weightKg && profile?.activityLevel && profile?.country && stats.caloriesTarget > 0 && stats.proteinTarget > 0 && stats.carbsTarget > 0 && stats.fatTarget > 0,
  )
}

function getOnboardingStep(profile: CoachProfile | null, stats: CoachStats): OnboardingStep {
  if (!profile?.goal) return "goal"
  if (!profile?.sex) return "sex"
  if (!profile?.age) return "age"
  if (!profile?.heightCm) return "height"
  if (!profile?.weightKg) return "weight"
  if (!profile?.activityLevel) return "activity"
  if (!profile?.country) return "country"
  if (!(stats.caloriesTarget > 0 && stats.proteinTarget > 0 && stats.carbsTarget > 0 && stats.fatTarget > 0)) return "country"
  return "done"
}

function applyOnboardingAnswer(step: OnboardingStep, input: string, prevProfile: CoachProfile) {
  const next = { ...prevProfile }
  if (step === "goal") next.goal = parseGoal(input) || next.goal
  if (step === "sex") next.sex = parseSex(input) || next.sex
  if (step === "age") next.age = parseAge(input) || next.age
  if (step === "height") next.heightCm = parseHeightCm(input) || next.heightCm
  if (step === "weight") next.weightKg = parseWeightKg(input) || next.weightKg
  if (step === "activity") next.activityLevel = parseActivity(input) || next.activityLevel
  if (step === "country") next.country = parseCountry(input) || next.country
  return next
}

function nextOnboardingInstruction(step: OnboardingStep) {
  switch (step) {
    case "goal": return "Start setup. Ask only this: what’s your main goal right now — lose fat, maintain, or gain muscle?"
    case "sex": return "Good. Now ask only this: are you male or female?"
    case "age": return "Now ask only this: how old are you?"
    case "height": return "Now ask only this: what’s your height? Accept cm or feet and inches."
    case "weight": return "Now ask only this: what’s your current weight? Accept kg, lb, or stone."
    case "activity": return "Now ask only this: how active are you day to day — sedentary, lightly active, moderately active, or very active?"
    case "country": return "Now ask only this: are you in the UK or the US?"
    case "done": return "Setup is complete. Briefly confirm their calories, protein, carbs, and fats, then ask what they want help with right now."
  }
}

function profileContext(profile: CoachProfile | null, stats: CoachStats) {
  if (!isProfileComplete(profile, stats)) {
    return "This user is not set up yet. You must onboard them first. Ask one question at a time and collect: goal, sex, age, height, weight, activity level, then country. Once complete, explain their calories, protein, carbs, and fats simply. Do not skip setup."
  }
  return `Saved profile:\n- country: ${profile!.country}\n- sex: ${profile!.sex}\n- age: ${profile!.age}\n- height: ${profile!.heightCm} cm\n- weight: ${profile!.weightKg} kg\n- activity: ${profile!.activityLevel}\n- goal: ${profile!.goal}\n- calorie target: ${stats.caloriesTarget}\n- protein target: ${stats.proteinTarget}\n- carbs target: ${stats.carbsTarget}\n- fat target: ${stats.fatTarget}\n- calories left right now: ${caloriesLeft(stats)}\n- protein left right now: ${proteinLeft(stats)}\n- carbs left right now: ${carbsLeft(stats)}\n- fat left right now: ${fatLeft(stats)}\n- meals logged today: ${stats.mealsToday}\n- streak: ${stats.streak}\nUse this automatically. Do not ask for stats again unless the user says they’ve changed.`
}

function buildFirstResponseEvent(profile: CoachProfile | null, stats: CoachStats) {
  const complete = isProfileComplete(profile, stats)
  const instructions = complete
    ? `${profileContext(profile, stats)}\n\nGreet them like a returning user in one short line. Then ask what they want help with right now.`
    : `${profileContext(profile, stats)}\n\n${nextOnboardingInstruction(getOnboardingStep(profile ?? EMPTY_PROFILE, stats))}`
  return { type: "response.create", response: { instructions } }
}

function buildQuickPrompt(actionKey: QuickActionKey, profile: CoachProfile | null, stats: CoachStats) {
  const context = profileContext(profile, stats)
  switch (actionKey) {
    case "log_meal":
      return `${context}\nThe user tapped Log meal. Ask what they had before estimating anything. Ask one short follow-up if portion is unclear. Then estimate calories, protein, carbs, and fats consistently, update what is left, and tell them the next best move.`
    case "off_track":
      return `${context}\nThe user tapped Went off track. Reset them calmly but firmly. Ask what actually happened. Do not shame them. Then tell them the next best move for today.`
    case "what_eat":
      return `${context}\nThe user tapped What should I eat. Consider how many meals are left today before recommending anything. Give specific portion sizes, rough calories, and rough macros for the next meal. If they likely have 2 meals left, split remaining calories and protein sensibly.`
    case "workout":
      return `${context}\nThe user tapped Give me a workout. Ask only what you need, then give a simple structured workout they can do now. Briefly explain form and say to stop if anything feels painful.`
  }
}

function estimateFromText(input: string) {
  const t = input.toLowerCase()
  const found = FOOD_LIBRARY.find((item) => item.keywords.some((k) => t.includes(k)))
  if (!found) return null
  let multiplier = 1
  if (t.includes("large") || t.includes("big")) multiplier = 1.25
  if (t.includes("small") || t.includes("light")) multiplier = 0.8
  if (/\bdouble\b/.test(t)) multiplier = 1.8
  return {
    calories: Math.round(found.calories * multiplier),
    protein: Math.round(found.protein * multiplier),
    carbs: Math.round(found.carbs * multiplier),
    fat: Math.round(found.fat * multiplier),
    countedAsMeal: !!found.meal,
  }
}

function buildCoachGuidance(profile: CoachProfile | null, stats: CoachStats) {
  if (!isProfileComplete(profile, stats)) return "First time here? Tap George and he’ll get you set up properly."
  const mealsLeftHint = stats.mealsToday <= 1 ? "Keep the next meal controlled." : "Keep the rest of the day tight."
  return `${caloriesLeft(stats)} kcal left • ${proteinLeft(stats)}g protein left • ${carbsLeft(stats)}g carbs left • ${fatLeft(stats)}g fat left. ${mealsLeftHint}`
}

export function CoachGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [statusText, setStatusText] = useState("Ready when you are")
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
  const onboardingProfileRef = useRef<CoachProfile>(EMPTY_PROFILE)

  const profileReady = isProfileComplete(profile, stats)
  const latestAssistantMessage = useMemo(() => [...messages].reverse().find((m) => m.role === "assistant")?.content || buildCoachGuidance(profile, stats), [messages, profile, stats])
  const pie = pieSegments(stats)
  const macroPercents = macroPercentages(stats)
  const macroBars = [
    { label: "Protein", used: stats.proteinUsed, target: stats.proteinTarget, color: "from-cyan-300 to-sky-500" },
    { label: "Carbs", used: stats.carbsUsed, target: stats.carbsTarget, color: "from-blue-400 to-indigo-500" },
    { label: "Fats", used: stats.fatUsed, target: stats.fatTarget, color: "from-amber-300 to-orange-500" },
  ]

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    try {
      const rawMessages = window.localStorage.getItem(STORAGE_KEY)
      if (rawMessages) {
        const parsed = JSON.parse(rawMessages)
        if (Array.isArray(parsed?.messages)) setMessages(parsed.messages)
      }
    } catch {}

    let loadedStats = { ...DEFAULT_STATS }
    try {
      const rawStats = window.localStorage.getItem(STATS_KEY)
      if (rawStats) {
        const parsed = JSON.parse(rawStats)
        if (parsed && typeof parsed === "object") loadedStats = { ...DEFAULT_STATS, ...parsed }
      }
    } catch {}

    let loadedProfile: CoachProfile = { timeZone }
    try {
      const rawProfile = window.localStorage.getItem(PROFILE_KEY)
      if (rawProfile) {
        const parsed = JSON.parse(rawProfile)
        if (parsed && typeof parsed === "object") loadedProfile = { ...loadedProfile, ...parsed, timeZone }
      }
    } catch {}

    onboardingProfileRef.current = { ...EMPTY_PROFILE, ...loadedProfile }
    setProfile(loadedProfile)
    setStats(rollDailyStats(loadedStats, timeZone))
  }, [])

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: messages.slice(-24) })) } catch {}
  }, [messages])
  useEffect(() => {
    try { window.localStorage.setItem(STATS_KEY, JSON.stringify(stats)) } catch {}
  }, [stats])
  useEffect(() => {
    try { if (profile) window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)) } catch {}
  }, [profile])

  async function cleanupConversation() {
    dcRef.current?.close(); dcRef.current = null
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => sender.track?.stop())
      pcRef.current.close(); pcRef.current = null
    }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach((t) => t.stop()); localStreamRef.current = null }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.srcObject = null; audioRef.current.remove(); audioRef.current = null }
    currentAssistantTextRef.current = ""
    currentAssistantMessageIdRef.current = null
  }

  function appendOrUpdateAssistantPartial(delta: string, isFinal = false) {
    if (!delta) return
    if (!currentAssistantMessageIdRef.current) {
      const message = makeMessage("assistant", delta)
      currentAssistantMessageIdRef.current = message.id
      currentAssistantTextRef.current = delta
      setMessages((prev) => [...prev, message])
      if (isFinal) { currentAssistantMessageIdRef.current = null; currentAssistantTextRef.current = "" }
      return
    }
    currentAssistantTextRef.current += delta
    const targetId = currentAssistantMessageIdRef.current
    setMessages((prev) => prev.map((m) => m.id === targetId ? { ...m, content: currentAssistantTextRef.current } : m))
    if (isFinal) { currentAssistantMessageIdRef.current = null; currentAssistantTextRef.current = "" }
  }

  function addUserTranscript(text: string) {
    const cleaned = text.trim()
    if (!cleaned) return
    setMessages((prev) => [...prev, makeMessage("user", cleaned)])

    if (!profileReady) {
      const currentProfile = onboardingProfileRef.current || EMPTY_PROFILE
      const step = getOnboardingStep(currentProfile, stats)
      if (step !== "done") {
        const nextProfile = applyOnboardingAnswer(step, cleaned, currentProfile)
        onboardingProfileRef.current = nextProfile
        const complete = Boolean(nextProfile.goal && nextProfile.sex && nextProfile.age && nextProfile.heightCm && nextProfile.weightKg && nextProfile.activityLevel && nextProfile.country)
        if (complete) {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
          const completedProfile = { ...nextProfile, timeZone: tz }
          const targets = calculateTargets(completedProfile)
          const nextStats = { ...DEFAULT_STATS, ...targets, streak: stats.streak, lastActiveDate: localDayIso(tz) }
          setProfile(completedProfile)
          setStats(nextStats)
          const dc = dcRef.current
          if (dc?.readyState === "open") {
            dc.send(JSON.stringify({ type: "response.create", response: { instructions: `${profileContext(completedProfile, nextStats)}\nSetup is complete. Briefly confirm their calories, protein, carbs, and fats, then ask what they want help with right now.` } }))
          }
          return
        }
        const nextStep = getOnboardingStep(nextProfile, stats)
        const dc = dcRef.current
        if (dc?.readyState === "open") dc.send(JSON.stringify({ type: "response.create", response: { instructions: nextOnboardingInstruction(nextStep) } }))
        return
      }
    }

    const estimate = estimateFromText(cleaned)
    if (estimate) {
      setStats((prev) => ({
        ...markUsage(prev, profile?.timeZone),
        caloriesUsed: prev.caloriesUsed + estimate.calories,
        proteinUsed: prev.proteinUsed + estimate.protein,
        carbsUsed: prev.carbsUsed + estimate.carbs,
        fatUsed: prev.fatUsed + estimate.fat,
        mealsToday: prev.mealsToday + (estimate.countedAsMeal ? 1 : 0),
      }))
    } else {
      setStats((prev) => markUsage(prev, profile?.timeZone))
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
      case "response.output_audio.delta":
        setStatusText("George is replying…")
        break
      case "response.output_audio.done":
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
      const ephemeralKey = tokenData?.value || tokenData?.client_secret?.value
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
          sampleRate: 48000,
        } as MediaTrackConstraints,
      })
      localStreamRef.current = stream
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      const dc = pc.createDataChannel("oai-events")
      dcRef.current = dc
      dc.addEventListener("open", () => {
        setConnectionState("connected")
        setStatusText("Listening…")
        setStats((prev) => markUsage(prev, profile?.timeZone))
        window.setTimeout(() => {
          dc.send(JSON.stringify(buildFirstResponseEvent(profile, stats)))
          if (queuedPromptRef.current) {
            const prompt = queuedPromptRef.current
            queuedPromptRef.current = null
            window.setTimeout(() => sendTextPrompt(prompt), 300)
          }
        }, 150)
      })
      dc.addEventListener("message", (event) => { try { handleRealtimeEvent(JSON.parse(event.data)) } catch {} })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const response = await fetch("https://api.openai.com/v1/realtime?model=gpt-realtime", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
          "OpenAI-Beta": "realtime=v1",
        },
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
    const prompt = buildQuickPrompt(actionKey, profile, stats)
    if (connectionState === "connected") {
      sendTextPrompt(prompt)
      return
    }
    queuedPromptRef.current = prompt
    void startConversation()
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050608] text-white">
      <style jsx>{`
        @keyframes haloPulse { 0%,100% { transform: scale(1); opacity: .84; } 50% { transform: scale(1.035); opacity: 1; } }
        @keyframes revolve { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes shimmerFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-2px); } }
      `}</style>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(67,171,255,0.20),transparent_22%),radial-gradient(circle_at_50%_28%,rgba(255,169,79,0.10),transparent_30%),linear-gradient(180deg,#030406_0%,#070b12_45%,#040507_100%)]" />
        <div className="absolute left-1/2 top-24 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-sky-500/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-7">
        <header className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-[34px] font-semibold tracking-[0.24em] text-white">GEORGE</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.46em] text-white/40">Coach • Track • Perform</div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-white/70">{connectionState === "connected" ? "Live" : statusText}</div>
        </header>

        <div className="flex justify-center pt-1">
          <button type="button" onClick={connectionState === "connected" ? stopConversation : startConversation} disabled={connectionState === "connecting"} className="group relative flex h-[320px] w-[320px] items-center justify-center rounded-full disabled:cursor-not-allowed">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_48%,rgba(53,162,255,0.20),transparent_44%),radial-gradient(circle_at_50%_50%,rgba(255,157,68,0.12),transparent_70%)] blur-xl" />
            <div className="absolute inset-0 rounded-full border border-sky-300/14 shadow-[0_0_40px_rgba(0,0,0,.4)]" style={{ animation: "haloPulse 3.6s ease-in-out infinite" }} />
            <div className="absolute inset-[10px] rounded-full border border-white/8" />
            <div className="absolute inset-[18px] rounded-full bg-[conic-gradient(from_90deg_at_50%_50%,rgba(59,130,246,.02),rgba(59,130,246,.40),rgba(251,146,60,.30),rgba(59,130,246,.07),rgba(59,130,246,.02))] opacity-95" style={{ animation: "revolve 12s linear infinite" }} />
            <div className="absolute inset-[28px] rounded-full border border-sky-300/12" style={{ animation: "haloPulse 2.8s ease-in-out infinite" }} />
            <div className="absolute inset-[54px] rounded-full bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,.24),rgba(14,21,34,.18)_18%,rgba(4,9,18,.97)_62%)] shadow-[inset_0_0_42px_rgba(71,181,255,.18),0_0_34px_rgba(0,0,0,.35)]" />
            <div className="absolute inset-[84px] rounded-full border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,.18),rgba(4,11,24,.96)_68%)] backdrop-blur" />
            <div className="absolute left-1/2 top-[82px] flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full border border-white/16 bg-white/8 shadow-[0_14px_40px_rgba(0,0,0,.38)]" style={{ animation: "shimmerFloat 3.5s ease-in-out infinite" }}>
              <BarChart3 className="h-7 w-7 text-white/95" />
            </div>
            <div className="relative z-10 mt-16 text-center">
              <div className="text-[50px] font-semibold tracking-tight text-white">George</div>
              <div className="mt-2 text-[22px] text-white/82">{connectionState === "connecting" ? "Connecting…" : connectionState === "connected" ? "Live now" : "Tap to talk"}</div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] uppercase tracking-[0.32em] text-white/58">tracking • coaching • accountability</div>
            </div>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            { label: "Calories left", value: profileReady ? caloriesLeft(stats) : "--" },
            { label: "Protein left", value: profileReady ? `${proteinLeft(stats)}g` : "--" },
            { label: "Meals today", value: profileReady ? stats.mealsToday : "--" },
            { label: "Day streak", value: profileReady ? stats.streak : "--" },
          ].map((item) => (
            <div key={item.label} className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,22,.96),rgba(5,7,11,.96))] px-4 py-4 shadow-[0_14px_36px_rgba(0,0,0,.30)] backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.30em] text-white/38">{item.label}</div>
              <div className="mt-3 text-[40px] font-semibold leading-none text-white">{item.value}</div>
            </div>
          ))}
        </div>

        <section className="mt-5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,24,.95),rgba(4,7,12,.98))] p-4 shadow-[0_16px_44px_rgba(0,0,0,.32)]">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.34em] text-white/40">Macro tracking</div>
            <div className="text-[10px] uppercase tracking-[0.34em] text-white/35">consumed vs target</div>
          </div>
          <div className="mt-4 space-y-4">
            {macroBars.map((bar) => (
              <div key={bar.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-white">{bar.label}</span>
                  <span className="text-white/50">{bar.used} / {bar.target || "--"}g</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/6">
                  <div className={`h-full rounded-full bg-gradient-to-r ${bar.color} transition-all duration-500`} style={{ width: `${progressPct(bar.used, bar.target)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-4">
            <div className="relative h-28 w-28 shrink-0">
              <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
                {pie.map((seg, idx) => (
                  <circle key={idx} cx="50" cy="50" r="42" fill="none" stroke={seg.color} strokeWidth="12" strokeDasharray={`${seg.dash} 999`} strokeDashoffset={seg.offset} strokeLinecap="round" />
                ))}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-center">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.26em] text-white/35">Today</div>
                  <div className="text-lg font-semibold text-white">Macros</div>
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3 text-white"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Protein</span><span className="text-white/58">{macroPercents.protein}%</span></div>
              <div className="flex items-center justify-between gap-3 text-white"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Carbs</span><span className="text-white/58">{macroPercents.carbs}%</span></div>
              <div className="flex items-center justify-between gap-3 text-white"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" /> Fats</span><span className="text-white/58">{macroPercents.fats}%</span></div>
              <p className="pt-1 text-xs leading-5 text-white/42">Bars fill as meals are logged. The ring shows your current macro split for today.</p>
            </div>
          </div>
        </section>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <button key={action.key} type="button" onClick={() => handleQuickAction(action.key)} className="group relative overflow-hidden rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,15,23,.96),rgba(4,7,12,.96))] px-4 py-4 text-left shadow-[0_16px_38px_rgba(0,0,0,.28)] transition duration-200 hover:-translate-y-[1px] hover:border-white/20">
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${action.accent} opacity-80`} />
                <div className="relative z-10">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white"><Icon className="h-5 w-5" /></span>
                    <div>
                      <div className="text-[17px] font-medium leading-5 tracking-tight text-white">{action.label}</div>
                      <div className="mt-1 text-xs text-white/55">{action.subtitle}</div>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-5 rounded-[1.4rem] border border-white/8 bg-white/[0.03] px-4 py-4 text-[15px] leading-7 text-white/75 shadow-[0_12px_30px_rgba(0,0,0,.22)]">{latestAssistantMessage}</div>

        {error ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-4 text-sm leading-6 text-rose-200">{error}</div> : null}
        {connectionState === "connected" ? (
          <div className="mt-5 flex justify-center">
            <button type="button" onClick={stopConversation} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-95"><PhoneOff className="h-4 w-4" /> End conversation</button>
          </div>
        ) : null}

        <div className="mt-4 text-center text-[11px] uppercase tracking-[0.28em] text-white/28">General fitness guidance only • stop if anything feels painful</div>
      </div>
    </div>
  )
}
