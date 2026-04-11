"use client"

import { useEffect, useRef, useState } from "react"
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
}

type CoachTargets = {
  calories: number
  protein: number
  carbs: number
  fats: number
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
    profile.planStyle,
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
    case "allergies": return "Now ask only this: do you have any allergies or foods you need me to avoid? If none, say none."
    case "dislikes": return "Now ask only this: are there any foods you do not like or do not want in your plans? If none, say none."
    case "country": return "Now ask only this: are you in the UK or the US?"
    default: return "Setup is complete. Briefly confirm that their targets are ready, then ask what they want help with right now."
  }
}

function profileContext(profile: CoachProfile | null, targets: CoachTargets | null, checkIn: CheckInState) {
  if (!profile || !isProfileComplete(profile) || !targets) {
    return "This user is not set up yet. Onboard them one question at a time. Collect first name, goal, sex, age, height, weight, activity level, plan style, allergies, dislikes, and country. Do not skip steps."
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
    }))
  }, [messages, profile, targets, activeMealPlan, activeWorkoutPlan, patterns, checkIn, onboardingComplete])

  function pushAssistantMessage(content: string) {
    setMessages((prev) => [...prev, makeMessage("assistant", content)])
  }

  function buildCoachGreeting() {
    if (!profile?.name || !targets) return "Tell George what’s going on and he’ll tell you what to do."
    return `${profile.name}, you’re set for ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fats}g fats, and ${targets.calories} calories.`
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

  function appendOrUpdateAssistantPartial(delta: string, isFinal = false) {
    if (!delta) return
    if (!currentAssistantMessageIdRef.current) {
      const message = makeMessage("assistant", delta)
      currentAssistantMessageIdRef.current = message.id
      currentAssistantTextRef.current = delta
      setMessages((prev) => [...prev, message])
    } else {
      currentAssistantTextRef.current += delta
      const targetId = currentAssistantMessageIdRef.current
      setMessages((prev) => prev.map((m) => (m.id === targetId ? { ...m, content: currentAssistantTextRef.current } : m)))
    }

    if (isFinal) {
      const finalText = currentAssistantTextRef.current.trim()
      if (pendingArtifactRef.current && finalText) {
        saveArtifact(pendingArtifactRef.current, finalText)
      }
      pendingArtifactRef.current = null
      currentAssistantMessageIdRef.current = null
      currentAssistantTextRef.current = ""
    }
  }

  function startOnboardingFollowUp(nextProfile: CoachProfile) {
    setProfile(nextProfile)
    const nextStep = getOnboardingStep(nextProfile)
    if (!sendDataChannelInstructions(nextOnboardingInstruction(nextStep))) {
      pushAssistantMessage(nextOnboardingInstruction(nextStep).replace(/^.*?:\s*/, ""))
    }
  }

  function handleProfileUpdates(input: string) {
    const current = profileRef.current ?? EMPTY_PROFILE
    const next = { ...current }
    const goal = parseGoal(input)
    const sex = parseSex(input)
    const age = parseAge(input)
    const heightCm = parseHeightCm(input)
    const weightKg = parseWeightKg(input)
    const activity = parseActivity(input)
    const planStyle = parsePlanStyle(input)
    const country = parseCountry(input)
    if (goal) next.goal = goal
    if (sex) next.sex = sex
    if (age) next.age = age
    if (heightCm) next.heightCm = heightCm
    if (weightKg) next.weightKg = weightKg
    if (activity) next.activityLevel = activity
    if (planStyle) next.planStyle = planStyle
    if (country) next.country = country

    const lower = input.toLowerCase()
    if (lower.includes("don't like") || lower.includes("do not like") || lower.includes("hate")) next.dislikes = parseDislikeAnswer(input)
    if (lower.includes("allerg")) next.allergies = parseAllergyAnswer(input)

    if (JSON.stringify(current) !== JSON.stringify(next)) {
      setProfile(next)
      const nextTargets = calculateTargets(next)
      if (nextTargets) setTargets(nextTargets)
      pushAssistantMessage("Got it — I’ve updated your saved details.")
      return true
    }
    return false
  }

  function addUserTranscript(text: string) {
    const cleaned = text.trim()
    if (!cleaned) return
    setMessages((prev) => [...prev, makeMessage("user", cleaned)])
    savePatternFromInput(cleaned)

    if (pendingProfileRef.current && isAffirmative(cleaned)) {
      completeOnboarding(pendingProfileRef.current)
      return
    }

    if (checkInRef.current.draft || /weigh in|weigh-in|check in|check-in/i.test(cleaned)) {
      advanceCheckIn(cleaned)
      return
    }

    if (!isProfileComplete(profileRef.current ?? EMPTY_PROFILE) || !onboardingComplete) {
      const current = profileRef.current ?? EMPTY_PROFILE
      const step = getOnboardingStep(current)
      const nextProfile = applyOnboardingAnswer(step, cleaned, current)
      if (getOnboardingStep(nextProfile) === "done") {
        const resolved = { ...nextProfile, country: nextProfile.country || inferCountryFromBrowser() || "UK" }
        setPendingProfile(resolved)
        pushAssistantMessage(`I’ve got your details. Confirm these and I’ll lock your targets in: ${resolved.name}, ${resolved.goal}, ${resolved.sex}, ${resolved.age}, ${resolved.heightCm}cm, ${resolved.weightKg}kg, ${resolved.activityLevel}, ${resolved.planStyle}.`)
        return
      }
      startOnboardingFollowUp(nextProfile)
      return
    }

    if (handleProfileUpdates(cleaned)) return

    if (/meal plan|full day|what should i eat|build me a plan|food plan|day of eating|swap|breakfast|lunch|dinner|snack/i.test(cleaned)) {
      pendingArtifactRef.current = "meal_plan"
    } else if (/workout|session|train|gym|home workout|boxing|run/i.test(cleaned)) {
      pendingArtifactRef.current = "workout"
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
      case "conversation.item.created":
        if (event?.item?.role === "user") {
          const textBits = Array.isArray(event.item?.content)
            ? event.item.content.filter((c: any) => c?.type === "input_text" && typeof c?.text === "string").map((c: any) => c.text)
            : []
          if (textBits.length) addUserTranscript(textBits.join(" ").trim())
        }
        break
      case "error":
        setError(event?.error?.message || "George hit a voice error.")
        setStatusText("There was a connection problem")
        break
      default:
        break
    }
  }

  async function cleanupConversation() {
    try { dcRef.current?.close() } catch {}
    try { pcRef.current?.close() } catch {}
    try { audioRef.current?.pause() } catch {}
    try { localStreamRef.current?.getTracks().forEach((track) => track.stop()) } catch {}
    dcRef.current = null
    pcRef.current = null
    audioRef.current = null
    localStreamRef.current = null
    currentAssistantTextRef.current = ""
    currentAssistantMessageIdRef.current = null
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
      ;(audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true
      audioRef.current = audio
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0]
        void audio.play().catch(() => {})
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 } as MediaTrackConstraints,
      })
      localStreamRef.current = stream
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      const dc = pc.createDataChannel("oai-events")
      dcRef.current = dc
      dc.addEventListener("open", () => {
        setConnectionState("connected")
        setStatusText("Listening…")
        dc.send(JSON.stringify({ type: "session.update", session: { input_audio_transcription: { model: "gpt-4o-mini-transcribe" } } }))
        window.setTimeout(() => {
          dc.send(JSON.stringify(buildFirstResponseEvent(profileRef.current, targetsRef.current, checkInRef.current)))
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
    if (actionKey === "build_plan") pendingArtifactRef.current = "meal_plan"
    if (actionKey === "workout") pendingArtifactRef.current = "workout"
    const prompt = buildQuickPrompt(actionKey, profileRef.current, targetsRef.current, checkInRef.current)
    if (connectionState === "connected") {
      sendTextPrompt(prompt)
      return
    }
    queuedPromptRef.current = prompt
    void startConversation()
  }

  function handleStartCheckIn() {
    const next = startCheckInDraft(checkInRef.current)
    setCheckIn(next)
    const prompt = nextCheckInInstruction("weight")
    if (connectionState === "connected") {
      sendDataChannelInstructions(prompt)
      return
    }
    queuedPromptRef.current = prompt
    void startConversation()
  }

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

        <div className="mt-5 text-center text-sm leading-6 text-slate-300">{buildCoachGreeting()}</div>

        {!targets ? (
          <div className="mt-5 rounded-[1.6rem] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(8,20,31,.92),rgba(3,7,18,.98))] p-5 shadow-[0_18px_55px_rgba(0,0,0,.28)]">
            <div className="text-[10px] uppercase tracking-[0.34em] text-cyan-300/70">Setup</div>
            <div className="mt-2 text-lg font-semibold text-white">Let’s get your coaching profile sorted</div>
            <div className="mt-3 text-sm leading-6 text-slate-300">Tell George your stats and what you want help with. Once setup is complete, your targets and current weight will stay visible here.</div>
          </div>
        ) : null}

        {targets ? (
          <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.92),rgba(3,7,18,.98))] p-4 shadow-[0_18px_55px_rgba(0,0,0,.28)]">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.34em] text-slate-500">Your targets</div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Current weight {profile?.weightKg ? `${profile.weightKg}kg` : "—"}</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: "Protein", value: `${targets.protein}g`, valueClass: "text-cyan-300" },
                { label: "Carbs", value: `${targets.carbs}g`, valueClass: "text-blue-300" },
                { label: "Fats", value: `${targets.fats}g`, valueClass: "text-orange-300" },
                { label: "Calories", value: `${targets.calories}`, valueClass: "text-white" },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.26em] text-slate-500">{item.label}</div>
                  <div className={`mt-3 text-[34px] font-semibold leading-none ${item.valueClass}`}>{item.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
              <span className="text-slate-500">Plan style:</span> <span className="ml-2 text-white capitalize">{profile?.planStyle ?? "balanced"}</span>
            </div>
          </div>
        ) : null}

        {pendingProfile ? (
          <div className="mt-4 rounded-[1.4rem] border border-cyan-300/20 bg-[linear-gradient(180deg,rgba(8,20,31,.96),rgba(3,7,18,.98))] px-4 py-4 shadow-[0_18px_46px_rgba(0,0,0,.24)]">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-300/70">Confirm details</div>
              <div className="mt-2 text-base font-medium text-white">Create your saved targets</div>
              <div className="mt-3 text-sm text-slate-300">
                {pendingProfile.name}, {pendingProfile.goal}, {pendingProfile.sex}, {pendingProfile.age}, {pendingProfile.heightCm}cm, {pendingProfile.weightKg}kg, {pendingProfile.activityLevel}, {pendingProfile.planStyle}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button type="button" onClick={() => completeOnboarding(pendingProfile)} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100 transition hover:bg-cyan-400/15">Confirm details</button>
                <button type="button" onClick={() => setPendingProfile(null)} className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300 transition hover:bg-white/5">Keep talking</button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.92),rgba(3,7,18,.98))] p-4 shadow-[0_18px_55px_rgba(0,0,0,.28)]">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.34em] text-slate-500"><UtensilsCrossed className="h-4 w-4" /> Current meal plan</div>
          {activeMealPlan ? (
            <>
              <div className="mt-3 text-lg font-semibold text-white">{activeMealPlan.title}</div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                {renderLines(activeMealPlan.body).map((line, index) => <div key={`${activeMealPlan.id}-${index}`}>{line}</div>)}
              </div>
            </>
          ) : (
            <div className="mt-3 text-sm leading-6 text-slate-300">No meal plan saved yet — ask George to build you a full day, swap a meal, or sort a snack.</div>
          )}
        </div>

        <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.92),rgba(3,7,18,.98))] p-4 shadow-[0_18px_55px_rgba(0,0,0,.28)]">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.34em] text-slate-500"><Dumbbell className="h-4 w-4" /> Current workout</div>
          {activeWorkoutPlan ? (
            <>
              <div className="mt-3 text-lg font-semibold text-white">{activeWorkoutPlan.title}</div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                {renderLines(activeWorkoutPlan.body).map((line, index) => <div key={`${activeWorkoutPlan.id}-${index}`}>{line}</div>)}
              </div>
            </>
          ) : (
            <div className="mt-3 text-sm leading-6 text-slate-300">No workout saved yet — ask George for a gym session, home workout, boxing session, or quick conditioning block.</div>
          )}
        </div>

        {targets ? (
          <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.92),rgba(3,7,18,.98))] p-4 shadow-[0_18px_55px_rgba(0,0,0,.28)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.34em] text-slate-500"><CalendarClock className="h-4 w-4" /> Weekly check-in</div>
              <div className={`text-[10px] uppercase tracking-[0.3em] ${checkIn.status === "overdue" ? "text-amber-300" : checkIn.status === "due" ? "text-cyan-300" : "text-slate-500"}`}>{relativeCheckInLabel(checkIn)}</div>
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-300">Keep your weight and weekly feedback current so George can adjust your targets and plans when needed.</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={handleStartCheckIn} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-white/10">Start check-in</button>
            </div>
          </div>
        ) : null}

        <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.92),rgba(3,7,18,.98))] p-4 shadow-[0_18px_55px_rgba(0,0,0,.28)]">
          <div className="text-[10px] uppercase tracking-[0.34em] text-slate-500">Try asking George</div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {[
              { key: "build_plan", label: "Build me a plan" },
              { key: "what_eat", label: "What should I eat today?" },
              { key: "off_track", label: "I went off track" },
              { key: "workout", label: "Give me a workout" },
            ].map((action) => (
              <button key={action.key} type="button" onClick={() => handleQuickAction(action.key as QuickActionKey)} className="rounded-[1.1rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/[0.05]">
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {patterns.items.length ? (
          <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.92),rgba(3,7,18,.98))] p-4 shadow-[0_18px_55px_rgba(0,0,0,.28)]">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.34em] text-slate-500"><Target className="h-4 w-4" /> Coaching memory</div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
              {patterns.items.slice(-3).map((item, index) => <div key={`${item}-${index}`} className="flex items-start gap-2"><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-500" /> <span>{item}</span></div>)}
            </div>
          </div>
        ) : null}

        <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,31,.92),rgba(3,7,18,.98))] p-4 shadow-[0_18px_55px_rgba(0,0,0,.28)]">
          <div className="text-[10px] uppercase tracking-[0.34em] text-slate-500">Latest from George</div>
          <div className="mt-3 text-sm leading-6 text-slate-300">{latestAssistantMessage}</div>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-4 text-sm leading-6 text-rose-200">{error}</div> : null}
        {connectionState === "connected" ? <div className="mt-5 flex justify-center"><button type="button" onClick={stopConversation} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-95"><PhoneOff className="h-4 w-4" /> End conversation</button></div> : null}
      </div>
    </div>
  )
}
