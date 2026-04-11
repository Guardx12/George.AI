"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarClock, ChevronRight, Dumbbell, Flame, PhoneOff, Salad, Target, UtensilsCrossed } from "lucide-react"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"
type ActivityLevel = "sedentary" | "lightly active" | "moderately active" | "very active"
type Goal = "lose fat" | "maintain" | "gain muscle" | "fight prep / performance"
type Sex = "male" | "female"
type Country = "UK" | "US"
type QuickActionKey = "build_plan" | "off_track" | "what_eat" | "workout"
type ArtifactKind = "meal_plan" | "workout" | null

type CoachProfile = {
  name?: string
  country?: Country
  sex?: Sex
  age?: number
  heightCm?: number
  weightKg?: number
  activityLevel?: ActivityLevel
  goal?: Goal
  allergies?: string[]
  dislikes?: string[]
  planStyle?: "performance" | "balanced" | "flexible"
  mealsPerDay?: 3 | 4 | 5 | 6
}

type CoachTargets = {
  calories: number
  protein: number
  carbs: number
  fats: number
}

type PendingArtifactPreview = {
  kind: Exclude<ArtifactKind, null>
  body: string
  buttonLabel: string
}

type PlanArtifact = {
  id: string
  title: string
  kind: Exclude<ArtifactKind, null>
  body: string
  createdAt: string
}

type PatternMemory = {
  items: string[]
}

type CheckInStatus = "up_to_date" | "due" | "overdue"

type CheckInDraft = {
  weightKg?: number
  hunger?: string
  energy?: string
  adherence?: string
}

type CheckInState = {
  lastCheckInDate: string | null
  nextCheckInDate: string | null
  status: CheckInStatus
  draft: CheckInDraft | null
}

type StoredCoachState = {
  messages: LiveMessage[]
  profile: CoachProfile
  targets: CoachTargets | null
  activeMealPlan: PlanArtifact | null
  activeWorkoutPlan: PlanArtifact | null
  patterns: PatternMemory
  checkIn: CheckInState
  onboardingComplete: boolean
  pendingArtifactPreview: PendingArtifactPreview | null
}

const STORAGE_KEY = "coach-george-v2-state"

const EMPTY_PROFILE: CoachProfile = {}
const EMPTY_PATTERNS: PatternMemory = { items: [] }
const EMPTY_CHECKIN: CheckInState = {
  lastCheckInDate: null,
  nextCheckInDate: null,
  status: "due",
  draft: null,
}

const QUICK_ACTIONS: Array<{ key: QuickActionKey; label: string; accent: string; icon: any }> = [
  { key: "build_plan", label: "Build me a plan", accent: "from-sky-400/30 to-sky-600/5", icon: UtensilsCrossed },
  { key: "off_track", label: "Went off track", accent: "from-amber-300/30 to-orange-500/5", icon: Flame },
  { key: "what_eat", label: "What should I eat?", accent: "from-emerald-300/30 to-emerald-500/5", icon: Salad },
  { key: "workout", label: "Give me a workout", accent: "from-cyan-300/30 to-blue-500/5", icon: Dumbbell },
]

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

function makeMessage(role: LiveMessage["role"], content: string): LiveMessage {
  return { id: uid(), role, content }
}

function localDateIso(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + days)
  return localDateIso(date)
}

function diffDays(fromIso: string, toIso: string) {
  const from = new Date(`${fromIso}T12:00:00`).getTime()
  const to = new Date(`${toIso}T12:00:00`).getTime()
  return Math.round((to - from) / 86400000)
}

function calculateCheckInStatus(checkIn: CheckInState): CheckInState {
  const today = localDateIso()
  if (!checkIn.nextCheckInDate) {
    return { ...checkIn, status: "due" }
  }
  const days = diffDays(today, checkIn.nextCheckInDate)
  if (days > 0) return { ...checkIn, status: "up_to_date" }
  if (days === 0) return { ...checkIn, status: "due" }
  return { ...checkIn, status: "overdue" }
}

function buildStoredState(partial?: Partial<StoredCoachState>): StoredCoachState {
  return {
    messages: partial?.messages ?? [],
    profile: { ...EMPTY_PROFILE, ...(partial?.profile ?? {}) },
    targets: partial?.targets ?? null,
    activeMealPlan: partial?.activeMealPlan ?? null,
    activeWorkoutPlan: partial?.activeWorkoutPlan ?? null,
    patterns: partial?.patterns ?? EMPTY_PATTERNS,
    checkIn: calculateCheckInStatus(partial?.checkIn ?? EMPTY_CHECKIN),
    onboardingComplete: partial?.onboardingComplete ?? false,
    pendingArtifactPreview: partial?.pendingArtifactPreview ?? null,
  }
}

function loadStoredState(): StoredCoachState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return buildStoredState(parsed)
  } catch {
    return null
  }
}

function saveStoredState(state: StoredCoachState) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buildStoredState(state)))
}

function parseMealsPerDay(input: string): 3 | 4 | 5 | 6 | null {
  const m = input.toLowerCase().match(/([3-6])\s*(?:meals?|meal a day|meals a day)/)
  if (!m) return null
  return Number(m[1]) as 3 | 4 | 5 | 6
}

function calculateTargets(profile: CoachProfile): CoachTargets | null {
  const weight = profile.weightKg || 0
  const height = profile.heightCm || 0
  const age = profile.age || 0
  const sex = profile.sex || "male"
  const goal = profile.goal || "lose fat"
  const activityLevel = profile.activityLevel || "moderately active"
  if (!weight || !height || !age || !sex || !goal || !activityLevel) return null

  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === "male" ? 5 : -161)
  const multipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    "lightly active": 1.375,
    "moderately active": 1.55,
    "very active": 1.725,
  }

  const maintenance = bmr * multipliers[activityLevel]
  const rawCalories = goal === "lose fat" ? maintenance - 400 : goal === "gain muscle" ? maintenance + 200 : goal === "fight prep / performance" ? maintenance - 250 : maintenance
  const calories = Math.max(1200, Math.round(rawCalories / 50) * 50)
  const proteinPerKg = goal === "maintain" ? 1.8 : goal === "fight prep / performance" ? 2.2 : 2
  const protein = Math.round((weight * proteinPerKg) / 5) * 5
  const fats = Math.max(40, Math.round(((calories * 0.25) / 9) / 5) * 5)
  const carbs = Math.max(0, Math.round(((calories - protein * 4 - fats * 9) / 4) / 5) * 5)
  return { calories, protein, carbs, fats }
}

function isProfileComplete(profile: CoachProfile) {
  return Boolean(
    profile.name &&
    profile.goal &&
    profile.sex &&
    profile.age &&
    profile.heightCm &&
    profile.weightKg &&
    profile.activityLevel &&
    profile.country &&
    profile.allergies !== undefined &&
    profile.dislikes !== undefined &&
    profile.planStyle &&
    profile.mealsPerDay,
  )
}

function inferCountryFromBrowser(): Country | null {
  if (typeof window === "undefined") return null
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""
  const lang = navigator.language?.toLowerCase() || ""
  if (tz.includes("London") || lang.includes("en-gb")) return "UK"
  if (tz.startsWith("America/") || lang.includes("en-us")) return "US"
  return null
}

function parseSex(input: string): Sex | null {
  const t = input.toLowerCase()
  if (/\b(male|man|guy|bloke)\b/.test(t)) return "male"
  if (/\b(female|woman|girl|lady)\b/.test(t)) return "female"
  return null
}

function parseGoal(input: string): Goal | null {
  const t = input.toLowerCase()
  if (t.includes("fight") || t.includes("box") || t.includes("performance") || t.includes("sport")) return "fight prep / performance"
  if (t.includes("lose") || t.includes("fat loss") || t.includes("cut") || t.includes("lean")) return "lose fat"
  if (t.includes("gain") || t.includes("muscle") || t.includes("bulk")) return "gain muscle"
  if (t.includes("maintain")) return "maintain"
  return null
}

function parsePlanStyle(input: string): "performance" | "balanced" | "flexible" | null {
  const t = input.toLowerCase()
  if (t.includes("performance") || t.includes("strict") || t.includes("cleaner")) return "performance"
  if (t.includes("flexible")) return "flexible"
  if (t.includes("balanced") || t.includes("realistic")) return "balanced"
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

function parseName(input: string): string | null {
  const trimmed = input.trim()
  const direct = trimmed.match(/(?:my name is|i(?:'|’)m|i am|call me)\s+([A-Za-z][A-Za-z'’-]{1,20})/i)
  if (direct) return direct[1].replace(/^[a-z]/, (s) => s.toUpperCase())
  const plain = trimmed.match(/^([A-Za-z][A-Za-z'’-]{1,20})$/)
  if (plain) return plain[1].replace(/^[a-z]/, (s) => s.toUpperCase())
  return null
}

function parseListField(input: string) {
  return input
    .split(/,| and /i)
    .map((v) => v.trim())
    .filter(Boolean)
}

function parseAllergyAnswer(input: string): string[] {
  const t = input.toLowerCase().trim()
  if (/^(none|no|nothing|nope|nil)$/.test(t) || /\b(no allergies|no allergy)\b/.test(t)) return []
  const cleaned = t.replace(/allerg(?:y|ies)\s*(?:to)?/g, " ").replace(/i(?:'|’)m allergic to/g, " ").replace(/i am allergic to/g, " ").replace(/avoid/g, " ")
  return parseListField(cleaned)
}

function parseDislikeAnswer(input: string): string[] {
  const t = input.toLowerCase().trim()
  if (/^(none|no|nothing|nope|nil)$/.test(t) || /\b(nothing really|anything is fine|all good)\b/.test(t)) return []
  const cleaned = t
    .replace(/.*don't like\s*/, "")
    .replace(/.*do not like\s*/, "")
    .replace(/.*dislike\s*/, "")
    .replace(/.*hate\s*/, "")
    .replace(/.*won'?t eat\s*/, "")
    .replace(/foods?\s*(?:to avoid)?/g, " ")
  return parseListField(cleaned)
}

function applyOnboardingAnswer(step: string, input: string, prevProfile: CoachProfile): CoachProfile {
  const next = { ...prevProfile }
  switch (step) {
    case "name": {
      const value = parseName(input)
      if (value) next.name = value
      break
    }
    case "goal": {
      const value = parseGoal(input)
      if (value) next.goal = value
      break
    }
    case "sex": {
      const value = parseSex(input)
      if (value) next.sex = value
      break
    }
    case "age": {
      const value = parseAge(input)
      if (value) next.age = value
      break
    }
    case "height": {
      const value = parseHeightCm(input)
      if (value) next.heightCm = value
      break
    }
    case "weight": {
      const value = parseWeightKg(input)
      if (value) next.weightKg = value
      break
    }
    case "activity": {
      const value = parseActivity(input)
      if (value) next.activityLevel = value
      break
    }
    case "planStyle": {
      const value = parsePlanStyle(input)
      if (value) next.planStyle = value
      break
    }
    case "mealsPerDay": {
      const value = parseMealsPerDay(input)
      if (value) next.mealsPerDay = value
      break
    }
    case "allergies":
      next.allergies = parseAllergyAnswer(input)
      break
    case "dislikes":
      next.dislikes = parseDislikeAnswer(input)
      break
    case "country": {
      const value = parseCountry(input) || inferCountryFromBrowser() || undefined
      if (value) next.country = value
      break
    }
  }
  return next
}

function getOnboardingStep(profile: CoachProfile) {
  if (!profile.name) return "name"
  if (!profile.goal) return "goal"
  if (!profile.sex) return "sex"
  if (!profile.age) return "age"
  if (!profile.heightCm) return "height"
  if (!profile.weightKg) return "weight"
  if (!profile.activityLevel) return "activity"
  if (!profile.planStyle) return "planStyle"
  if (!profile.mealsPerDay) return "mealsPerDay"
  if (profile.allergies === undefined) return "allergies"
  if (profile.dislikes === undefined) return "dislikes"
  if (!profile.country) return "country"
  return "done"
}

function nextOnboardingInstruction(step: string) {
  switch (step) {
    case "name": return "Start setup. Ask only this: what’s your first name?"
    case "goal": return "Good. Now ask only this: what’s your main goal right now — lose fat, maintain, gain muscle, or fight prep / performance?"
    case "sex": return "Good. Now ask only this: are you male or female?"
    case "age": return "Now ask only this: how old are you?"
    case "height": return "Now ask only this: what’s your height? Accept cm or feet and inches."
    case "weight": return "Now ask only this: what’s your current weight? Accept kg, lb, or stone."
    case "activity": return "Now ask only this: how active are you day to day — sedentary, lightly active, moderately active, or very active?"
    case "planStyle": return "Now ask only this: do you want your plan stricter and cleaner, balanced and realistic, or more flexible?"
    case "mealsPerDay": return "Now ask only this: how many meals do you want me to build around each day — 3, 4, 5, or 6?"
    case "allergies": return "Now ask only this: do you have any allergies or foods you need me to avoid? If none, say none."
    case "dislikes": return "Now ask only this: are there any foods you do not like or do not want in your plans? If none, say none."
    case "country": return "Now ask only this: are you in the UK or the US?"
    default: return "Setup is complete. Briefly confirm that their targets are ready, then ask what they want help with right now."
  }
}

function profileContext(profile: CoachProfile | null, targets: CoachTargets | null, checkIn: CheckInState) {
  if (!profile || !isProfileComplete(profile) || !targets) {
    return "This user is not set up yet. Onboard them one question at a time. Collect first name, goal, sex, age, height, weight, activity level, plan style, meals per day, allergies, dislikes, and country. Do not skip steps."
  }
  return `Saved profile:\n- name: ${profile.name}\n- country: ${profile.country}\n- sex: ${profile.sex}\n- age: ${profile.age}\n- height: ${profile.heightCm} cm\n- weight: ${profile.weightKg} kg\n- activity: ${profile.activityLevel}\n- goal: ${profile.goal}\n- targets: ${targets.calories} calories, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fats}g fats\n- check-in status: ${checkIn.status}\nUse this automatically. Do not ask for their stats again unless they say something has changed.`
}

function buildFirstResponseEvent(profile: CoachProfile | null, targets: CoachTargets | null, checkIn: CheckInState) {
  const instructions = profile && isProfileComplete(profile) && targets
    ? `${profileContext(profile, targets, checkIn)}\n\nGreet them like a returning user by first name in one short line. If their weekly check-in is due or overdue, mention it briefly. Then ask what they want help with right now.`
    : `${profileContext(profile, targets, checkIn)}\n\n${nextOnboardingInstruction(getOnboardingStep(profile ?? EMPTY_PROFILE))}`
  return { type: "response.create", response: { instructions } }
}

function buildQuickPrompt(actionKey: QuickActionKey, profile: CoachProfile | null, targets: CoachTargets | null, checkIn: CheckInState) {
  const context = profileContext(profile, targets, checkIn)
  if (actionKey === "build_plan") {
    return `${context}\nThe user tapped Build me a plan. Give a premium, practical full day of eating. Use a short title, then headings for Breakfast, Lunch, Dinner, and Snack. Include specific portions. Keep the tone like a coach, not a tracker.`
  }
  if (actionKey === "off_track") {
    return `${context}\nThe user tapped Went off track. Reset them calmly but firmly. Ask what happened, then give the next best move for today. Keep it short and practical.`
  }
  if (actionKey === "what_eat") {
    return `${context}\nThe user tapped What should I eat. Give one strong next meal recommendation with portion sizes, then 2 quick alternatives. Keep it crisp.`
  }
  return `${context}\nThe user tapped Give me a workout. Give a practical workout they can do now. Use a short title and a clear structure with exercises, sets, reps, or time blocks.`
}

function artifactTitle(kind: Exclude<ArtifactKind, null>) {
  if (kind === "meal_plan") return "Current plan"
  return "Current workout"
}

function normaliseArtifactBody(text: string) {
  return text.replace(/\n{3,}/g, "\n\n").trim()
}

function extractPattern(input: string) {
  const t = input.toLowerCase()
  if (t.includes("hungry") && t.includes("night")) return "Struggles with late-night hunger"
  if (t.includes("tired") || t.includes("low energy")) return "Low energy comes up sometimes"
  if (t.includes("don't like") || t.includes("do not like") || t.includes("hate")) return "Preference update mentioned"
  if (t.includes("busy") || t.includes("quick meal")) return "Needs practical low-friction meals"
  return null
}

function isAffirmative(input: string) {
  return /^(yes|yeah|yep|correct|that'?s right|confirm|sounds good)$/i.test(input.trim())
}

function startCheckInDraft(checkIn: CheckInState): CheckInState {
  return { ...checkIn, draft: {} }
}

function getCheckInStep(checkIn: CheckInState) {
  const draft = checkIn.draft ?? {}
  if (!draft.weightKg) return "weight"
  if (!draft.hunger) return "hunger"
  if (!draft.energy) return "energy"
  if (!draft.adherence) return "adherence"
  return "done"
}

function nextCheckInInstruction(step: string) {
  switch (step) {
    case "weight": return "Start the weekly check-in. Ask only this: what’s your current weight?"
    case "hunger": return "Now ask only this: how was your hunger this week?"
    case "energy": return "Now ask only this: how was your energy this week?"
    case "adherence": return "Now ask only this: how manageable did the plan feel this week, and what do you want changed?"
    default: return "Thank them. Briefly summarise the check-in and say their next check-in is in 7 days."
  }
}

function relativeCheckInLabel(checkIn: CheckInState) {
  if (!checkIn.nextCheckInDate) return "Check-in due"
  const today = localDateIso()
  const delta = diffDays(today, checkIn.nextCheckInDate)
  if (delta > 0) return `Next check-in in ${delta} day${delta === 1 ? "" : "s"}`
  if (delta === 0) return "Time to check in"
  return `Check-in ${Math.abs(delta)} day${Math.abs(delta) === 1 ? "" : "s"} late`
}

function renderLines(text: string) {
  return normaliseArtifactBody(text).split("\n").filter(Boolean)
}

export function CoachGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [statusText, setStatusText] = useState("Ready when you are")
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<CoachProfile | null>(null)
  const [targets, setTargets] = useState<CoachTargets | null>(null)
  const [activeMealPlan, setActiveMealPlan] = useState<PlanArtifact | null>(null)
  const [activeWorkoutPlan, setActiveWorkoutPlan] = useState<PlanArtifact | null>(null)
  const [patterns, setPatterns] = useState<PatternMemory>(EMPTY_PATTERNS)
  const [checkIn, setCheckIn] = useState<CheckInState>(EMPTY_CHECKIN)
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [pendingProfile, setPendingProfile] = useState<CoachProfile | null>(null)
  const [pendingArtifactPreview, setPendingArtifactPreview] = useState<PendingArtifactPreview | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const queuedPromptRef = useRef<string | null>(null)
  const profileRef = useRef<CoachProfile | null>(null)
  const targetsRef = useRef<CoachTargets | null>(null)
  const checkInRef = useRef<CheckInState>(EMPTY_CHECKIN)
  const pendingProfileRef = useRef<CoachProfile | null>(null)
  const pendingArtifactRef = useRef<ArtifactKind>(null)

  useEffect(() => { profileRef.current = profile }, [profile])
  useEffect(() => { targetsRef.current = targets }, [targets])
  useEffect(() => { checkInRef.current = checkIn }, [checkIn])
  useEffect(() => { pendingProfileRef.current = pendingProfile }, [pendingProfile])

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant")?.content || "Tell George what’s going on and he’ll tell you what to do.",
    [messages],
  )

  useEffect(() => {
    const stored = loadStoredState()
    if (!stored) return
    const nextProfile = Object.keys(stored.profile || {}).length ? { ...stored.profile, country: stored.profile.country || inferCountryFromBrowser() || undefined } : null
    const validSetup = Boolean(nextProfile && isProfileComplete(nextProfile) && stored.targets)
    setMessages(stored.messages)
    setProfile(nextProfile)
    setTargets(validSetup ? stored.targets : null)
    setActiveMealPlan(validSetup ? stored.activeMealPlan : null)
    setActiveWorkoutPlan(validSetup ? stored.activeWorkoutPlan : null)
    setPatterns(stored.patterns)
    setCheckIn(validSetup ? calculateCheckInStatus(stored.checkIn) : EMPTY_CHECKIN)
    setOnboardingComplete(validSetup && stored.onboardingComplete)
    setPendingArtifactPreview(stored.pendingArtifactPreview ?? null)
  }, [])

  useEffect(() => {
    saveStoredState(buildStoredState({
      messages: messages.slice(-24),
      profile: profile ?? EMPTY_PROFILE,
      targets,
      activeMealPlan,
      activeWorkoutPlan,
      patterns,
      checkIn,
      onboardingComplete,
      pendingArtifactPreview,
    }))
  }, [messages, profile, targets, activeMealPlan, activeWorkoutPlan, patterns, checkIn, onboardingComplete, pendingArtifactPreview])

  function pushAssistantMessage(content: string) {
    setMessages((prev) => [...prev, makeMessage("assistant", content)])
  }

  function buildCoachGreeting() {
    if (!profile?.name || !targets) return "Tell George what’s going on and he’ll tell you what to do."
    return `${profile.name}, you’re set for ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fats}g fats, ${targets.calories} calories, and ${profile.mealsPerDay ?? 4} meals a day.`
  }

  function sendDataChannelInstructions(instructions: string) {
    const dc = dcRef.current
    if (!dc || dc.readyState !== "open") return false
    dc.send(JSON.stringify({ type: "response.create", response: { instructions } }))
    return true
  }

  function savePatternFromInput(input: string) {
    const candidate = extractPattern(input)
    if (!candidate) return
    setPatterns((prev) => (prev.items.includes(candidate) ? prev : { items: [...prev.items, candidate] }))
  }

  function completeOnboarding(nextProfile: CoachProfile) {
    const resolvedProfile = { ...nextProfile, country: nextProfile.country || inferCountryFromBrowser() || "UK" }
    const nextTargets = calculateTargets(resolvedProfile)
    if (!nextTargets) return
    const today = localDateIso()
    const nextCheckIn = calculateCheckInStatus({ lastCheckInDate: today, nextCheckInDate: addDays(today, 7), status: "up_to_date", draft: null })
    setProfile(resolvedProfile)
    setTargets(nextTargets)
    setOnboardingComplete(true)
    setPendingProfile(null)
    setPendingArtifactPreview(null)
    setCheckIn(nextCheckIn)
    pushAssistantMessage(`Targets locked in. You’re set for ${nextTargets.calories} calories, ${nextTargets.protein}g protein, ${nextTargets.carbs}g carbs, and ${nextTargets.fats}g fats. Tell me what you want help with first.`)
  }

  function updateWeightAndTargets(weightKg: number) {
    const current = profileRef.current
    if (!current) return
    const nextProfile = { ...current, weightKg }
    const nextTargets = calculateTargets(nextProfile)
    if (!nextTargets) return
    setProfile(nextProfile)
    setTargets(nextTargets)
  }

  function finishCheckIn(nextCheckIn: CheckInState) {
    const today = localDateIso()
    const completed = calculateCheckInStatus({
      lastCheckInDate: today,
      nextCheckInDate: addDays(today, 7),
      status: "up_to_date",
      draft: null,
    })
    if (nextCheckIn.draft?.weightKg) updateWeightAndTargets(nextCheckIn.draft.weightKg)
    setCheckIn(completed)
    pushAssistantMessage("Weekly check-in saved. I’ve updated your next check-in for 7 days from now and kept your coaching memory current.")
  }

  function advanceCheckIn(input: string) {
    const current = checkInRef.current.draft ? checkInRef.current : startCheckInDraft(checkInRef.current)
    const step = getCheckInStep(current)
    const nextDraft = { ...(current.draft ?? {}) }

    if (step === "weight") {
      const value = parseWeightKg(input)
      if (value) nextDraft.weightKg = value
    } else if (step === "hunger") {
      nextDraft.hunger = input.trim()
    } else if (step === "energy") {
      nextDraft.energy = input.trim()
    } else if (step === "adherence") {
      nextDraft.adherence = input.trim()
    }

    const nextState = calculateCheckInStatus({ ...current, draft: nextDraft })
    setCheckIn(nextState)
    const nextStep = getCheckInStep(nextState)
    if (nextStep === "done") {
      finishCheckIn(nextState)
      return true
    }
    if (!sendDataChannelInstructions(nextCheckInInstruction(nextStep))) {
      pushAssistantMessage(nextCheckInInstruction(nextStep).replace(/^.*?:\s*/, ""))
    }
    return true
  }

  function saveArtifact(kind: Exclude<ArtifactKind, null>, body: string) {
    const artifact: PlanArtifact = {
      id: uid(),
      title: artifactTitle(kind),
      kind,
      body: normaliseArtifactBody(body),
      createdAt: new Date().toISOString(),
    }
    if (kind === "meal_plan") {
      setActiveMealPlan(artifact)
      return
    }
    setActiveWorkoutPlan(artifact)
  }

  function confirmPendingArtifact() {
    if (!pendingArtifactPreview) return
    saveArtifact(pendingArtifactPreview.kind, pendingArtifactPreview.body)
    setPendingArtifactPreview(null)
  }

  function clearPendingArtifact() {
    setPendingArtifactPreview(null)
  }

  function renderProfilePreviewCard(currentProfile: CoachProfile | null) {
    if (!currentProfile) return null
    const entries = [
      ["Name", currentProfile.name],
      ["Goal", currentProfile.goal],
      ["Sex", currentProfile.sex],
      ["Age", currentProfile.age ? String(currentProfile.age) : undefined],
      ["Height", currentProfile.heightCm ? `${currentProfile.heightCm} cm` : undefined],
      ["Weight", currentProfile.weightKg ? `${currentProfile.weightKg} kg` : undefined],
      ["Activity", currentProfile.activityLevel],
      ["Plan style", currentProfile.planStyle],
      ["Meals", currentProfile.mealsPerDay ? `${currentProfile.mealsPerDay} meals` : undefined],
      ["Allergies", currentProfile.allergies ? (currentProfile.allergies.length ? currentProfile.allergies.join(", ") : "None") : undefined],
      ["Dislikes", currentProfile.dislikes ? (currentProfile.dislikes.length ? currentProfile.dislikes.join(", ") : "None") : undefined],
    ].filter((entry) => entry[1]) as Array<[string, string]>

    if (!entries.length) return null

    const ready = isProfileComplete(currentProfile)
    return (
    <div className="relative min-h-screen overflow-hidden bg-[#030507] text-white">
      <style>{`
        @keyframes ringPulse { 0%,100%{transform:scale(1);opacity:.85} 50%{transform:scale(1.02);opacity:1} }
        @keyframes coreGlow { 0%,100%{ box-shadow:0 0 35px rgba(96,165,250,.18), inset 0 0 35px rgba(96,165,250,.08)} 50%{ box-shadow:0 0 90px rgba(96,165,250,.28), inset 0 0 55px rgba(251,146,60,.10)} }
      `}</style>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(96,165,250,0.18),transparent_24%),radial-gradient(circle_at_80%_20%,rgba(251,146,60,0.08),transparent_20%),linear-gradient(180deg,#020406_0%,#07101a_52%,#020406_100%)]" />
        <div className="absolute left-1/2 top-24 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-blue-400/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[34px] font-semibold tracking-[0.16em] text-white">GEORGE</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.34em] text-slate-500">coach • meals • workouts • support</div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-blue-100">{connectionState === "connected" ? "Live" : "Ready"}</div>
        </div>

        <div className="mt-6 flex justify-center">
          <button type="button" disabled={connectionState === "connecting"} onClick={connectionState === "connected" ? stopConversation : startConversation} className="group relative flex h-[320px] w-[320px] items-center justify-center rounded-full focus:outline-none disabled:cursor-not-allowed">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(96,165,250,0.18),transparent_50%),radial-gradient(circle_at_50%_50%,rgba(251,146,60,0.12),transparent_68%)] blur-xl" />
            <div className="absolute inset-0 rounded-full border border-blue-300/20" style={{ animation: "ringPulse 3.4s ease-in-out infinite" }} />
            <div className="absolute inset-[10px] rounded-full border border-white/10" />
            <div className="absolute inset-[18px] rounded-full border border-blue-300/22" style={{ animation: "ringPulse 2.7s ease-in-out infinite" }} />
            <div className="absolute inset-[28px] rounded-full border border-orange-300/18" />
            <div className="absolute inset-[40px] rounded-full bg-[linear-gradient(180deg,rgba(9,18,30,.96),rgba(3,6,16,.98))]" style={{ animation: "coreGlow 4.2s ease-in-out infinite" }} />
            <div className="relative z-10 text-center">
              <div className="text-[13px] uppercase tracking-[0.34em] text-slate-400">Tap to talk</div>
              <div className="mt-3 text-[56px] font-semibold leading-none text-white">George</div>
              <div className="mt-4 text-sm text-slate-300">{statusText}</div>
            </div>
          </button>
        </div>

        <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.92),rgba(3,7,18,.98))] p-4 shadow-[0_18px_55px_rgba(0,0,0,.28)]">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.34em] text-slate-500">Live conversation</div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-300">buttons appear here</div>
          </div>
          <div className="mt-3 space-y-2">
            {[...messages].filter((m) => m.role !== "system").slice(-3).map((message) => (
              <div key={message.id} className={`rounded-[1.1rem] border px-3 py-3 text-sm leading-6 ${message.role === "assistant" ? "border-cyan-300/15 bg-cyan-400/5 text-slate-200" : "border-white/8 bg-white/[0.03] text-slate-300"}`}>
                <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{message.role === "assistant" ? "George" : "You"}</div>
                <div className="mt-1 whitespace-pre-wrap">{message.content}</div>
              </div>
            ))}
            {!messages.filter((m) => m.role !== "system").length ? (
              <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.03] px-3 py-3 text-sm leading-6 text-slate-400">Talk to George. As soon as something is ready to confirm, the right button appears here.</div>
            ) : null}
          </div>

          {!onboardingComplete ? (
            <div className="mt-4 rounded-[1.1rem] border border-white/8 bg-white/[0.03] px-3 py-3 text-sm text-slate-300">
              <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Setup preview</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div><span className="text-slate-500">Name</span><div>{(pendingProfile ?? profile)?.name || "—"}</div></div>
                <div><span className="text-slate-500">Goal</span><div>{(pendingProfile ?? profile)?.goal || "—"}</div></div>
                <div><span className="text-slate-500">Sex</span><div>{(pendingProfile ?? profile)?.sex || "—"}</div></div>
                <div><span className="text-slate-500">Age</span><div>{(pendingProfile ?? profile)?.age || "—"}</div></div>
                <div><span className="text-slate-500">Height</span><div>{(pendingProfile ?? profile)?.heightCm ? `${(pendingProfile ?? profile)?.heightCm} cm` : "—"}</div></div>
                <div><span className="text-slate-500">Weight</span><div>{(pendingProfile ?? profile)?.weightKg ? `${(pendingProfile ?? profile)?.weightKg} kg` : "—"}</div></div>
                <div><span className="text-slate-500">Style</span><div>{(pendingProfile ?? profile)?.planStyle || "—"}</div></div>
                <div><span className="text-slate-500">Meals</span><div>{(pendingProfile ?? profile)?.mealsPerDay ? `${(pendingProfile ?? profile)?.mealsPerDay}` : "—"}</div></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {pendingProfile ? <button type="button" onClick={() => completeOnboarding(pendingProfile)} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100 transition hover:bg-cyan-400/15">Save targets</button> : <div className="text-xs text-slate-400">George is still collecting the missing setup details.</div>}
              </div>
            </div>
          ) : null}

          {pendingArtifactPreview ? (
            <div className="mt-4 rounded-[1.1rem] border border-cyan-300/15 bg-cyan-400/5 px-3 py-3 text-sm leading-6 text-slate-200">
              <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-200">Action ready</div>
              <div className="mt-2 whitespace-pre-wrap">{pendingArtifactPreview.body}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={confirmPendingArtifact} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100 transition hover:bg-cyan-400/15">{pendingArtifactPreview.buttonLabel}</button>
                <button type="button" onClick={clearPendingArtifact} className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300 transition hover:bg-white/5">Keep talking</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.92),rgba(3,7,18,.98))] p-4 shadow-[0_18px_46px_rgba(0,0,0,.24)]">
            <div className="text-[10px] uppercase tracking-[0.34em] text-slate-500">Macros</div>
            {targets ? <div className="mt-3 space-y-2 text-sm text-slate-200"><div className="flex justify-between"><span>Protein</span><span className="text-cyan-300">{targets.protein}g</span></div><div className="flex justify-between"><span>Carbs</span><span className="text-blue-300">{targets.carbs}g</span></div><div className="flex justify-between"><span>Fats</span><span className="text-orange-300">{targets.fats}g</span></div><div className="flex justify-between"><span>Calories</span><span>{targets.calories}</span></div></div> : <div className="mt-3 text-sm leading-6 text-slate-400">No saved macros yet.</div>}
          </div>
          <div className="rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.92),rgba(3,7,18,.98))] p-4 shadow-[0_18px_46px_rgba(0,0,0,.24)]">
            <div className="text-[10px] uppercase tracking-[0.34em] text-slate-500">Current weight</div>
            {profile?.weightKg ? <div className="mt-3 text-[34px] font-semibold leading-none text-white">{profile.weightKg}<span className="ml-1 text-lg text-slate-400">kg</span></div> : <div className="mt-3 text-sm leading-6 text-slate-400">No current weight saved yet.</div>}
          </div>
        </div>

        <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.92),rgba(3,7,18,.98))] p-4 shadow-[0_18px_55px_rgba(0,0,0,.28)]">
          <div className="text-[10px] uppercase tracking-[0.34em] text-slate-500">Current meal plan</div>
          {activeMealPlan ? <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">{renderLines(activeMealPlan.body).map((line, index) => <div key={`${activeMealPlan.id}-${index}`}>{line}</div>)}</div> : <div className="mt-3 text-sm leading-6 text-slate-400">No meal plan saved yet.</div>}
        </div>

        <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.92),rgba(3,7,18,.98))] p-4 shadow-[0_18px_55px_rgba(0,0,0,.28)]">
          <div className="text-[10px] uppercase tracking-[0.34em] text-slate-500">Current workout</div>
          {activeWorkoutPlan ? <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">{renderLines(activeWorkoutPlan.body).map((line, index) => <div key={`${activeWorkoutPlan.id}-${index}`}>{line}</div>)}</div> : <div className="mt-3 text-sm leading-6 text-slate-400">No workout saved yet.</div>}
        </div>

        <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.92),rgba(3,7,18,.98))] p-4 shadow-[0_18px_55px_rgba(0,0,0,.28)]">
          <div className="text-[10px] uppercase tracking-[0.34em] text-slate-500">Latest from George</div>
          <div className="mt-3 text-sm leading-6 text-slate-300">{latestAssistantMessage}</div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { key: "build_plan", label: "Build me a plan" },
            { key: "what_eat", label: "What should I eat today?" },
            { key: "off_track", label: "I went off track" },
            { key: "workout", label: "Give me a workout" },
          ].map((action) => (
            <button key={action.key} type="button" onClick={() => handleQuickAction(action.key as QuickActionKey)} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold tracking-[0.02em] text-slate-200 transition hover:bg-white/[0.08]">{action.label}</button>
          ))}
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-4 text-sm leading-6 text-rose-200">{error}</div> : null}
        {connectionState === "connected" ? <div className="mt-5 flex justify-center"><button type="button" onClick={stopConversation} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-95"><PhoneOff className="h-4 w-4" /> End conversation</button></div> : null}
      </div>
    </div>
  )
}
