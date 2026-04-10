"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { BarChart3, Dumbbell, Flame, PhoneOff, Salad, UtensilsCrossed } from "lucide-react"

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

type CoachProfile = {
  country?: Country
  sex?: Sex
  age?: number
  heightCm?: number
  weightKg?: number
  activityLevel?: ActivityLevel
  goal?: Goal
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
  currentDayDate: string | null
  timezone?: string | null
}

type MacroEstimate = {
  calories: number
  protein: number
  carbs: number
  fat: number
  countedAsMeal: boolean
}

const STORAGE_KEY = "coach-george-v4-messages"
const PROFILE_KEY = "coach-george-profile-v3"
const STATS_KEY = "coach-george-stats-v8"

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
  currentDayDate: null,
  timezone: null,
}

const QUICK_ACTIONS: Array<{ key: QuickActionKey; label: string; accent: string; icon: any }> = [
  { key: "log_meal", label: "Log meal", accent: "from-sky-400/30 to-sky-600/5", icon: UtensilsCrossed },
  { key: "off_track", label: "Went off track", accent: "from-amber-300/30 to-orange-500/5", icon: Flame },
  { key: "what_eat", label: "What should I eat?", accent: "from-emerald-300/30 to-emerald-500/5", icon: Salad },
  { key: "workout", label: "Give me a workout", accent: "from-cyan-300/30 to-blue-500/5", icon: Dumbbell },
]

const FOOD_LIBRARY: Array<{ keywords: string[]; calories: number; protein: number; carbs: number; fat: number; meal?: boolean }> = [
  { keywords: ["protein powder", "protein shake", "whey", "shake"], calories: 120, protein: 24, carbs: 3, fat: 2 },
  { keywords: ["oats", "porridge", "oatmeal"], calories: 190, protein: 6, carbs: 32, fat: 4 },
  { keywords: ["salmon sandwich", "salmon bagel", "salmon wrap"], calories: 430, protein: 30, carbs: 36, fat: 17, meal: true },
  { keywords: ["sandwich", "meal deal sandwich", "deli sandwich"], calories: 380, protein: 20, carbs: 40, fat: 13, meal: true },
  { keywords: ["chicken and rice", "chicken rice"], calories: 520, protein: 45, carbs: 52, fat: 10, meal: true },
  { keywords: ["steak and potatoes", "steak potatoes", "steak meal"], calories: 680, protein: 50, carbs: 48, fat: 28, meal: true },
  { keywords: ["greek yogurt", "greek yoghurt", "yoghurt"], calories: 120, protein: 20, carbs: 8, fat: 0 },
  { keywords: ["eggs on toast", "omelette"], calories: 360, protein: 24, carbs: 24, fat: 18, meal: true },
  { keywords: ["salmon and rice", "salmon rice"], calories: 610, protein: 44, carbs: 48, fat: 25, meal: true },
  { keywords: ["chicken wrap", "wrap"], calories: 460, protein: 34, carbs: 38, fat: 16, meal: true },
  { keywords: ["burger"], calories: 520, protein: 28, carbs: 35, fat: 30, meal: true },
  { keywords: ["pizza"], calories: 700, protein: 28, carbs: 70, fat: 32, meal: true },
  { keywords: ["takeaway", "take away", "chip shop", "mcdonald", "kfc", "greggs"], calories: 850, protein: 30, carbs: 90, fat: 36, meal: true },
  { keywords: ["rice"], calories: 180, protein: 4, carbs: 40, fat: 1 },
  { keywords: ["potatoes", "jacket potato", "baked potato"], calories: 230, protein: 6, carbs: 50, fat: 0 },
  { keywords: ["chicken breast", "chicken"], calories: 330, protein: 60, carbs: 0, fat: 7, meal: true },
  { keywords: ["salmon"], calories: 420, protein: 45, carbs: 0, fat: 25, meal: true },
  { keywords: ["steak"], calories: 400, protein: 50, carbs: 0, fat: 22, meal: true },
  { keywords: ["bread", "toast"], calories: 180, protein: 6, carbs: 34, fat: 2 },
  { keywords: ["bagel"], calories: 250, protein: 9, carbs: 49, fat: 1 },
]

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

function makeMessage(role: LiveMessage["role"], content: string): LiveMessage {
  return { id: uid(), role, content }
}

function localDateIso(date = new Date(), timeZone?: string | null) {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    return formatter.format(date)
  } catch {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
}

function yesterdayIso(timeZone?: string | null) {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return localDateIso(d, timeZone)
}

function inferCountryFromBrowser(): Country | null {
  if (typeof window === "undefined") return null
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""
  const lang = navigator.language?.toLowerCase() || ""
  if (tz.includes("London") || lang.includes("en-gb")) return "UK"
  if (tz.startsWith("America/") || lang.includes("en-us")) return "US"
  return null
}

function getBrowserTimeZone() {
  if (typeof window === "undefined") return null
  return Intl.DateTimeFormat().resolvedOptions().timeZone || null
}

function normalizeStatsForToday(stats: CoachStats): CoachStats {
  const zone = stats.timezone || getBrowserTimeZone()
  const today = localDateIso(new Date(), zone)
  if (stats.currentDayDate === today) return { ...stats, timezone: zone }
  return {
    ...stats,
    caloriesUsed: 0,
    proteinUsed: 0,
    carbsUsed: 0,
    fatUsed: 0,
    mealsToday: 0,
    currentDayDate: today,
    timezone: zone,
  }
}

function markUsage(stats: CoachStats): CoachStats {
  const normalized = normalizeStatsForToday(stats)
  const zone = normalized.timezone || getBrowserTimeZone()
  const today = localDateIso(new Date(), zone)
  if (normalized.lastActiveDate === today) return normalized
  if (normalized.lastActiveDate === yesterdayIso(zone)) return { ...normalized, streak: normalized.streak + 1, lastActiveDate: today }
  return { ...normalized, streak: 1, lastActiveDate: today }
}

function calculateTargets(profile: CoachProfile) {
  const weight = profile.weightKg || 0
  const height = profile.heightCm || 0
  const age = profile.age || 0
  const sex = profile.sex || "male"
  const goal = profile.goal || "lose fat"
  const activityLevel = profile.activityLevel || "moderately active"

  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === "male" ? 5 : -161)
  const multipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    "lightly active": 1.375,
    "moderately active": 1.55,
    "very active": 1.725,
  }

  const maintenance = bmr * multipliers[activityLevel]
  const rawCalories = goal === "lose fat" ? maintenance - 400 : goal === "gain muscle" ? maintenance + 200 : maintenance
  const caloriesTarget = Math.max(1200, Math.round(rawCalories / 50) * 50)
  const proteinTarget = Math.round(((weight * (goal === "maintain" ? 1.8 : 2)) / 5)) * 5
  const fatTarget = Math.max(40, Math.round(((caloriesTarget * 0.25) / 9) / 5) * 5)
  const carbsTarget = Math.max(0, Math.round(((caloriesTarget - proteinTarget * 4 - fatTarget * 9) / 4) / 5) * 5)

  return { caloriesTarget, proteinTarget, carbsTarget, fatTarget }
}

function caloriesLeft(stats: CoachStats) { return Math.max(0, stats.caloriesTarget - stats.caloriesUsed) }
function proteinLeft(stats: CoachStats) { return Math.max(0, stats.proteinTarget - stats.proteinUsed) }
function carbsLeft(stats: CoachStats) { return Math.max(0, stats.carbsTarget - stats.carbsUsed) }
function fatLeft(stats: CoachStats) { return Math.max(0, stats.fatTarget - stats.fatUsed) }

function isProfileComplete(profile: CoachProfile | null, stats: CoachStats) {
  return Boolean(
    profile?.goal && profile?.sex && profile?.age && profile?.heightCm && profile?.weightKg && profile?.activityLevel && profile?.country &&
      stats.caloriesTarget > 0 && stats.proteinTarget > 0 && stats.carbsTarget > 0 && stats.fatTarget > 0
  )
}

function parseSex(input: string): Sex | null {
  const t = input.toLowerCase()
  if (/\b(male|man|guy|bloke)\b/.test(t)) return "male"
  if (/\b(female|woman|girl|lady)\b/.test(t)) return "female"
  return null
}
function parseGoal(input: string): Goal | null {
  const t = input.toLowerCase()
  if (t.includes("lose") || t.includes("fat loss") || t.includes("cut") || t.includes("lean")) return "lose fat"
  if (t.includes("gain") || t.includes("muscle") || t.includes("bulk")) return "gain muscle"
  if (t.includes("maintain")) return "maintain"
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
  return null
}
function parseActivity(input: string): ActivityLevel | null {
  const t = input.toLowerCase()
  if (t.includes("sedentary") || t.includes("desk") || t.includes("not very active")) return "sedentary"
  if (t.includes("light") || t.includes("few walks") || t.includes("lightly active")) return "lightly active"
  if (t.includes("moderate") || t.includes("moderately active") || t.includes("3 times") || t.includes("4 times")) return "moderately active"
  if (t.includes("very active") || t.includes("train a lot") || t.includes("5 times") || t.includes("6 times") || t.includes("daily")) return "very active"
  if (t.includes("active")) return "moderately active"
  return null
}
function parseCountry(input: string): Country | null {
  const t = input.toLowerCase()
  if (t.includes("uk") || t.includes("united kingdom") || t.includes("england") || t.includes("britain")) return "UK"
  if (t.includes("us") || t.includes("usa") || t.includes("america") || t.includes("united states")) return "US"
  return null
}

function mergeProfileFromInput(input: string, prevProfile: CoachProfile): { profile: CoachProfile; complete: boolean } {
  const next = { ...prevProfile }
  const goal = parseGoal(input)
  const sex = parseSex(input)
  const age = parseAge(input)
  const heightCm = parseHeightCm(input)
  const weightKg = parseWeightKg(input)
  const activityLevel = parseActivity(input)
  const country = parseCountry(input)
  if (goal) next.goal = goal
  if (sex) next.sex = sex
  if (age) next.age = age
  if (heightCm) next.heightCm = heightCm
  if (weightKg) next.weightKg = weightKg
  if (activityLevel) next.activityLevel = activityLevel
  if (country) next.country = country
  if (!next.country) next.country = inferCountryFromBrowser() || undefined
  return { profile: next, complete: Boolean(next.goal && next.sex && next.age && next.heightCm && next.weightKg && next.activityLevel && next.country) }
}

function getOnboardingStep(profile: CoachProfile | null, stats: CoachStats) {
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

function nextOnboardingInstruction(step: string) {
  switch (step) {
    case "goal": return "Start setup. Ask only this: what’s your main goal right now — lose fat, maintain, or gain muscle?"
    case "sex": return "Good. Now ask only this: are you male or female?"
    case "age": return "Now ask only this: how old are you?"
    case "height": return "Now ask only this: what’s your height? Accept cm or feet and inches."
    case "weight": return "Now ask only this: what’s your current weight? Accept kg, lb, or stone."
    case "activity": return "Now ask only this: how active are you day to day — sedentary, lightly active, moderately active, or very active?"
    case "country": return "Now ask only this: are you in the UK or the US?"
    default: return "Setup is complete. Briefly confirm their calories and protein targets, then ask what they want help with right now."
  }
}

function profileContext(profile: CoachProfile | null, stats: CoachStats) {
  if (!isProfileComplete(profile, stats)) {
    return `This user is not set up yet. You must onboard them first. Ask one question at a time and collect: goal, sex, age, height, weight, activity level, then country. Once complete, explain that their calories, protein, carbs and fats are set and you’ll guide the rest. Do not skip setup.`
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
  if (actionKey === "log_meal") return `${context}\nThe user tapped Log meal. Ask what they had before estimating anything. Ask one short follow-up if portion is unclear. Then estimate calories, protein, carbs and fats consistently, update what is left, and tell them the next best move.`
  if (actionKey === "off_track") return `${context}\nThe user tapped Went off track. Reset them calmly but firmly. Ask what actually happened. Do not shame them. Then tell them the next best move for today.`
  if (actionKey === "what_eat") return `${context}\nThe user tapped What should I eat. Consider how many meals are likely left today before recommending anything. Give specific portion sizes, rough calories, rough protein, rough carbs and rough fats for the next meal. Do not be vague.`
  return `${context}\nThe user tapped Give me a workout. Ask only what you need, then give a simple structured workout they can do now.`
}

function estimateFromText(input: string): MacroEstimate | null {
  const t = input.toLowerCase()
  const matched = FOOD_LIBRARY.filter(item => item.keywords.some(k => t.includes(k)))
  if (!matched.length) return null
  const seen = new Set<string>()
  const unique = matched.filter(item => {
    const key = item.keywords[0]
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  let multiplier = 1
  const scoopMatch = t.match(/(\d+)\s*scoops?/) || t.match(/(\d+)x\s*(?:protein|shake|whey)/)
  if (scoopMatch && t.includes("protein")) multiplier = Math.max(multiplier, Number(scoopMatch[1]))
  if (t.includes("large") || t.includes("big")) multiplier *= 1.25
  if (t.includes("small") || t.includes("light")) multiplier *= 0.8
  if (t.includes("double")) multiplier *= 1.8
  const total = unique.reduce((acc, item) => ({
    calories: acc.calories + item.calories,
    protein: acc.protein + item.protein,
    carbs: acc.carbs + item.carbs,
    fat: acc.fat + item.fat,
    countedAsMeal: acc.countedAsMeal || !!item.meal,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, countedAsMeal: false })
  const hasMealWord = /breakfast|lunch|dinner|meal|sandwich|wrap|bagel/.test(t)
  const countedAsMeal = total.countedAsMeal || hasMealWord || unique.length > 1 || total.calories * multiplier >= 250
  return {
    calories: Math.round(total.calories * multiplier),
    protein: Math.round(total.protein * multiplier),
    carbs: Math.round(total.carbs * multiplier),
    fat: Math.round(total.fat * multiplier),
    countedAsMeal,
  }
}

function pieSegments(stats: CoachStats) {
  const total = stats.proteinUsed + stats.carbsUsed + stats.fatUsed
  if (!total) return [] as Array<{color:string; dash:number; offset:number}>
  const vals = [stats.proteinUsed, stats.carbsUsed, stats.fatUsed]
  const colors = ["#67e8f9", "#60a5fa", "#fb923c"]
  let cumulative = 0
  const circumference = 2 * Math.PI * 42
  return vals.map((v, i) => {
    const dash = (v / total) * circumference
    const offset = -cumulative
    cumulative += dash
    return { color: colors[i], dash, offset }
  })
}

function progressPct(used: number, target: number) {
  if (!target) return 0
  return Math.max(0, Math.min(100, Math.round((used / target) * 100)))
}

function macroPercentages(stats: CoachStats) {
  const total = stats.proteinUsed + stats.carbsUsed + stats.fatUsed
  if (!total) return { protein: 0, carbs: 0, fat: 0 }
  return {
    protein: Math.round((stats.proteinUsed / total) * 100),
    carbs: Math.round((stats.carbsUsed / total) * 100),
    fat: Math.round((stats.fatUsed / total) * 100),
  }
}

function buildCoachGuidance(profile: CoachProfile | null, stats: CoachStats) {
  if (!isProfileComplete(profile, stats)) return "First time here? Tap to talk and George will get you set up properly."
  if (stats.mealsToday === 0) return `You’re set for ${stats.caloriesTarget} kcal and ${stats.proteinTarget}g protein today.`
  return `${caloriesLeft(stats)} kcal left • ${proteinLeft(stats)}g protein left • ${carbsLeft(stats)}g carbs left • ${fatLeft(stats)}g fat left.`
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
  const statsRef = useRef<CoachStats>(DEFAULT_STATS)
  const profileRef = useRef<CoachProfile | null>(null)

  useEffect(() => { statsRef.current = stats }, [stats])
  useEffect(() => { profileRef.current = profile }, [profile])

  const profileReady = isProfileComplete(profile, stats)
  const pie = pieSegments(stats)
  const macroPct = macroPercentages(stats)
  const latestAssistantMessage = useMemo(() => [...messages].reverse().find(m => m.role === "assistant")?.content || buildCoachGuidance(profile, stats), [messages, profile, stats])
  const macroBars = [
    { label: "Protein", used: stats.proteinUsed, target: stats.proteinTarget, color: "from-cyan-300 to-cyan-500" },
    { label: "Carbs", used: stats.carbsUsed, target: stats.carbsTarget, color: "from-blue-400 to-blue-600" },
    { label: "Fats", used: stats.fatUsed, target: stats.fatTarget, color: "from-amber-300 to-orange-500" },
  ]

  useEffect(() => {
    try {
      const rawMessages = window.localStorage.getItem(STORAGE_KEY)
      if (rawMessages) {
        const parsed = JSON.parse(rawMessages)
        if (Array.isArray(parsed?.messages)) setMessages(parsed.messages)
      }
    } catch {}
    try {
      const rawProfile = window.localStorage.getItem(PROFILE_KEY)
      if (rawProfile) {
        const parsed = JSON.parse(rawProfile)
        if (parsed && typeof parsed === "object") {
          const withCountry = { ...parsed, country: parsed.country || inferCountryFromBrowser() || undefined }
          setProfile(withCountry)
          onboardingProfileRef.current = { ...EMPTY_PROFILE, ...withCountry }
        }
      }
    } catch {}
    try {
      const rawStats = window.localStorage.getItem(STATS_KEY)
      if (rawStats) {
        const parsed = JSON.parse(rawStats)
        if (parsed && typeof parsed === "object") setStats(normalizeStatsForToday({ ...DEFAULT_STATS, ...parsed, timezone: parsed.timezone || getBrowserTimeZone() }))
      }
    } catch {}
  }, [])

  useEffect(() => { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: messages.slice(-20) })) } catch {} }, [messages])
  useEffect(() => { try { window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile ?? {})) } catch {} }, [profile])
  useEffect(() => { try { window.localStorage.setItem(STATS_KEY, JSON.stringify(stats)) } catch {} }, [stats])

  useEffect(() => {
    if (!profileRef.current) {
      const inferred = inferCountryFromBrowser()
      if (inferred) {
        const next = { ...EMPTY_PROFILE, country: inferred }
        setProfile(next)
        onboardingProfileRef.current = next
      }
    }
    setStats(prev => normalizeStatsForToday({ ...prev, timezone: prev.timezone || getBrowserTimeZone() }))
  }, [])

  async function cleanupConversation() {
    dcRef.current?.close(); dcRef.current = null
    if (pcRef.current) {
      pcRef.current.getSenders().forEach(sender => sender.track?.stop())
      pcRef.current.close(); pcRef.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
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
  }

  function appendOrUpdateAssistantPartial(delta: string, isFinal = false) {
    if (!delta) return
    if (!currentAssistantMessageIdRef.current) {
      const message = makeMessage("assistant", delta)
      currentAssistantMessageIdRef.current = message.id
      currentAssistantTextRef.current = delta
      setMessages(prev => [...prev, message])
    } else {
      currentAssistantTextRef.current += delta
      const targetId = currentAssistantMessageIdRef.current
      setMessages(prev => prev.map(m => m.id === targetId ? { ...m, content: currentAssistantTextRef.current } : m))
    }
    if (isFinal) {
      currentAssistantMessageIdRef.current = null
      currentAssistantTextRef.current = ""
    }
  }

  function persistCompletedProfile(nextProfile: CoachProfile) {
    const targets = calculateTargets(nextProfile)
    const nextStats = markUsage({ ...normalizeStatsForToday(statsRef.current), ...targets, caloriesUsed: 0, proteinUsed: 0, carbsUsed: 0, fatUsed: 0, mealsToday: 0 })
    setProfile(nextProfile)
    setStats(nextStats)
    onboardingProfileRef.current = nextProfile
    const dc = dcRef.current
    if (dc?.readyState === "open") {
      dc.send(JSON.stringify({ type: "response.create", response: { instructions: `${profileContext(nextProfile, nextStats)}\nSetup is complete. Briefly confirm their calories, protein, carbs and fats are set, then ask what they want help with right now.` } }))
    }
  }

  function addUserTranscript(text: string) {
    const cleaned = text.trim()
    if (!cleaned) return
    setMessages(prev => [...prev, makeMessage("user", cleaned)])

    const ready = isProfileComplete(profileRef.current, statsRef.current)

    if (!ready) {
      const applied = mergeProfileFromInput(cleaned, onboardingProfileRef.current || EMPTY_PROFILE)
      onboardingProfileRef.current = applied.profile
      setProfile(applied.profile)
      if (applied.complete) {
        persistCompletedProfile(applied.profile)
        return
      }
      const nextStep = getOnboardingStep(applied.profile, statsRef.current)
      const dc = dcRef.current
      if (dc?.readyState === "open") {
        dc.send(JSON.stringify({ type: "response.create", response: { instructions: nextOnboardingInstruction(nextStep) } }))
      }
      return
    }

    const estimate = estimateFromText(cleaned)
    if (estimate) {
      setStats(prev => {
        const next = markUsage(prev)
        return {
          ...next,
          caloriesUsed: next.caloriesUsed + estimate.calories,
          proteinUsed: next.proteinUsed + estimate.protein,
          carbsUsed: next.carbsUsed + estimate.carbs,
          fatUsed: next.fatUsed + estimate.fat,
          mealsToday: next.mealsToday + (estimate.countedAsMeal ? 1 : 0),
        }
      })
    } else {
      setStats(prev => markUsage(prev))
    }
  }

  function sendTextPrompt(prompt: string) {
    const dc = dcRef.current
    if (!dc || dc.readyState !== "open") return
    setMessages(prev => [...prev, makeMessage("user", prompt)])
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
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 } as MediaTrackConstraints,
      })
      localStreamRef.current = stream
      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      const dc = pc.createDataChannel("oai-events")
      dcRef.current = dc
      dc.addEventListener("open", () => {
        setConnectionState("connected")
        setStatusText("Listening…")
        setStats(prev => markUsage(prev))
        window.setTimeout(() => {
          dc.send(JSON.stringify(buildFirstResponseEvent(profileRef.current, statsRef.current)))
          if (queuedPromptRef.current) {
            const prompt = queuedPromptRef.current
            queuedPromptRef.current = null
            window.setTimeout(() => sendTextPrompt(prompt), 300)
          }
        }, 150)
      })
      dc.addEventListener("message", (event) => {
        try { handleRealtimeEvent(JSON.parse(event.data)) } catch {}
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const response = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2025-06-03", {
        method: "POST",
        headers: { Authorization: `Bearer ${ephemeralKey}`, "Content-Type": "application/sdp", "OpenAI-Beta": "realtime=v1" },
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
    setStats(prev => markUsage(prev))
    const prompt = buildQuickPrompt(actionKey, profileRef.current, statsRef.current)
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
        @keyframes ringPulse { 0%,100%{transform:scale(1);opacity:.85} 50%{transform:scale(1.02);opacity:1} }
        @keyframes coreGlow { 0%,100%{ box-shadow:0 0 35px rgba(96,165,250,.18), inset 0 0 35px rgba(96,165,250,.08)} 50%{ box-shadow:0 0 90px rgba(96,165,250,.28), inset 0 0 55px rgba(251,146,60,.10)} }
        @keyframes shimmer { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      `}</style>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(96,165,250,0.18),transparent_24%),radial-gradient(circle_at_80%_20%,rgba(251,146,60,0.08),transparent_20%),linear-gradient(180deg,#020406_0%,#07101a_52%,#020406_100%)]" />
        <div className="absolute left-1/2 top-24 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-blue-400/10 blur-[120px]" />
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[34px] font-semibold tracking-[0.16em] text-white">GEORGE</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.34em] text-slate-500">coach • macros • performance</div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-blue-100">{connectionState === "connected" ? "Live" : "Ready"}</div>
        </div>

        <div className="mt-6 flex justify-center">
          <button type="button" disabled={connectionState === "connecting"} onClick={connectionState === "connected" ? stopConversation : startConversation} className="group relative flex h-[320px] w-[320px] items-center justify-center rounded-full focus:outline-none disabled:cursor-not-allowed">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(96,165,250,0.18),transparent_50%),radial-gradient(circle_at_50%_50%,rgba(251,146,60,0.12),transparent_68%)] blur-xl" />
            <div className="absolute inset-0 rounded-full border border-blue-300/20" style={{ animation: "ringPulse 3.4s ease-in-out infinite" }} />
            <div className="absolute inset-[10px] rounded-full border border-white/10" />
            <div className="absolute inset-[18px] rounded-full border border-blue-300/22" style={{ animation: "ringPulse 2.7s ease-in-out infinite" }} />
            <div className="absolute inset-[28px] rounded-full border border-orange-300/14" />
            <div className="absolute inset-[18px] rounded-full bg-[conic-gradient(from_90deg_at_50%_50%,rgba(96,165,250,0.03),rgba(96,165,250,0.4),rgba(251,146,60,0.20),rgba(96,165,250,0.05),rgba(96,165,250,0.03))]" style={{ animation: "shimmer 12s linear infinite" }} />
            <div className="absolute inset-[54px] rounded-full border border-white/6 bg-[radial-gradient(circle_at_50%_40%,rgba(96,165,250,.28),rgba(3,7,18,.96)_64%)]" style={{ animation: "coreGlow 4.3s ease-in-out infinite" }} />
            <div className="absolute inset-[80px] rounded-full bg-[radial-gradient(circle_at_50%_32%,rgba(255,255,255,.34),rgba(15,23,42,.16)_18%,rgba(2,6,23,.96)_60%)]" />
            <div className="absolute left-1/2 top-[88px] flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full border border-white/16 bg-white/10 shadow-[0_12px_40px_rgba(0,0,0,.35)] backdrop-blur">
              <BarChart3 className="h-7 w-7 text-white/90" />
            </div>
            <div className="relative z-10 mt-16 text-center">
              <div className="text-[46px] font-semibold tracking-tight text-white">George</div>
              <div className="mt-2 text-[22px] text-white/82">{connectionState === "connecting" ? "Connecting…" : connectionState === "connected" ? "Live now" : "Tap to talk"}</div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-300">live performance coach</div>
            </div>
          </button>
        </div>

        <p className="mt-3 text-center text-sm leading-6 text-slate-300">{latestAssistantMessage}</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            { label: "Calories left", value: stats.caloriesTarget > 0 ? caloriesLeft(stats) : "--" },
            { label: "Protein left", value: stats.proteinTarget > 0 ? `${proteinLeft(stats)}g` : "--" },
            { label: "Meals today", value: stats.mealsToday },
            { label: "Day streak", value: stats.streak },
          ].map((item) => (
            <div key={item.label} className="rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,28,.95),rgba(4,8,18,.98))] px-4 py-4 shadow-[0_16px_46px_rgba(0,0,0,.28)]">
              <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{item.label}</div>
              <div className="mt-3 text-[38px] font-semibold leading-none text-white">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.92),rgba(3,7,18,.98))] p-4 shadow-[0_18px_55px_rgba(0,0,0,.28)]">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.34em] text-slate-500">Macro progress</div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">consumed / target</div>
          </div>
          <div className="mt-4 space-y-4">
            {macroBars.map((bar) => (
              <div key={bar.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-white">{bar.label}</span>
                  <span className="text-slate-400">{bar.used} / {bar.target || "--"}g</span>
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
                  <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Today</div>
                  <div className="text-lg font-semibold text-white">Macros</div>
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm w-full">
              <div className="flex items-center justify-between gap-3 text-white"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Protein</div><span className="text-slate-400">{macroPct.protein}%</span></div>
              <div className="flex items-center justify-between gap-3 text-white"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Carbs</div><span className="text-slate-400">{macroPct.carbs}%</span></div>
              <div className="flex items-center justify-between gap-3 text-white"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" /> Fats</div><span className="text-slate-400">{macroPct.fat}%</span></div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <button key={action.key} type="button" onClick={() => handleQuickAction(action.key)} className={`group relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.94),rgba(3,7,18,.98))] px-4 py-4 text-left shadow-[0_18px_46px_rgba(0,0,0,.24)] transition duration-200 hover:-translate-y-[1px] hover:border-white/20`}>
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${action.accent} opacity-80`} />
                <div className="relative z-10 flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white"><Icon className="h-5 w-5" /></span>
                  <span className="text-[17px] font-medium leading-6 tracking-tight text-white">{action.label}</span>
                </div>
              </button>
            )
          })}
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-4 text-sm leading-6 text-rose-200">{error}</div> : null}
        {connectionState === "connected" ? <div className="mt-5 flex justify-center"><button type="button" onClick={stopConversation} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-95"><PhoneOff className="h-4 w-4" /> End conversation</button></div> : null}
      </div>
    </div>
  )
}
