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
type PlanStyle = "performance" | "balanced" | "flexible"
type MealCount = 3 | 4 | 5 | 6

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
  planStyle?: PlanStyle
  mealCount?: MealCount
}

type LoggedMeal = {
  id: string
  text: string
  calories: number
  protein: number
  carbs: number
  fat: number
  countedAsMeal: boolean
  createdAt: string
}

type PendingDelete = {
  mealId: string
  text: string
  calories: number
  protein: number
  carbs: number
  fat: number
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

type StoredAppState = {
  messages: LiveMessage[]
  profile: CoachProfile
  stats: CoachStats
  pendingEstimate: MacroEstimate | null
  pendingMealText: string | null
  pendingTargets: CoachStats | null
  loggedMeals: LoggedMeal[]
  pendingDelete: PendingDelete | null
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
const APP_STATE_KEY = "coach-george-app-state-v1"
const CURRENT_MEAL_PLAN_KEY = "coach-george-current-meal-plan-v1"
const CURRENT_WORKOUT_KEY = "coach-george-current-workout-v1"

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

function buildStoredAppState(args: Partial<StoredAppState>): StoredAppState {
  return {
    messages: Array.isArray(args.messages) ? args.messages : [],
    profile: { ...EMPTY_PROFILE, ...(args.profile || {}) },
    stats: { ...DEFAULT_STATS, ...(args.stats || {}) },
    pendingEstimate: args.pendingEstimate ?? null,
    pendingMealText: args.pendingMealText ?? null,
    pendingTargets: args.pendingTargets ? { ...DEFAULT_STATS, ...args.pendingTargets } : null,
    loggedMeals: Array.isArray(args.loggedMeals) ? args.loggedMeals : [],
    pendingDelete: args.pendingDelete ?? null,
  }
}

function loadStoredAppState(): StoredAppState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(APP_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    return buildStoredAppState(parsed)
  } catch {
    return null
  }
}

function saveStoredAppState(args: Partial<StoredAppState>) {
  if (typeof window === "undefined") return
  try {
    const current = loadStoredAppState() || buildStoredAppState({})
    const next = buildStoredAppState({
      ...current,
      ...args,
      profile: { ...current.profile, ...(args.profile || {}) },
      stats: { ...current.stats, ...(args.stats || {}) },
    })
    window.localStorage.setItem(APP_STATE_KEY, JSON.stringify(next))
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: next.messages.slice(-20) }))
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next.profile || {}))
    window.localStorage.setItem(STATS_KEY, JSON.stringify(next.stats || DEFAULT_STATS))
  } catch {}
}

function loadBrowserJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function saveBrowserJson(key: string, value: unknown) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

const QUICK_ACTIONS: Array<{ key: QuickActionKey; label: string; accent: string; icon: any }> = [
  { key: "log_meal", label: "Build me a plan", accent: "from-sky-400/30 to-sky-600/5", icon: UtensilsCrossed },
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
    profile?.name && profile?.goal && profile?.sex && profile?.age && profile?.heightCm && profile?.weightKg && profile?.activityLevel && profile?.country &&
      profile?.allergies !== undefined && profile?.dislikes !== undefined && stats.caloriesTarget > 0 && stats.proteinTarget > 0 && stats.carbsTarget > 0 && stats.fatTarget > 0
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

function parseName(input: string): string | null {
  const trimmed = input.trim()
  const direct = trimmed.match(/(?:my name is|i(?:'|’)m|i am|call me)\s+([A-Za-z][A-Za-z'’-]{1,20})/i)
  if (direct) return direct[1].replace(/^[a-z]/, (s) => s.toUpperCase())
  const plain = trimmed.match(/^([A-Za-z][A-Za-z'’-]{1,20})$/)
  if (plain) return plain[1].replace(/^[a-z]/, (s) => s.toUpperCase())
  return null
}

function normaliseMealText(input: string) {
  return input
    .replace(/^(can i )?(please )?(log|add|save)\s+(a\s+)?meal[:,]?\s*/i, "")
    .replace(/^(i\s+had|i\s+ate|i'?ve had|for breakfast i had|for lunch i had|for dinner i had)\s+/i, "")
    .replace(/^(delete|remove|take off)\s+/i, "")
    .trim()
}

function titleMealText(input: string) {
  const cleaned = normaliseMealText(input).replace(/[.?!]$/, "").trim()
  if (!cleaned) return "Meal"
  return cleaned.replace(/\b\w/g, (s) => s.toUpperCase())
}

function looksLikeFoodInput(input: string) {
  const t = input.toLowerCase()
  if (/^(yes|yeah|yep|no|nope|cancel|stop|keep|delete)$/i.test(t.trim())) return false
  return /\b(i had|i ate|for breakfast|for lunch|for dinner|meal|snack|protein shake|banana|sandwich|wrap|burger|pizza|pasta|rice|chicken|salmon|steak|yoghurt|yogurt|big mac|mcdonald|kfc|greggs|curry|chips|fries|toast|eggs|apple|fruit|bar|crisps|biscuit|cookie|bagel|oats|porridge|tuna|shake|smoothie)\b/i.test(t)
}

function parseDeleteIntent(input: string) {
  const trimmed = input.trim()
  if (/^(delete|remove|take off|take away)\s+(that|it|last one|last meal)$/i.test(trimmed)) return "__LAST__"
  const m = trimmed.match(/(?:delete|remove|take off|take away)\s+(?:the\s+)?(.+)/i)
  return m ? titleMealText(m[1]) : null
}




function parseAllergyAnswer(input: string): string[] {
  const t = input.toLowerCase().trim()
  if (/^(none|no|nothing|nope|nil)$/.test(t) || /\b(no allergies|no allergy)\b/.test(t)) return []
  const cleaned = t
    .replace(/allerg(?:y|ies)\s*(?:to)?/g, ' ')
    .replace(/i(?:'|’)m allergic to/g, ' ')
    .replace(/i am allergic to/g, ' ')
    .replace(/avoid/g, ' ')
  return parseListField(cleaned)
}

function parseDislikeAnswer(input: string): string[] {
  const t = input.toLowerCase().trim()
  if (/^(none|no|nothing|nope|nil)$/.test(t) || /\b(nothing really|anything is fine|all good)\b/.test(t)) return []
  const cleaned = t
    .replace(/.*don't like\s*/,'')
    .replace(/.*do not like\s*/,'')
    .replace(/.*dislike\s*/,'')
    .replace(/.*hate\s*/,'')
    .replace(/.*won'?t eat\s*/,'')
    .replace(/foods?\s*(?:to avoid)?/g,' ')
  return parseListField(cleaned)
}

function applyStepAnswer(step: string, input: string, prevProfile: CoachProfile): CoachProfile {
  const next = { ...prevProfile }
  switch (step) {
    case 'name': {
      const name = parseName(input)
      if (name) next.name = name
      break
    }
    case 'goal': {
      const goal = parseGoal(input)
      if (goal) next.goal = goal
      break
    }
    case 'sex': {
      const sex = parseSex(input)
      if (sex) next.sex = sex
      break
    }
    case 'age': {
      const age = parseAge(input)
      if (age) next.age = age
      break
    }
    case 'height': {
      const h = parseHeightCm(input)
      if (h) next.heightCm = h
      break
    }
    case 'weight': {
      const w = parseWeightKg(input)
      if (w) next.weightKg = w
      break
    }
    case 'activity': {
      const a = parseActivity(input)
      if (a) next.activityLevel = a
      break
    }
    case 'allergies': {
      next.allergies = parseAllergyAnswer(input)
      break
    }
    case 'dislikes': {
      next.dislikes = parseDislikeAnswer(input)
      break
    }
    case 'country': {
      const c = parseCountry(input) || inferCountryFromBrowser() || undefined
      if (c) next.country = c
      break
    }
  }
  return next
}
function parseListField(input: string) {
  return input
    .split(/,| and /i)
    .map(v => v.trim())
    .filter(Boolean)
}

function parseAllergies(input: string): string[] | null {
  const t = input.toLowerCase()
  if (!t.includes('allerg')) return null
  if (/(none|no allergies|no allergy)/.test(t)) return []
  const cleaned = t.replace(/.*allerg(?:y|ies)\s*(?:to)?\s*/,'').replace(/[:.]/g,' ')
  const vals = parseListField(cleaned)
  return vals.length ? vals : []
}

function parseDislikes(input: string): string[] | null {
  const t = input.toLowerCase()
  if (!(t.includes("don't like") || t.includes('do not like') || t.includes('hate') || t.includes('dislike') || t.includes("won't eat") || t.includes('wont eat'))) return null
  if (/(nothing|none)/.test(t)) return []
  let cleaned = t
    .replace(/.*don't like\s*/,'')
    .replace(/.*do not like\s*/,'')
    .replace(/.*dislike\s*/,'')
    .replace(/.*hate\s*/,'')
    .replace(/.*won'?t eat\s*/,'')
  const vals = parseListField(cleaned)
  return vals.length ? vals : []
}

function isConfirmIntent(input: string) {
  const t = input.toLowerCase().trim()
  return /(yes|yeah|yep|please do|go on then|log it|log that|save that|save it|yes log it|yes log that|log meal)/.test(t)
}

function isLogIntent(input: string) {
  const t = input.toLowerCase()
  return /\blog meal\b|\badd meal\b|\bsave meal\b/.test(t)
}
function mergeProfileFromInput(input: string, prevProfile: CoachProfile): { profile: CoachProfile; complete: boolean } {
  const next = { ...prevProfile }
  const name = parseName(input)
  const goal = parseGoal(input)
  const sex = parseSex(input)
  const age = parseAge(input)
  const heightCm = parseHeightCm(input)
  const weightKg = parseWeightKg(input)
  const activityLevel = parseActivity(input)
  const country = parseCountry(input)
  const allergies = parseAllergies(input)
  const dislikes = parseDislikes(input)
  if (goal) next.goal = goal
  if (sex) next.sex = sex
  if (age) next.age = age
  if (heightCm) next.heightCm = heightCm
  if (weightKg) next.weightKg = weightKg
  if (activityLevel) next.activityLevel = activityLevel
  if (country) next.country = country
  if (allergies) next.allergies = allergies
  if (dislikes) next.dislikes = dislikes
  if (!next.country) next.country = inferCountryFromBrowser() || undefined
  return { profile: next, complete: Boolean(next.name && next.goal && next.sex && next.age && next.heightCm && next.weightKg && next.activityLevel && next.country && next.allergies !== undefined && next.dislikes !== undefined) }
}

function getOnboardingStep(profile: CoachProfile | null, stats: CoachStats) {
  if (!profile?.name) return "name"
  if (!profile?.goal) return "goal"
  if (!profile?.sex) return "sex"
  if (!profile?.age) return "age"
  if (!profile?.heightCm) return "height"
  if (!profile?.weightKg) return "weight"
  if (!profile?.activityLevel) return "activity"
  if (profile?.allergies === undefined) return "allergies"
  if (profile?.dislikes === undefined) return "dislikes"
  if (!profile?.country) return "country"
  if (!(stats.caloriesTarget > 0 && stats.proteinTarget > 0)) return "country"
  return "done"
}

function nextOnboardingInstruction(step: string) {
  switch (step) {
    case "name": return "Start setup. Ask only this: what’s your first name?"
    case "goal": return "Good. Now ask only this: what’s your main goal right now — lose fat, maintain, or gain muscle?"
    case "sex": return "Good. Now ask only this: are you male or female?"
    case "age": return "Now ask only this: how old are you?"
    case "height": return "Now ask only this: what’s your height? Accept cm or feet and inches."
    case "weight": return "Now ask only this: what’s your current weight? Accept kg, lb, or stone."
    case "activity": return "Now ask only this: how active are you day to day — sedentary, lightly active, moderately active, or very active?"
    case "allergies": return "Now ask only this: do you have any allergies or foods you need me to avoid? If none, say none."
    case "dislikes": return "Now ask only this: are there any foods you do not like or do not want in your plans? If none, say none."
    case "country": return "Now ask only this: are you in the UK or the US?"
    default: return "Setup is complete. Briefly confirm their calories and protein targets, then ask what they want help with right now."
  }
}

function profileContext(profile: CoachProfile | null, stats: CoachStats) {
  if (!isProfileComplete(profile, stats)) {
    return `This user is not set up yet. You must onboard them first. Ask one question at a time and collect: first name, goal, sex, age, height, weight, activity level, allergies, disliked foods, then country. Once complete, explain that their calories, protein, carbs and fats are set and you’ll guide the rest. Do not skip setup.`
  }
  return `Saved profile:\n- name: ${profile!.name}\n- country: ${profile!.country}\n- sex: ${profile!.sex}\n- age: ${profile!.age}\n- height: ${profile!.heightCm} cm\n- weight: ${profile!.weightKg} kg\n- activity: ${profile!.activityLevel}\n- goal: ${profile!.goal}\n- calorie target: ${stats.caloriesTarget}\n- protein target: ${stats.proteinTarget}\n- carbs target: ${stats.carbsTarget}\n- fat target: ${stats.fatTarget}\n- calories left right now: ${caloriesLeft(stats)}\n- protein left right now: ${proteinLeft(stats)}\n- carbs left right now: ${carbsLeft(stats)}\n- fat left right now: ${fatLeft(stats)}\n- meals logged today: ${stats.mealsToday}\n- streak: ${stats.streak}\nUse this automatically. Do not ask for stats again unless the user says they’ve changed.`
}

function buildFirstResponseEvent(profile: CoachProfile | null, stats: CoachStats) {
  const complete = isProfileComplete(profile, stats)
  const instructions = complete
    ? `${profileContext(profile, stats)}\n\nGreet them like a returning user by first name in one short line. Then ask what they want help with right now.`
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
  const original = normaliseMealText(input)
  const t = original.toLowerCase()
  if (!t) return null

  const specificItems: Array<{ keywords: string[]; calories: number; protein: number; carbs: number; fat: number; meal?: boolean }> = [
    { keywords: ["big mac"], calories: 550, protein: 26, carbs: 45, fat: 30, meal: true },
    { keywords: ["banana"], calories: 105, protein: 1, carbs: 27, fat: 0 },
    { keywords: ["apple"], calories: 95, protein: 0, carbs: 25, fat: 0 },
    { keywords: ["tuna sandwich"], calories: 420, protein: 28, carbs: 38, fat: 16, meal: true },
    { keywords: ["tuna pasta"], calories: 560, protein: 34, carbs: 56, fat: 20, meal: true },
    { keywords: ["pasta"], calories: 520, protein: 18, carbs: 78, fat: 14, meal: true },
    { keywords: ["curry"], calories: 680, protein: 30, carbs: 62, fat: 32, meal: true },
    { keywords: ["chips", "fries"], calories: 365, protein: 4, carbs: 48, fat: 17, meal: true },
    { keywords: ["crisps"], calories: 170, protein: 2, carbs: 15, fat: 11 },
    { keywords: ["biscuit", "cookie"], calories: 160, protein: 2, carbs: 20, fat: 7 },
    { keywords: ["protein bar"], calories: 220, protein: 20, carbs: 20, fat: 7 },
    { keywords: ["smoothie"], calories: 220, protein: 6, carbs: 38, fat: 4 },
  ]
  const source = [...specificItems, ...FOOD_LIBRARY]
  const matched = source.filter((item) => item.keywords.some((k) => t.includes(k)))
  const seen = new Set<string>()
  const unique = matched.filter((item) => {
    const key = item.keywords[0]
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  let multiplier = 1
  const scoopMatch = t.match(/(\d+)\s*scoops?/) || t.match(/(\d+)x\s*(?:protein|shake|whey)/)
  const countMatch = t.match(/\b(\d+)\s+(?:bananas?|apples?|sandwiches?|wraps?|burgers?|slices?|bars?)\b/)
  if (scoopMatch && t.includes("protein")) multiplier = Math.max(multiplier, Number(scoopMatch[1]))
  if (countMatch) multiplier = Math.max(multiplier, Number(countMatch[1]))
  if (t.includes("large") || t.includes("big")) multiplier *= 1.2
  if (t.includes("small") || t.includes("light")) multiplier *= 0.85
  if (t.includes("double")) multiplier *= 1.8

  if (unique.length) {
    const total = unique.reduce((acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
      countedAsMeal: acc.countedAsMeal || !!item.meal,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, countedAsMeal: false })
    const hasMealWord = /breakfast|lunch|dinner|meal|sandwich|wrap|bagel|burger|pasta|curry/.test(t)
    const countedAsMeal = total.countedAsMeal || hasMealWord || unique.length > 1 || total.calories * multiplier >= 250
    return {
      calories: Math.round(total.calories * multiplier),
      protein: Math.round(total.protein * multiplier),
      carbs: Math.round(total.carbs * multiplier),
      fat: Math.round(total.fat * multiplier),
      countedAsMeal,
    }
  }

  if (!looksLikeFoodInput(input)) return null

  const words = t.split(/\s+/).filter(Boolean).length
  const mealLike = /sandwich|wrap|burger|pizza|pasta|rice|curry|breakfast|lunch|dinner|meal|takeaway|mcdonald|kfc|greggs/.test(t)
  if (mealLike) {
    return { calories: 550, protein: 28, carbs: 55, fat: 22, countedAsMeal: true }
  }
  if (words <= 3) {
    return { calories: 180, protein: 4, carbs: 24, fat: 6, countedAsMeal: false }
  }
  return { calories: 350, protein: 18, carbs: 32, fat: 14, countedAsMeal: true }
}


function parseTargetsFromAssistantText(input: string) {
  const t = input.toLowerCase()
  const cal = t.match(/([\d,]{3,5})\s*(?:kcal|calories?)/)
  const protein = t.match(/([\d,]{2,4})\s*(?:g|grams?)\s*(?:of\s*)?protein/)
  const carbs = t.match(/([\d,]{2,4})\s*(?:g|grams?)\s*(?:of\s*)?carbs?/)
  const fat = t.match(/([\d,]{2,4})\s*(?:g|grams?)\s*(?:of\s*)?(?:fat|fats)/)
  const toNum = (v?: string | null) => (v ? Number(v.replace(/,/g, "")) : null)
  return {
    caloriesTarget: toNum(cal?.[1]),
    proteinTarget: toNum(protein?.[1]),
    carbsTarget: toNum(carbs?.[1]),
    fatTarget: toNum(fat?.[1]),
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
  const [pendingEstimate, setPendingEstimate] = useState<MacroEstimate | null>(null)
  const [pendingMealText, setPendingMealText] = useState<string | null>(null)
  const [pendingTargets, setPendingTargets] = useState<CoachStats | null>(null)
  const [loggedMeals, setLoggedMeals] = useState<LoggedMeal[]>([])
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [currentMealPlan, setCurrentMealPlan] = useState<string>("")
  const [currentWorkout, setCurrentWorkout] = useState<string>("")
  const [setupDraft, setSetupDraft] = useState<{
    name: string
    age: string
    sex: Sex
    heightCm: string
    weightKg: string
    activityLevel: ActivityLevel
    goal: Goal
    planStyle: PlanStyle
    mealCount: MealCount
    allergies: string
    dislikes: string
  }>({
    name: "",
    age: "",
    sex: "male",
    heightCm: "",
    weightKg: "",
    activityLevel: "moderately active",
    goal: "lose fat",
    planStyle: "balanced",
    mealCount: 4,
    allergies: "",
    dislikes: "",
  })

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
  const pendingEstimateRef = useRef<MacroEstimate | null>(null)
  const pendingMealTextRef = useRef<string | null>(null)
  const pendingTargetsRef = useRef<CoachStats | null>(null)
  const loggedMealsRef = useRef<LoggedMeal[]>([])
  const pendingDeleteRef = useRef<PendingDelete | null>(null)
  const onboardingStepRef = useRef<string>("name")

  useEffect(() => { statsRef.current = stats }, [stats])
  useEffect(() => { profileRef.current = profile }, [profile])
  useEffect(() => { loggedMealsRef.current = loggedMeals }, [loggedMeals])
  useEffect(() => { pendingDeleteRef.current = pendingDelete }, [pendingDelete])
  useEffect(() => { onboardingStepRef.current = getOnboardingStep(profile ?? EMPTY_PROFILE, stats) }, [profile, stats])

  const effectiveStats = useMemo(() => {
    if (stats.caloriesTarget > 0 && stats.proteinTarget > 0 && stats.carbsTarget > 0 && stats.fatTarget > 0) return stats
    if (profile?.goal && profile?.sex && profile?.age && profile?.heightCm && profile?.weightKg && profile?.activityLevel) {
      return { ...stats, ...calculateTargets(profile) }
    }
    return stats
  }, [profile, stats])
  const profileReady = isProfileComplete(profile, effectiveStats)
  const pie = pieSegments(effectiveStats)
  const macroPct = macroPercentages(effectiveStats)
  const latestAssistantMessage = useMemo(() => [...messages].reverse().find(m => m.role === "assistant")?.content || buildCoachGuidance(profile, effectiveStats), [messages, profile, effectiveStats])
  const latestMeals = useMemo(() => [...loggedMeals].slice(-4).reverse(), [loggedMeals])
  const macroBars = [
    { label: "Protein", used: effectiveStats.proteinUsed, target: effectiveStats.proteinTarget, color: "from-cyan-300 to-cyan-500" },
    { label: "Carbs", used: effectiveStats.carbsUsed, target: effectiveStats.carbsTarget, color: "from-blue-400 to-blue-600" },
    { label: "Fats", used: effectiveStats.fatUsed, target: effectiveStats.fatTarget, color: "from-amber-300 to-orange-500" },
  ]

  useEffect(() => {
    const stored = loadStoredAppState()
    if (stored) {
      if (stored.messages?.length) setMessages(stored.messages)
      const nextProfile = { ...EMPTY_PROFILE, ...(stored.profile || {}) }
      if (Object.keys(nextProfile).length) {
        const withCountry = { ...nextProfile, country: nextProfile.country || inferCountryFromBrowser() || undefined }
        setProfile(withCountry)
        onboardingProfileRef.current = withCountry
      }
      const normalizedStats = normalizeStatsForToday({ ...DEFAULT_STATS, ...(stored.stats || {}), timezone: stored.stats?.timezone || getBrowserTimeZone() })
      setStats(normalizedStats)
      if (stored.pendingEstimate) {
        setPendingEstimate(stored.pendingEstimate)
        pendingEstimateRef.current = stored.pendingEstimate
      }
      if (stored.pendingMealText) {
        setPendingMealText(stored.pendingMealText)
        pendingMealTextRef.current = stored.pendingMealText
      }
      if (stored.pendingTargets) {
        setPendingTargets(stored.pendingTargets)
        pendingTargetsRef.current = stored.pendingTargets
      }
      if (stored.loggedMeals?.length) {
        setLoggedMeals(stored.loggedMeals)
        loggedMealsRef.current = stored.loggedMeals
      }
      if (stored.pendingDelete) {
        setPendingDelete(stored.pendingDelete)
        pendingDeleteRef.current = stored.pendingDelete
      }
      return
    }
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

  useEffect(() => {
    saveStoredAppState({
      messages: messages.slice(-20),
      profile: profile ?? EMPTY_PROFILE,
      stats,
      pendingEstimate,
      pendingMealText,
      pendingTargets,
      loggedMeals,
      pendingDelete,
    })
  }, [messages, profile, stats, pendingEstimate, pendingMealText, pendingTargets, loggedMeals, pendingDelete])

  useEffect(() => {
    if (!profile) return
    if (!(profile.goal && profile.sex && profile.age && profile.heightCm && profile.weightKg && profile.activityLevel)) return
    if (stats.caloriesTarget > 0 && stats.proteinTarget > 0 && stats.carbsTarget > 0 && stats.fatTarget > 0) return
    if (pendingTargetsRef.current) return
    const targets = calculateTargets(profile)
    const draft = { ...normalizeStatsForToday(stats), ...targets }
    showPendingTargets(draft)
  }, [profile, stats.caloriesTarget, stats.proteinTarget, stats.carbsTarget, stats.fatTarget])

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

  useEffect(() => {
    const savedMealPlan = loadBrowserJson<string>(CURRENT_MEAL_PLAN_KEY, "")
    const savedWorkout = loadBrowserJson<string>(CURRENT_WORKOUT_KEY, "")
    if (savedMealPlan) setCurrentMealPlan(savedMealPlan)
    if (savedWorkout) setCurrentWorkout(savedWorkout)
  }, [])

  useEffect(() => {
    saveBrowserJson(CURRENT_MEAL_PLAN_KEY, currentMealPlan)
  }, [currentMealPlan])

  useEffect(() => {
    saveBrowserJson(CURRENT_WORKOUT_KEY, currentWorkout)
  }, [currentWorkout])

  useEffect(() => {
    if (!profile) return
    setSetupDraft((prev) => ({
      ...prev,
      name: profile.name || prev.name,
      age: profile.age ? String(profile.age) : prev.age,
      sex: profile.sex || prev.sex,
      heightCm: profile.heightCm ? String(profile.heightCm) : prev.heightCm,
      weightKg: profile.weightKg ? String(profile.weightKg) : prev.weightKg,
      activityLevel: profile.activityLevel || prev.activityLevel,
      goal: profile.goal || prev.goal,
      planStyle: profile.planStyle || prev.planStyle,
      mealCount: profile.mealCount || prev.mealCount,
      allergies: Array.isArray(profile.allergies) ? profile.allergies.join(', ') : prev.allergies,
      dislikes: Array.isArray(profile.dislikes) ? profile.dislikes.join(', ') : prev.dislikes,
    }))
  }, [profile])


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

  function showPendingTargets(targets: CoachStats) {
    pendingTargetsRef.current = targets
    setPendingTargets(targets)
    saveStoredAppState({ profile: profileRef.current ?? EMPTY_PROFILE, stats: statsRef.current, pendingTargets: targets })
  }

  function clearPendingTargets() {
    pendingTargetsRef.current = null
    setPendingTargets(null)
    saveStoredAppState({ profile: profileRef.current ?? EMPTY_PROFILE, stats: statsRef.current, pendingTargets: null })
  }

  function applyTargets(nextTargets: CoachStats) {
    const updated = markUsage(normalizeStatsForToday({
      ...statsRef.current,
      caloriesTarget: nextTargets.caloriesTarget,
      proteinTarget: nextTargets.proteinTarget,
      carbsTarget: nextTargets.carbsTarget,
      fatTarget: nextTargets.fatTarget,
    }))
    setStats(updated)
    clearPendingTargets()
    saveStoredAppState({ profile: profileRef.current ?? EMPTY_PROFILE, stats: updated, pendingTargets: null })
    pushAssistantMessage(`Targets saved. You’re set for ${updated.caloriesTarget} calories, ${updated.proteinTarget}g protein, ${updated.carbsTarget}g carbs and ${updated.fatTarget}g fat today.`)
  }

  function saveSetupProfile() {
    const nextProfile: CoachProfile = {
      ...profileRef.current,
      name: setupDraft.name.trim() || undefined,
      age: setupDraft.age ? Number(setupDraft.age) : undefined,
      sex: setupDraft.sex,
      heightCm: setupDraft.heightCm ? Number(setupDraft.heightCm) : undefined,
      weightKg: setupDraft.weightKg ? Number(setupDraft.weightKg) : undefined,
      activityLevel: setupDraft.activityLevel,
      goal: setupDraft.goal,
      planStyle: setupDraft.planStyle,
      mealCount: setupDraft.mealCount,
      allergies: setupDraft.allergies.trim() ? setupDraft.allergies.split(',').map(v => v.trim()).filter(Boolean) : [],
      dislikes: setupDraft.dislikes.trim() ? setupDraft.dislikes.split(',').map(v => v.trim()).filter(Boolean) : [],
      country: profileRef.current?.country || inferCountryFromBrowser() || undefined,
    }

    if (!(nextProfile.name && nextProfile.age && nextProfile.sex && nextProfile.heightCm && nextProfile.weightKg && nextProfile.activityLevel && nextProfile.goal)) {
      pushAssistantMessage('Please fill in your name, age, sex, height, weight, activity level and goal, then tap Save and calculate.')
      return
    }

    const targets = calculateTargets(nextProfile)
    const updatedStats = markUsage(normalizeStatsForToday({
      ...statsRef.current,
      caloriesTarget: targets.caloriesTarget,
      proteinTarget: targets.proteinTarget,
      carbsTarget: targets.carbsTarget,
      fatTarget: targets.fatTarget,
      caloriesUsed: 0,
      proteinUsed: 0,
      carbsUsed: 0,
      fatUsed: 0,
      mealsToday: 0,
    }))

    setProfile(nextProfile)
    onboardingProfileRef.current = nextProfile
    profileRef.current = nextProfile
    setStats(updatedStats)
    statsRef.current = updatedStats
    pendingTargetsRef.current = null
    setPendingTargets(null)
    saveStoredAppState({ profile: nextProfile, stats: updatedStats, pendingTargets: null, messages: [...messages.slice(-19), makeMessage('assistant', `Profile saved. You are set to ${updatedStats.caloriesTarget} calories, ${updatedStats.proteinTarget}g protein, ${updatedStats.carbsTarget}g carbs and ${updatedStats.fatTarget}g fat. You told me you want ${nextProfile.mealCount} meals a day on a ${nextProfile.planStyle} plan.`)] })
    pushAssistantMessage(`Profile saved. You are set to ${updatedStats.caloriesTarget} calories, ${updatedStats.proteinTarget}g protein, ${updatedStats.carbsTarget}g carbs and ${updatedStats.fatTarget}g fat. You told me you want ${nextProfile.mealCount} meals a day on a ${nextProfile.planStyle} plan.`)
  }

  function saveLatestReplyAsMealPlan() {
    const latest = [...messages].reverse().find((m) => m.role === 'assistant')?.content?.trim()
    if (!latest) return
    setCurrentMealPlan(latest)
    pushAssistantMessage('Saved that as your current meal plan. I’ll keep it here in this browser until you replace it.')
  }

  function saveLatestReplyAsWorkout() {
    const latest = [...messages].reverse().find((m) => m.role === 'assistant')?.content?.trim()
    if (!latest) return
    setCurrentWorkout(latest)
    pushAssistantMessage('Saved that as your current workout. I’ll keep it here in this browser until you replace it.')
  }

  function sendSuggestionPrompt(prompt: string) {
    if (connectionState === 'connected') {
      sendTextPrompt(prompt)
      return
    }
    queuedPromptRef.current = prompt
    void startConversation()
  }

  function hydrateTargetsFromAssistant(text: string) {
    const parsed = parseTargetsFromAssistantText(text)
    if (!(parsed.caloriesTarget && parsed.proteinTarget && parsed.carbsTarget && parsed.fatTarget)) return
    const nextTargets = {
      ...normalizeStatsForToday({ ...statsRef.current, timezone: statsRef.current.timezone || getBrowserTimeZone() }),
      caloriesTarget: parsed.caloriesTarget || statsRef.current.caloriesTarget,
      proteinTarget: parsed.proteinTarget || statsRef.current.proteinTarget,
      carbsTarget: parsed.carbsTarget || statsRef.current.carbsTarget,
      fatTarget: parsed.fatTarget || statsRef.current.fatTarget,
    }
    showPendingTargets(nextTargets)
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
      const finalText = currentAssistantTextRef.current
      hydrateTargetsFromAssistant(finalText)
      if (pendingEstimateRef.current && /\blogg(?:ed|ing)\b|\bsaved\b/i.test(finalText)) {
        applyMealLog(pendingEstimateRef.current, pendingMealTextRef.current || "your meal")
      }
      currentAssistantMessageIdRef.current = null
      currentAssistantTextRef.current = ""
    }
  }

  function persistCompletedProfile(nextProfile: CoachProfile) {
    const targets = calculateTargets(nextProfile)
    const targetDraft = markUsage({ ...normalizeStatsForToday(statsRef.current), ...targets, caloriesUsed: 0, proteinUsed: 0, carbsUsed: 0, fatUsed: 0, mealsToday: 0 })
    setProfile(nextProfile)
    onboardingProfileRef.current = nextProfile
    showPendingTargets(targetDraft)
    saveStoredAppState({ profile: nextProfile, stats: statsRef.current, messages: messages.slice(-20), pendingTargets: targetDraft })
    const dc = dcRef.current
    if (dc?.readyState === "open") {
      dc.send(JSON.stringify({ type: "response.create", response: { instructions: `${profileContext(nextProfile, statsRef.current)}
Setup is complete. Briefly confirm their daily calories, protein, carbs and fats to ${nextProfile.name}, tell them to tap Save targets below to lock them in, then ask what they want help with right now.` } }))
    } else {
      pushAssistantMessage(`${nextProfile.name ? `${nextProfile.name}, ` : ""}I’ve worked your targets out. Tap Save targets below to lock in ${targetDraft.caloriesTarget} calories, ${targetDraft.proteinTarget}g protein, ${targetDraft.carbsTarget}g carbs and ${targetDraft.fatTarget}g fat for today.`)
    }
  }


  function pushAssistantMessage(content: string) {
    setMessages(prev => [...prev, makeMessage("assistant", content)])
  }

  function clearPendingEstimate() {
    pendingEstimateRef.current = null
    pendingMealTextRef.current = null
    setPendingEstimate(null)
    setPendingMealText(null)
    saveStoredAppState({
      profile: profileRef.current ?? EMPTY_PROFILE,
      stats: statsRef.current,
      pendingEstimate: null,
      pendingMealText: null,
      pendingTargets: pendingTargetsRef.current,
      loggedMeals: loggedMealsRef.current,
      pendingDelete: pendingDeleteRef.current,
    })
  }

  function clearPendingDelete() {
    pendingDeleteRef.current = null
    setPendingDelete(null)
    saveStoredAppState({
      profile: profileRef.current ?? EMPTY_PROFILE,
      stats: statsRef.current,
      pendingEstimate: pendingEstimateRef.current,
      pendingMealText: pendingMealTextRef.current,
      pendingTargets: pendingTargetsRef.current,
      loggedMeals: loggedMealsRef.current,
      pendingDelete: null,
    })
  }

  function showDeleteDraft(meal: LoggedMeal) {
    const draft: PendingDelete = {
      mealId: meal.id,
      text: meal.text,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
    }
    pendingDeleteRef.current = draft
    setPendingDelete(draft)
    saveStoredAppState({
      profile: profileRef.current ?? EMPTY_PROFILE,
      stats: statsRef.current,
      pendingEstimate: pendingEstimateRef.current,
      pendingMealText: pendingMealTextRef.current,
      pendingTargets: pendingTargetsRef.current,
      loggedMeals: loggedMealsRef.current,
      pendingDelete: draft,
    })
  }

  function deleteLoggedMeal(mealId: string) {
    const found = loggedMealsRef.current.find((meal) => meal.id === mealId)
    if (!found) return
    const remaining = loggedMealsRef.current.filter((meal) => meal.id !== mealId)
    const base = normalizeStatsForToday(statsRef.current)
    const updated: CoachStats = {
      ...base,
      caloriesUsed: Math.max(0, base.caloriesUsed - found.calories),
      proteinUsed: Math.max(0, base.proteinUsed - found.protein),
      carbsUsed: Math.max(0, base.carbsUsed - found.carbs),
      fatUsed: Math.max(0, base.fatUsed - found.fat),
      mealsToday: Math.max(0, base.mealsToday - (found.countedAsMeal ? 1 : 0)),
    }
    loggedMealsRef.current = remaining
    setLoggedMeals(remaining)
    setStats(updated)
    pendingDeleteRef.current = null
    setPendingDelete(null)
    saveStoredAppState({ profile: profileRef.current ?? EMPTY_PROFILE, stats: updated, loggedMeals: remaining, pendingDelete: null, pendingEstimate: pendingEstimateRef.current, pendingMealText: pendingMealTextRef.current, pendingTargets: pendingTargetsRef.current })
    pushAssistantMessage(`Deleted ${found.text}. You’ve now got ${caloriesLeft(updated)} calories, ${proteinLeft(updated)}g protein, ${carbsLeft(updated)}g carbs and ${fatLeft(updated)}g fat left today.`)
  }

  function applyMealLog(estimate: MacroEstimate, mealText: string) {
    clearPendingEstimate()
    clearPendingDelete()

    const base = markUsage(normalizeStatsForToday(statsRef.current))
    const updated: CoachStats = {
      ...base,
      caloriesUsed: base.caloriesUsed + estimate.calories,
      proteinUsed: base.proteinUsed + estimate.protein,
      carbsUsed: base.carbsUsed + estimate.carbs,
      fatUsed: base.fatUsed + estimate.fat,
      mealsToday: base.mealsToday + (estimate.countedAsMeal ? 1 : 0),
    }

    const loggedMeal: LoggedMeal = {
      id: uid(),
      text: titleMealText(mealText),
      calories: estimate.calories,
      protein: estimate.protein,
      carbs: estimate.carbs,
      fat: estimate.fat,
      countedAsMeal: estimate.countedAsMeal,
      createdAt: new Date().toISOString(),
    }
    const nextMeals = [...loggedMealsRef.current, loggedMeal]
    loggedMealsRef.current = nextMeals
    setLoggedMeals(nextMeals)
    setStats(updated)
    saveStoredAppState({ profile: profileRef.current ?? EMPTY_PROFILE, stats: updated, pendingEstimate: null, pendingMealText: null, pendingTargets: pendingTargetsRef.current, loggedMeals: nextMeals, pendingDelete: null })
    pushAssistantMessage(
      `Logged ${titleMealText(mealText)}. That adds roughly ${estimate.calories} calories, ${estimate.protein}g protein, ${estimate.carbs}g carbs and ${estimate.fat}g fat. ` +
      `You’ve got ${caloriesLeft(updated)} calories, ${proteinLeft(updated)}g protein, ${carbsLeft(updated)}g carbs and ${fatLeft(updated)}g fat left today.`
    )
  }


  function addUserTranscript(text: string) {
    const cleaned = text.trim()
    if (!cleaned) return
    setMessages((prev) => [...prev, makeMessage("user", cleaned)])

    const deleteTarget = parseDeleteIntent(cleaned)
    if (deleteTarget) {
      const orderedMeals = [...loggedMealsRef.current].reverse()
      const match = deleteTarget === "__LAST__" ? orderedMeals[0] : orderedMeals.find((meal) => meal.text.toLowerCase().includes(deleteTarget.toLowerCase()))
      if (match) {
        showDeleteDraft(match)
        pushAssistantMessage(`I found ${match.text}. Tap Delete to remove it or Keep to leave it in.`)
      } else {
        pushAssistantMessage(`I couldn’t find ${deleteTarget} in today’s logged food yet.`)
      }
      return
    }

    const ready = isProfileComplete(profileRef.current, statsRef.current)

    if (!ready) {
      pushAssistantMessage('Use the setup card below George, then tap Save and calculate. Once that is saved, I can build and save plans properly for you.')
      return
    }

    if (pendingEstimateRef.current && isConfirmIntent(cleaned) && !looksLikeFoodInput(cleaned)) {
      applyMealLog(pendingEstimateRef.current, pendingMealTextRef.current || "your meal")
      return
    }

    const estimate = estimateFromText(cleaned)
    if (estimate) {
      const mealText = titleMealText(cleaned)
      pendingEstimateRef.current = estimate
      pendingMealTextRef.current = mealText
      setPendingEstimate(estimate)
      setPendingMealText(mealText)
      clearPendingDelete()
      pushAssistantMessage(`I’ve drafted ${mealText} at roughly ${estimate.calories} calories, ${estimate.protein}g protein, ${estimate.carbs}g carbs and ${estimate.fat}g fat. Tap Log meal below if that looks right.`)
      return
    }

    const maybeTargets = mergeProfileFromInput(cleaned, profileRef.current || EMPTY_PROFILE)
    if (maybeTargets.complete && !(statsRef.current.caloriesTarget > 0 && statsRef.current.proteinTarget > 0 && statsRef.current.carbsTarget > 0 && statsRef.current.fatTarget > 0)) {
      onboardingProfileRef.current = maybeTargets.profile
      setProfile(maybeTargets.profile)
      persistCompletedProfile(maybeTargets.profile)
      return
    }

    setStats((prev) => markUsage(prev))
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
      audio.setAttribute('playsinline', 'true')
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
        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
          },
        }))
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
          <button type="button" disabled={connectionState === "connecting"} onClick={connectionState === "connected" ? stopConversation : startConversation} className="group relative flex h-[300px] w-[300px] items-center justify-center rounded-full focus:outline-none disabled:cursor-not-allowed">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(96,165,250,0.18),transparent_50%),radial-gradient(circle_at_50%_50%,rgba(251,146,60,0.12),transparent_68%)] blur-xl" />
            <div className="absolute inset-0 rounded-full border border-blue-300/20" />
            <div className="absolute inset-[10px] rounded-full border border-white/10" />
            <div className="absolute inset-[54px] rounded-full border border-white/6 bg-[radial-gradient(circle_at_50%_40%,rgba(96,165,250,.28),rgba(3,7,18,.96)_64%)]" />
            <div className="absolute inset-[80px] rounded-full bg-[radial-gradient(circle_at_50%_32%,rgba(255,255,255,.34),rgba(15,23,42,.16)_18%,rgba(2,6,23,.96)_60%)]" />
            <div className="absolute left-1/2 top-[88px] flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full border border-white/16 bg-white/10 shadow-[0_12px_40px_rgba(0,0,0,.35)] backdrop-blur">
              <BarChart3 className="h-7 w-7 text-white/90" />
            </div>
            <div className="relative z-10 mt-16 text-center">
              <div className="text-[46px] font-semibold tracking-tight text-white">George</div>
              <div className="mt-2 text-[22px] text-white/82">{connectionState === "connecting" ? "Connecting…" : connectionState === "connected" ? "Live now" : "Tap to talk"}</div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-300">ready when you are</div>
            </div>
          </button>
        </div>

        <p className="mt-3 text-center text-sm leading-6 text-slate-300">{latestAssistantMessage}</p>

        <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,28,.95),rgba(4,8,18,.98))] p-4 shadow-[0_16px_46px_rgba(0,0,0,.28)]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-slate-500">Action card</div>
          {!profileReady ? (
            <div className="mt-3 space-y-3">
              <div className="text-sm text-slate-300">Tell George what you want help with, then use this card to save the important stuff properly.</div>
              <div className="grid grid-cols-2 gap-3">
                <input value={setupDraft.name} onChange={(e) => setSetupDraft((p) => ({ ...p, name: e.target.value }))} placeholder="First name" className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-slate-500" />
                <input value={setupDraft.age} onChange={(e) => setSetupDraft((p) => ({ ...p, age: e.target.value }))} placeholder="Age" className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-slate-500" />
                <select value={setupDraft.sex} onChange={(e) => setSetupDraft((p) => ({ ...p, sex: e.target.value as Sex }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white">
                  <option value="male">Male</option><option value="female">Female</option>
                </select>
                <input value={setupDraft.heightCm} onChange={(e) => setSetupDraft((p) => ({ ...p, heightCm: e.target.value }))} placeholder="Height cm" className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-slate-500" />
                <input value={setupDraft.weightKg} onChange={(e) => setSetupDraft((p) => ({ ...p, weightKg: e.target.value }))} placeholder="Weight kg" className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-slate-500" />
                <select value={setupDraft.activityLevel} onChange={(e) => setSetupDraft((p) => ({ ...p, activityLevel: e.target.value as ActivityLevel }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white">
                  <option value="sedentary">Sedentary</option><option value="lightly active">Lightly active</option><option value="moderately active">Moderately active</option><option value="very active">Very active</option>
                </select>
                <select value={setupDraft.goal} onChange={(e) => setSetupDraft((p) => ({ ...p, goal: e.target.value as Goal }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white">
                  <option value="lose fat">Lose fat</option><option value="maintain">Maintain</option><option value="gain muscle">Gain muscle</option>
                </select>
                <select value={setupDraft.planStyle} onChange={(e) => setSetupDraft((p) => ({ ...p, planStyle: e.target.value as PlanStyle }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white">
                  <option value="performance">Performance</option><option value="balanced">Balanced</option><option value="flexible">Flexible</option>
                </select>
                <select value={String(setupDraft.mealCount)} onChange={(e) => setSetupDraft((p) => ({ ...p, mealCount: Number(e.target.value) as MealCount }))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white">
                  <option value="3">3 meals</option><option value="4">4 meals</option><option value="5">5 meals</option><option value="6">6 meals</option>
                </select>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-slate-400">Pick the number of meals you want George to build around.</div>
              </div>
              <textarea value={setupDraft.allergies} onChange={(e) => setSetupDraft((p) => ({ ...p, allergies: e.target.value }))} placeholder="Allergies or foods to avoid" className="min-h-[72px] w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-slate-500" />
              <textarea value={setupDraft.dislikes} onChange={(e) => setSetupDraft((p) => ({ ...p, dislikes: e.target.value }))} placeholder="Disliked foods" className="min-h-[72px] w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-slate-500" />
              <button type="button" onClick={saveSetupProfile} className="w-full rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">Save and calculate</button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="text-sm text-slate-300">Use the latest reply as a saved card so it stays on the page when you come back.</div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={saveLatestReplyAsMealPlan} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">Save latest as meal plan</button>
                <button type="button" onClick={saveLatestReplyAsWorkout} className="rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Save latest as workout</button>
              </div>
            </div>
          )}
        </div>

        {profileReady ? (
          <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,28,.95),rgba(4,8,18,.98))] p-4 shadow-[0_16px_46px_rgba(0,0,0,.28)]">
            <div className="text-[10px] uppercase tracking-[0.32em] text-slate-500">Your targets</div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[
                { label: 'Protein', value: `${effectiveStats.proteinTarget}g`, color: 'text-cyan-300' },
                { label: 'Carbs', value: `${effectiveStats.carbsTarget}g`, color: 'text-blue-300' },
                { label: 'Fats', value: `${effectiveStats.fatTarget}g`, color: 'text-amber-300' },
                { label: 'Calories', value: `${effectiveStats.caloriesTarget}`, color: 'text-emerald-300' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/8 bg-white/5 px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{item.label}</div>
                  <div className={`mt-2 text-2xl font-semibold ${item.color}`}>{item.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
              <span>Current weight: <span className="text-white">{profile?.weightKg || '--'} kg</span></span>
              <span>Plan style: <span className="text-white">{profile?.planStyle || 'balanced'}</span></span>
              <span>Meals: <span className="text-white">{profile?.mealCount || 4}</span></span>
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,28,.95),rgba(4,8,18,.98))] p-4 shadow-[0_16px_46px_rgba(0,0,0,.28)]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-slate-500">Current meal plan</div>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{currentMealPlan || 'No meal plan saved yet — ask George to build one, then tap Save latest as meal plan.'}</div>
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,28,.95),rgba(4,8,18,.98))] p-4 shadow-[0_16px_46px_rgba(0,0,0,.28)]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-slate-500">Current workout</div>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{currentWorkout || 'No workout saved yet — ask George for a session, then tap Save latest as workout.'}</div>
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,28,.95),rgba(4,8,18,.98))] p-4 shadow-[0_16px_46px_rgba(0,0,0,.28)]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-slate-500">Weekly check-in</div>
          <div className="mt-3 text-sm text-slate-300">{profileReady ? 'Your weekly check-in stays in this browser. Save your updated weight on check-in and George can recalculate your targets.' : 'Finish setup first, then George can start your weekly check-in properly.'}</div>
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,28,.95),rgba(4,8,18,.98))] p-4 shadow-[0_16px_46px_rgba(0,0,0,.28)]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-slate-500">Latest from George</div>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{latestAssistantMessage}</div>
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,28,.95),rgba(4,8,18,.98))] p-4 shadow-[0_16px_46px_rgba(0,0,0,.28)]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-slate-500">Conversation preview</div>
          <div className="mt-3 max-h-56 space-y-3 overflow-y-auto text-sm">
            {[...messages].slice(-6).map((message) => (
              <div key={message.id} className="rounded-xl border border-white/8 bg-white/5 px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{message.role}</div>
                <div className="mt-1 whitespace-pre-wrap leading-6 text-slate-200">{message.content}</div>
              </div>
            ))}
            {!messages.length ? <div className="text-slate-400">Your last conversation will stay here in this browser.</div> : null}
          </div>
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,28,.95),rgba(4,8,18,.98))] p-4 shadow-[0_16px_46px_rgba(0,0,0,.28)]">
          <div className="text-[10px] uppercase tracking-[0.32em] text-slate-500">Try asking George</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {['Build me a 4 meal plan', 'What should I eat today?', 'I went off track', 'Give me a workout', 'Swap the rice for sweet potato'].map((prompt) => (
              <button key={prompt} type="button" onClick={() => sendSuggestionPrompt(prompt)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">{prompt}</button>
            ))}
          </div>
        </div>

        {error ? <div className="mt-4 text-center text-sm text-rose-300">{error}</div> : null}
        <div className="mt-6 flex justify-center">
          {connectionState === 'connected' ? (
            <button type="button" onClick={stopConversation} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-300">
              <PhoneOff className="h-4 w-4" /> Stop
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )

}
