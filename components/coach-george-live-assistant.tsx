"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronRight, Flame, Loader2, MessageSquareText, Mic, RefreshCcw, ShoppingBag, UtensilsCrossed } from "lucide-react"
import {
  buildMealPlan,
  getDailyTargets,
  getRecipeNutrition,
  type ActivityLevel,
  type DietaryPreference,
  type Food,
  type Goal,
  type MealPlanResult,
  type Nutrition,
  type PlanMode,
  type Profile,
  type Recipe,
  type Sex,
} from "@/lib/coach-george/coach-george-nutrition"
import { getLocalCoachGeorgePlannerData, type PlannerDataSource } from "@/lib/coach-george/coach-george-sheet-data"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

type StatsState = {
  currentWeightKg: number
  dayStreak: number
  totalCalories: number
  protein: number
  carbs: number
  fats: number
}

type CoachState = {
  profile: Profile | null
  profileComplete: boolean
  targets: Nutrition
  stats: StatsState
  latestPlan: string | null
  currentPlan: MealPlanResult | null
  messages: LiveMessage[]
  weightInput: string
  lastActiveDate: string | null
}

type SetupFormState = {
  goal: Goal
  sex: Sex
  age: string
  heightCm: string
  currentWeightKg: string
  activityLevel: ActivityLevel
  allergies: string
  dislikedFoods: string
  mealsPerDay: "3" | "4" | "5"
  dietaryPreference: DietaryPreference
  planMode: PlanMode
}

type WorkoutExperience = "beginner" | "intermediate" | "advanced"
type WorkoutGoal = "fat-loss" | "muscle" | "sport-specific"
type WorkoutProfile = {
  experience: WorkoutExperience
  goal: WorkoutGoal
}

type PlannerPayload = {
  foods: Food[]
  recipes: Recipe[]
  source: PlannerDataSource
  statusMessage: string
  fallbackReason: string | null
}

const SESSION_KEY = "coach-george-session-v8"

const ZERO_TARGETS: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 }
const ZERO_STATS: StatsState = { currentWeightKg: 0, dayStreak: 0, totalCalories: 0, protein: 0, carbs: 0, fats: 0 }
const LOCAL_FALLBACK = getLocalCoachGeorgePlannerData()

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "assistant",
    content: "Welcome — complete your quick setup and I’ll take it from there.",
  },
]

const INITIAL_STATE: CoachState = {
  profile: null,
  profileComplete: false,
  targets: ZERO_TARGETS,
  stats: ZERO_STATS,
  latestPlan: null,
  currentPlan: null,
  messages: INITIAL_MESSAGES,
  weightInput: "",
  lastActiveDate: null,
}

const DEFAULT_SETUP_FORM: SetupFormState = {
  goal: "lose-fat",
  sex: "male",
  age: "",
  heightCm: "",
  currentWeightKg: "",
  activityLevel: "moderate",
  allergies: "",
  dislikedFoods: "",
  mealsPerDay: "3",
  dietaryPreference: "omnivore",
  planMode: "balanced",
}

function makeMessage(role: LiveMessage["role"], content: string) {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${role}-${Date.now()}-${Math.random()}`,
    role,
    content,
  }
}

function trimMessagesForStorage(messages: LiveMessage[]) {
  return messages.slice(-80)
}

function formatTargetSummary(targets: Nutrition) {
  return `Targets updated: ${targets.calories} kcal | Protein ${targets.protein}g | Carbs ${targets.carbs}g | Fats ${targets.fat}g.`
}

function parseListValue(raw: string) {
  if (!raw.trim()) return []
  if (/\bnone\b|\bno\b/i.test(raw)) return []
  return raw
    .split(/,| and /i)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
}

function buildTargetsAndStats(profile: Profile, dayStreak: number): Pick<CoachState, "targets" | "stats"> {
  const targets = getDailyTargets(profile)
  return {
    targets,
    stats: {
      currentWeightKg: profile.currentWeightKg,
      dayStreak,
      totalCalories: targets.calories,
      protein: targets.protein,
      carbs: targets.carbs,
      fats: targets.fat,
    },
  }
}

function toIsoDate(input: Date) {
  return input.toISOString().slice(0, 10)
}

function computeNextStreak(lastActiveDate: string | null, previousStreak: number) {
  const today = toIsoDate(new Date())
  if (!lastActiveDate) return previousStreak > 0 ? previousStreak : 1
  if (lastActiveDate === today) return previousStreak > 0 ? previousStreak : 1

  const yesterday = toIsoDate(new Date(Date.now() - 86400000))
  if (lastActiveDate === yesterday) return Math.max(1, previousStreak) + 1
  return 1
}


function readPersistedCoachState(): CoachState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CoachState
  } catch {
    return null
  }
}

function getLiveCoachStateSnapshot(liveState: CoachState, livePlannerData: PlannerPayload) {
  const persisted = readPersistedCoachState()
  const persistedProfile = persisted?.profileComplete && persisted.profile ? (persisted.profile as Profile) : null
  const profile = persistedProfile || liveState.profile
  const profileComplete = Boolean(profile)
  const baseStreak = persisted?.stats?.dayStreak || liveState.stats.dayStreak || 0
  const nextStreak = profile ? computeNextStreak(persisted?.lastActiveDate ?? liveState.lastActiveDate, baseStreak) : 0
  const calculated = profile ? buildTargetsAndStats(profile, nextStreak) : { targets: ZERO_TARGETS, stats: ZERO_STATS }
  const currentPlan = (persisted?.currentPlan || persisted?.latestPlan ? persisted?.currentPlan || liveState.currentPlan : liveState.currentPlan) || null
  return {
    profile,
    profileComplete,
    targets: calculated.targets,
    stats: calculated.stats,
    currentPlan,
    plannerData: livePlannerData,
  }
}

function getPlannerSourceLabel(plannerData: PlannerPayload) {
  if (plannerData.source === "uploaded_csv") return "Uploaded CSV data"
  if (plannerData.source === "google_sheets") return "Live Google Sheets"
  return "Local fallback data"
}

function buildVoiceRendererInstructions() {
  return [
    "You are Coach George's voice renderer.",
    "You do not decide what to say.",
    "The app decides the exact reply text.",
    "Only speak the exact text provided by the app in response.instructions.",
    "Do not add, remove, summarise, paraphrase, or improvise anything.",
    "Never ask onboarding questions, build plans, swap meals, generate shopping lists, or generate your own coaching advice.",
  ].join(" ")
}

function formatComputedPlan(result: MealPlanResult, plannerData: PlannerPayload) {
  const lines = [formatTargetSummary(result.targets), "", `Planned totals: ${result.totals.calories} kcal | Protein ${result.totals.protein}g | Carbs ${result.totals.carbs}g | Fats ${result.totals.fat}g.`, ""]

  result.plan.forEach((meal, index) => {
    lines.push(`Meal ${index + 1}: ${meal.name}`)
    if (meal.ingredients.length) {
      meal.ingredients.forEach((ingredient) => {
        const food = plannerData.foods.find((entry) => entry.id === ingredient.foodId)
        lines.push(`- ${food?.name || ingredient.foodId}: ${ingredient.grams}g`)
      })
    }
    lines.push(`Macros: ${meal.nutrition.calories} kcal | P ${meal.nutrition.protein}g | C ${meal.nutrition.carbs}g | F ${meal.nutrition.fat}g`)
    lines.push("")
  })

  return lines.join("\n").trim()
}

function sumPlanNutrition(plan: MealPlanResult["plan"]): Nutrition {
  return plan.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.nutrition.calories,
      protein: acc.protein + meal.nutrition.protein,
      carbs: acc.carbs + meal.nutrition.carbs,
      fat: acc.fat + meal.nutrition.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

function cleanLabel(value: string) {
  return value
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function formatWeight(grams: number) {
  if (grams >= 1000) {
    const kg = grams / 1000
    return `${Number.isInteger(kg) ? kg.toFixed(0) : kg.toFixed(1)}kg`
  }
  return `${Math.round(grams)}g`
}

function buildShoppingList(plan: MealPlanResult, plannerData: PlannerPayload, days: number) {
  const totals = new Map<string, { label: string; grams: number }>()

  plan.plan.forEach((meal) => {
    meal.ingredients.forEach((ingredient) => {
      const food = plannerData.foods.find((entry) => entry.id === ingredient.foodId)
      const rawName = cleanLabel(food?.name || ingredient.foodId)
      const key = rawName.toLowerCase()
      const existing = totals.get(key)
      totals.set(key, {
        label: existing?.label || rawName,
        grams: (existing?.grams || 0) + ingredient.grams * days,
      })
    })
  })

  return Array.from(totals.values())
    .map((item) => ({ name: item.label, grams: Math.round(item.grams) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function formatShoppingList(plan: MealPlanResult, plannerData: PlannerPayload, days: number) {
  const items = buildShoppingList(plan, plannerData, days)
  const lines = [`Shopping List (${days} Day${days === 1 ? "" : "s"})`, ""]
  items.forEach((item) => lines.push(`- ${item.name}: ${formatWeight(item.grams)}`))
  return lines.join("\n")
}


function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
}

type GeorgeIntent = "show_plan" | "show_targets" | "build_plan" | "swap_meal" | "shopping_list" | "update_weight" | "workout" | "eating_out" | "off_plan" | "motivation" | "no_response" | "unknown"

function normalizeTranscript(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\bmill\b/g, "meal")
    .replace(/\blaunch\b/g, "lunch")
    .replace(/\bmeal to\b/g, "meal two")
    .replace(/\bmeal too\b/g, "meal two")
    .replace(/\bsecond meal\b/g, "meal two")
    .replace(/\bthird meal\b/g, "meal three")
    .replace(/\bfourth meal\b/g, "meal four")
    .replace(/\bfifth meal\b/g, "meal five")
    .replace(/\bmeal for\b/g, "meal four")
    .replace(/\bfor lunch\b/g, "for lunch")
    .replace(/\bbrekfast\b|\bbreak fast\b/g, "breakfast")
    .replace(/\btea\b/g, "dinner")
    .replace(/\s+/g, " ")
}

function normalizeTranscriptForIntent(value: string) {
  return normalizeText(normalizeTranscript(value))
}

function detectIntent(input: string, options?: { hasPlan?: boolean; lastIntent?: GeorgeIntent | null }): GeorgeIntent {
  const hasPlan = Boolean(options?.hasPlan)
  const lastIntent = options?.lastIntent || null

  if (["ok", "okay", "cool", "great", "nice", "thanks", "thank you", "george"].includes(input)) return "no_response"

  if (
    [
      "show my plan",
      "what is my plan",
      "what am i eating",
      "my meals",
      "show me my meals",
      "view my plan",
      "show plan",
      "where is my plan",
      "let me see it",
      "show it",
      "where is it",
      "see it",
      "i cant see my plan",
      "i can't see my plan",
      "i cant see it",
      "i can't see it",
      "what is my meal plan",
    ].some((phrase) => input.includes(phrase))
  ) {
    return "show_plan"
  }

  if (input.includes("workout plan")) return "workout"

  if (hasPlan && /(plan|meal plan|meals)/.test(input) && /(show|see|view|where|can t see|cant see)/.test(input)) {
    return "show_plan"
  }

  if (hasPlan && ["yeah i d like to see it", "yes i d like to see it", "i d like to see it", "can i see it"].some((phrase) => input.includes(phrase))) {
    return "show_plan"
  }

  if (["calories", "macros", "targets", "protein", "carbs", "fats"].some((phrase) => input.includes(phrase))) return "show_targets"
  if (["build my plan", "new plan", "food plan", "make my plan", "build a new plan", "rebuild plan"].some((phrase) => input.includes(phrase))) return "build_plan"
  if (["swap", "change meal", "change lunch", "change breakfast", "change dinner", "replace"].some((phrase) => input.includes(phrase))) return "swap_meal"
  if (lastIntent === "swap_meal" && getMealIndexFromInput(input, 5) !== null) return "swap_meal"
  if (["update weight", "change weight", "new weight", "my weight changed", "weigh", "weight update"].some((phrase) => input.includes(phrase))) return "update_weight"
  if (input.includes("shopping list")) return "shopping_list"
  if (input.includes("workout") || input.includes("training") || input.includes("gym") || input.includes("push") || input.includes("pull") || input.includes("legs") || input.includes("home workout") || input.includes("boxing")) return "workout"
  if (input.includes("eating out") || input.includes("restaurant") || input.includes("takeaway")) return "eating_out"
  if (input.includes("fell off") || input.includes("messed up") || input.includes("off plan")) return "off_plan"
  if (input.includes("struggling") || input.includes("motivation") || input.includes("can t be bothered") || input.includes("cant be bothered")) return "motivation"
  return "unknown"
}

function getMealIndexFromInput(input: string, mealCount: number) {
  if (input.includes("breakfast") || input.includes("meal one") || input.includes("meal 1") || input.includes("number one")) return mealCount > 0 ? 0 : null
  if (input.includes("lunch") || input.includes("meal two") || input.includes("meal 2") || input.includes("number two") || /meal to/.test(input)) return mealCount > 1 ? 1 : null
  if (input.includes("dinner") || input.includes("meal three") || input.includes("meal 3") || input.includes("number three")) return mealCount > 2 ? 2 : null
  if (input.includes("meal four") || input.includes("meal 4") || input.includes("number four")) return mealCount > 3 ? 3 : null
  if (input.includes("meal five") || input.includes("meal 5") || input.includes("number five")) return mealCount > 4 ? 4 : null
  return null
}

function isLikelyWorkoutFollowUp(input: string) {
  return ["gym", "home", "boxing", "push", "pull", "legs", "full body", "all round", "all-round", "all rounder", "all-rounder", "upper", "lower"].some((phrase) => input.includes(phrase))
}

function buildWorkoutReply(input: string) {
  const lower = input
  if (lower.includes("boxing")) {
    return "Perfect — let’s keep it sharp. Do 6 rounds on the bag, 3 rounds shadow boxing, then finish with 3 rounds of hard conditioning. Keep the pace up and stay switched on. Next step — get warmed up and start round one."
  }
  if (lower.includes("home")) {
    return "Good — keep it simple. Do 4 rounds of goblet squats, push-ups, rows, and kettlebell swings. Work steadily and keep rest tight. Next step — get the first round done properly."
  }
  if (lower.includes("push")) {
    return "Perfect — go push focused. Chest press 3 sets, incline press 3 sets, shoulder press 3 sets, lateral raises 2 to 3 sets, then triceps. Controlled reps and hard effort. Next step — start with chest press and build into it."
  }
  if (lower.includes("pull")) {
    return "Good — go pull focused. Lat pulldown 3 sets, chest-supported row 3 sets, cable row 2 to 3 sets, rear delts, then biceps. Keep it controlled and drive the elbows. Next step — start with pulldowns and get the back working early."
  }
  if (lower.includes("legs")) {
    return "Perfect — let’s train legs. Leg press 3 sets, hamstring curls 3 sets, walking lunges 2 to 3 sets, calf raises 3 sets. Controlled reps and actually push the effort. Next step — get warmed up and start with leg press."
  }
  return "Perfect — let’s get a solid full-body session in. Leg press 3 sets, chest press 3 sets, lat pulldown 3 sets, shoulder press 2 to 3 sets, then 10 minutes hard conditioning. Keep it controlled and push yourself. Next step — get changed and start the first movement."
}

function formatPlanSummary(result: MealPlanResult) {
  const lines = [
    formatTargetSummary(result.targets),
    `Planned totals: ${result.totals.calories} kcal | Protein ${result.totals.protein}g | Carbs ${result.totals.carbs}g | Fats ${result.totals.fat}g.`,
    "",
    "Meals:",
    ...result.plan.map((meal, index) => `Meal ${index + 1}: ${meal.name} — ${meal.nutrition.calories} kcal | P ${meal.nutrition.protein}g | C ${meal.nutrition.carbs}g | F ${meal.nutrition.fat}g`),
  ]
  return lines.join("\n")
}

function formatTargetsPlain(targets: Nutrition) {
  return `${targets.calories} kcal | Protein ${targets.protein}g | Carbs ${targets.carbs}g | Fats ${targets.fat}g`
}

function buildRealtimeSessionPayload(instructions: string) {
  return {
    type: "realtime",
    instructions,
    audio: {
      input: {
        transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "en",
        },
        turn_detection: {
          type: "semantic_vad",
          eagerness: "high",
          create_response: false,
          interrupt_response: true,
        },
      },
      output: {
        voice: "cedar",
        speed: 1.0,
      },
    },
  }
}

export function CoachGeorgeLiveAssistant() {
  const [state, setState] = useState<CoachState>(INITIAL_STATE)
  const [setupForm, setSetupForm] = useState<SetupFormState>(DEFAULT_SETUP_FORM)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [plannerData, setPlannerData] = useState<PlannerPayload>(LOCAL_FALLBACK)
  const [plannerLoading, setPlannerLoading] = useState(true)
  const [shoppingDays, setShoppingDays] = useState<1 | 3 | 5 | 7>(3)
  const [selectedSwapMeal, setSelectedSwapMeal] = useState(0)
  const [hydrated, setHydrated] = useState(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const profileRef = useRef<Profile | null>(INITIAL_STATE.profile)
  const targetsRef = useRef<Nutrition>(INITIAL_STATE.targets)
  const currentPlanRef = useRef<MealPlanResult | null>(INITIAL_STATE.currentPlan)
  const profileCompleteRef = useRef<boolean>(INITIAL_STATE.profileComplete)
  const liveStateRef = useRef<CoachState>(INITIAL_STATE)
  const plannerDataRef = useRef<PlannerPayload>(LOCAL_FALLBACK)
  const hydratedRef = useRef(false)
  const workoutProfileRef = useRef<WorkoutProfile | null>(null)
  const pendingWorkoutQuestionRef = useRef<"experience" | "goal" | null>(null)
  const sessionPatternRef = useRef({ fallsOff: 0, swaps: 0, skippedMeals: 0 })
  const greetedSessionRef = useRef(false)
  const lastHandledInputRef = useRef<{ normalized: string; at: number } | null>(null)
  const lastIntentRef = useRef<GeorgeIntent | null>(null)
  const pendingWorkoutPromptRef = useRef<"type" | null>(null)

  const canStart = useMemo(() => hydrated && (connectionState === "idle" || connectionState === "error"), [connectionState, hydrated])
  const showSetupModal = hydrated && !state.profileComplete

  const appendAssistantMessage = (content: string) => {
    setState((prev) => ({ ...prev, messages: [...prev.messages, makeMessage("assistant", content)] }))
  }

  const appendSystemMessage = (content: string) => {
    setState((prev) => ({ ...prev, messages: [...prev.messages, makeMessage("system", content)] }))
  }

  const respond = (content: string) => {
    appendAssistantMessage(content)
    speakIfConnected(content)
  }

  const appendUserMessage = (content: string) => {
    setState((prev) => ({ ...prev, messages: [...prev.messages, makeMessage("user", content)] }))
  }

  const speakIfConnected = (textToSpeak: string) => {
    const channel = dcRef.current
    if (!channel || channel.readyState !== "open") return
    const safeText = textToSpeak.trim()
    if (!safeText) return

    const responsePayload = {
      type: "response.create",
      response: {
        conversation: "none",
        output_modalities: ["audio"],
        input: [
          {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Speak the following text exactly as written. Do not add, remove, summarise, paraphrase, change, or answer anything else.

${safeText}`,
              },
            ],
          },
        ],
      },
    }

    try {
      console.debug("[George realtime] response.create", responsePayload)
      channel.send(JSON.stringify(responsePayload))
    } catch (error) {
      console.error("[George realtime] response.create failed", error)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadPlannerData() {
      try {
        const response = await fetch("/api/coach-george-data", { cache: "no-store" })
        const payload = (await response.json()) as PlannerPayload
        if (!cancelled && response.ok && payload) {
          setPlannerData(payload.foods?.length && payload.recipes?.length ? payload : LOCAL_FALLBACK)
        }
      } catch {
        if (!cancelled) setPlannerData(LOCAL_FALLBACK)
      } finally {
        if (!cancelled) setPlannerLoading(false)
      }
    }

    void loadPlannerData()

  
  return (
    <section
      className="relative overflow-x-hidden bg-[#0b1220] px-3 py-4 text-white sm:px-4 sm:py-8"
      style={{
        backgroundImage:
          "linear-gradient(rgba(11,18,32,0.78), rgba(15,31,58,0.86)), url('/coach-george-gym-bg.jpeg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(77,163,255,0.18),transparent_38%),radial-gradient(circle_at_bottom,rgba(127,214,255,0.12),transparent_34%)]" />
      <div className="relative mx-auto w-full max-w-[860px]">
        <div className="rounded-[32px] border border-white/12 bg-[rgba(255,255,255,0.06)] p-3 shadow-[0_10px_40px_rgba(0,0,0,0.4),0_0_30px_rgba(77,163,255,0.2)] backdrop-blur-[20px] sm:p-5">
          <div className="rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(11,18,32,0.58),rgba(15,31,58,0.5))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-6">
            <header className="mb-6 text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Coach George</h1>
              <p className="mt-2 text-sm text-[rgba(255,255,255,0.7)] sm:text-lg">
                Your coach for meals, training, and daily guidance.
              </p>
            </header>

            <div className="mx-auto flex max-w-[320px] flex-col items-center">
              <button
                type="button"
                onClick={connectionState === "connected" ? stopConversation : startConversation}
                disabled={connectionState === "connecting" || !hydrated}
                className={`relative flex h-[168px] w-[168px] items-center justify-center rounded-full border border-[rgba(127,214,255,0.48)] bg-[radial-gradient(circle_at_50%_35%,rgba(127,214,255,0.26),rgba(77,163,255,0.18)_32%,rgba(11,18,32,0.82)_72%)] shadow-[0_0_30px_rgba(77,163,255,0.35),0_10px_40px_rgba(0,0,0,0.4),inset_0_0_24px_rgba(255,255,255,0.06)] transition duration-200 hover:scale-[1.01] disabled:opacity-70 sm:h-[210px] sm:w-[210px] ${connectionState === "connected" ? "animate-pulse" : ""}`}
              >
                <span className="pointer-events-none absolute inset-[10px] rounded-full border border-white/10" />
                <div className="flex flex-col items-center gap-3">
                  {connectionState === "connecting" ? (
                    <Loader2 className="h-11 w-11 animate-spin text-white" />
                  ) : (
                    <Mic className="h-11 w-11 text-white sm:h-12 sm:w-12" />
                  )}
                  <span className="text-2xl font-medium tracking-tight text-white sm:text-3xl">Tap to Talk</span>
                </div>
              </button>
            </div>

            <div className="mt-8 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-white/12 bg-[rgba(255,255,255,0.06)] px-5 py-4 shadow-[0_0_24px_rgba(77,163,255,0.14)] backdrop-blur-[20px]">
                  <p className="text-sm text-[rgba(255,255,255,0.7)]">Total Calories</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{state.stats.totalCalories.toLocaleString()}</p>
                </div>
                <div className="rounded-[24px] border border-white/12 bg-[rgba(255,255,255,0.06)] px-5 py-4 shadow-[0_0_24px_rgba(77,163,255,0.14)] backdrop-blur-[20px]">
                  <p className="text-sm text-[rgba(255,255,255,0.7)]">Current Weight</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{state.stats.currentWeightKg}kg</p>
                </div>
                <div className="rounded-[24px] border border-white/12 bg-[rgba(255,255,255,0.06)] px-5 py-4 shadow-[0_0_24px_rgba(77,163,255,0.14)] backdrop-blur-[20px]">
                  <p className="text-sm text-[rgba(255,255,255,0.7)]">Day Streak</p>
                  <p className="mt-2 inline-flex items-center gap-2 text-3xl font-semibold tracking-tight text-white">
                    <Flame className="h-5 w-5 text-[#7FD6FF]" />
                    {state.stats.dayStreak}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-white/12 bg-[rgba(255,255,255,0.05)] px-5 py-4 backdrop-blur-[20px]">
                  <p className="text-sm text-[rgba(255,255,255,0.7)]">Protein</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{state.stats.protein}g</p>
                </div>
                <div className="rounded-[22px] border border-white/12 bg-[rgba(255,255,255,0.05)] px-5 py-4 backdrop-blur-[20px]">
                  <p className="text-sm text-[rgba(255,255,255,0.7)]">Carbs</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{state.stats.carbs}g</p>
                </div>
                <div className="rounded-[22px] border border-white/12 bg-[rgba(255,255,255,0.05)] px-5 py-4 backdrop-blur-[20px]">
                  <p className="text-sm text-[rgba(255,255,255,0.7)]">Fats</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{state.stats.fats}g</p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={buildMyPlan}
                className="w-full rounded-[24px] border border-[rgba(127,214,255,0.5)] bg-[linear-gradient(180deg,rgba(77,163,255,0.34),rgba(77,163,255,0.18))] px-5 py-4 text-base font-semibold text-white shadow-[0_0_30px_rgba(77,163,255,0.35),0_12px_24px_rgba(0,0,0,0.24)] transition hover:bg-[linear-gradient(180deg,rgba(77,163,255,0.42),rgba(77,163,255,0.22))]"
              >
                Build / Update Plan
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[26px] border border-white/12 bg-[rgba(255,255,255,0.06)] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-[20px]">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(255,255,255,0.72)]">Tools</p>
                  <p className="mt-1 text-sm text-[rgba(255,255,255,0.7)]">Keep the plan tidy without changing how anything works.</p>
                </div>

                <div className="space-y-3">
                  <div className="rounded-[22px] border border-white/12 bg-[rgba(255,255,255,0.04)] p-3">
                    <label className="mb-2 block text-sm font-medium text-white">Update Weight</label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        value={state.weightInput}
                        onChange={(e) => setState((prev) => ({ ...prev, weightInput: e.target.value }))}
                        placeholder="kg"
                        type="number"
                        inputMode="decimal"
                        pattern="[0-9]*[.,]?[0-9]*"
                        min={35}
                        max={350}
                        step="0.1"
                        disabled={!state.profileComplete}
                        className="min-w-0 flex-1 rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-4 py-3 text-base text-white outline-none placeholder:text-[rgba(255,255,255,0.4)] disabled:opacity-50"
                      />
                      <button
                        onClick={updateWeight}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-semibold text-white sm:w-auto"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Update Weight
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/12 bg-[rgba(255,255,255,0.04)] p-3">
                    <label className="mb-2 block text-sm font-medium text-white">Swap Meal</label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <select
                        value={selectedSwapMeal}
                        onChange={(e) => setSelectedSwapMeal(Number(e.target.value))}
                        disabled={!state.currentPlan}
                        className="min-w-0 flex-1 rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-4 py-3 text-base text-white disabled:opacity-50"
                      >
                        {Array.from({ length: state.profile?.mealsPerDay || state.currentPlan?.plan.length || 3 }).map((_, index) => (
                          <option key={index} value={index}>{`Meal ${index + 1}`}</option>
                        ))}
                      </select>
                      <button
                        onClick={swapSelectedMeal}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-semibold text-white sm:w-auto"
                        disabled={!state.currentPlan}
                      >
                        <UtensilsCrossed className="h-4 w-4" />
                        Swap Selected Meal
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/12 bg-[rgba(255,255,255,0.04)] p-3">
                    <label className="mb-2 block text-sm font-medium text-white">Shopping List</label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <select
                        value={shoppingDays}
                        onChange={(e) => setShoppingDays(Number(e.target.value) as 1 | 3 | 5 | 7)}
                        disabled={!state.currentPlan}
                        className="min-w-0 flex-1 rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-4 py-3 text-base text-white disabled:opacity-50"
                      >
                        <option value={1}>1 day</option>
                        <option value={3}>3 days</option>
                        <option value={5}>5 days</option>
                        <option value={7}>7 days</option>
                      </select>
                      <button
                        onClick={() => {
                          appendUserMessage(`Shopping List ${shoppingDays} day`)
                          if (!state.currentPlan) {
                            const message = "You don't have an active plan yet, so there isn't a shopping list to generate."
                            respond(message)
                            return
                          }
                          const list = formatShoppingList(state.currentPlan, plannerData, shoppingDays)
                          appendSystemMessage(list)
                          respond("There’s your shopping list. Get that sorted and you’re set.")
                        }}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-semibold text-white sm:w-auto"
                        disabled={!state.currentPlan}
                      >
                        <ShoppingBag className="h-4 w-4" />
                        Generate Shopping List
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/12 bg-[rgba(255,255,255,0.06)] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-[20px]">
                <div className="mb-4 flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-[rgba(255,255,255,0.8)]" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(255,255,255,0.72)]">Conversation</p>
                    <p className="mt-1 text-sm text-[rgba(255,255,255,0.7)]">Your chat and action history stays here.</p>
                  </div>
                </div>

                <div
                  ref={chatScrollRef}
                  className="h-[360px] space-y-3 overflow-x-hidden overflow-y-auto rounded-[22px] border border-white/12 bg-[rgba(255,255,255,0.04)] p-3 sm:h-[440px]"
                >
                  {state.messages.map((message) => {
                    const isUser = message.role === "user"
                    const isSystem = message.role === "system"
                    return (
                      <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-full whitespace-pre-wrap break-words rounded-[20px] px-4 py-3 text-sm leading-6 shadow-[0_10px_25px_rgba(0,0,0,0.18)] sm:max-w-[90%] ${
                            isUser
                              ? "border border-[rgba(127,214,255,0.28)] bg-[rgba(77,163,255,0.22)] text-white"
                              : isSystem
                                ? "border border-white/10 bg-[rgba(9,16,30,0.72)] text-[rgba(255,255,255,0.8)]"
                                : "border border-white/12 bg-[rgba(255,255,255,0.07)] text-white"
                          }`}
                        >
                          {message.content}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={resetGoalsAndStats}
                className="w-full rounded-[22px] border border-white/12 bg-[rgba(255,255,255,0.05)] px-4 py-3 text-sm font-semibold text-white backdrop-blur-[20px]"
              >
                Reset
              </button>
            </div>

            {error ? <p className="mt-4 text-sm text-[#ff8892]">{error}</p> : null}

            {showSetupModal ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[32px] bg-[rgba(2,5,12,0.76)] p-4 backdrop-blur-sm">
                <div className="w-full max-w-2xl rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(11,18,32,0.9),rgba(15,31,58,0.82))] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.4),0_0_30px_rgba(77,163,255,0.22)] backdrop-blur-[20px] sm:p-6">
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgba(255,255,255,0.72)]">Quick setup</p>
                    <h2 className="mt-1 text-2xl font-semibold text-white">Set your targets</h2>
                    <p className="mt-1 text-sm text-[rgba(255,255,255,0.7)]">Fast profile setup so George can coach you properly.</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm text-white">Goal
                      <select value={setupForm.goal} onChange={(e) => setSetupForm((prev) => ({ ...prev, goal: e.target.value as Goal }))} className="mt-1 w-full rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-3 py-3 text-white">
                        <option value="lose-fat">Lose fat</option>
                        <option value="recomp">Recomp</option>
                        <option value="gain-muscle">Gain muscle</option>
                      </select>
                    </label>
                    <label className="text-sm text-white">Gender
                      <select value={setupForm.sex} onChange={(e) => setSetupForm((prev) => ({ ...prev, sex: e.target.value as Sex }))} className="mt-1 w-full rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-3 py-3 text-white">
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </label>
                    <label className="text-sm text-white">Age
                      <input value={setupForm.age} onChange={(e) => setSetupForm((prev) => ({ ...prev, age: e.target.value }))} type="number" min={13} max={95} className="mt-1 w-full rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-3 py-3 text-white" />
                    </label>
                    <label className="text-sm text-white">Height (cm)
                      <input value={setupForm.heightCm} onChange={(e) => setSetupForm((prev) => ({ ...prev, heightCm: e.target.value }))} type="number" min={120} max={230} className="mt-1 w-full rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-3 py-3 text-white" />
                    </label>
                    <label className="text-sm text-white">Current weight (kg)
                      <input value={setupForm.currentWeightKg} onChange={(e) => setSetupForm((prev) => ({ ...prev, currentWeightKg: e.target.value }))} type="number" min={35} max={350} step="0.1" className="mt-1 w-full rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-3 py-3 text-white" />
                    </label>
                    <label className="text-sm text-white">Activity level
                      <select value={setupForm.activityLevel} onChange={(e) => setSetupForm((prev) => ({ ...prev, activityLevel: e.target.value as ActivityLevel }))} className="mt-1 w-full rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-3 py-3 text-white">
                        <option value="sedentary">Sedentary</option>
                        <option value="light">Light</option>
                        <option value="moderate">Moderate</option>
                        <option value="active">Active</option>
                        <option value="very-active">Very active</option>
                      </select>
                    </label>
                    <label className="text-sm text-white">Allergies
                      <input value={setupForm.allergies} onChange={(e) => setSetupForm((prev) => ({ ...prev, allergies: e.target.value }))} placeholder="e.g. nuts, shellfish or none" className="mt-1 w-full rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-3 py-3 text-white placeholder:text-[rgba(255,255,255,0.45)]" />
                    </label>
                    <label className="text-sm text-white">Disliked foods
                      <input value={setupForm.dislikedFoods} onChange={(e) => setSetupForm((prev) => ({ ...prev, dislikedFoods: e.target.value }))} placeholder="e.g. mushrooms, olives or none" className="mt-1 w-full rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-3 py-3 text-white placeholder:text-[rgba(255,255,255,0.45)]" />
                    </label>
                    <label className="text-sm text-white">Meals per day
                      <select value={setupForm.mealsPerDay} onChange={(e) => setSetupForm((prev) => ({ ...prev, mealsPerDay: e.target.value as "3" | "4" | "5" }))} className="mt-1 w-full rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-3 py-3 text-white">
                        <option value="3">3 meals</option>
                        <option value="4">4 meals</option>
                        <option value="5">5 meals</option>
                      </select>
                    </label>
                    <label className="text-sm text-white">Dietary preference
                      <select value={setupForm.dietaryPreference} onChange={(e) => setSetupForm((prev) => ({ ...prev, dietaryPreference: e.target.value as DietaryPreference }))} className="mt-1 w-full rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-3 py-3 text-white">
                        <option value="omnivore">Standard</option>
                        <option value="vegetarian">Vegetarian</option>
                        <option value="pescatarian">Pescatarian</option>
                        <option value="vegan">Vegan</option>
                      </select>
                    </label>
                    <label className="text-sm text-white">Plan mode
                      <select value={setupForm.planMode} onChange={(e) => setSetupForm((prev) => ({ ...prev, planMode: e.target.value as PlanMode }))} className="mt-1 w-full rounded-2xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-3 py-3 text-white">
                        <option value="flexible">Flexible</option>
                        <option value="balanced">Balanced</option>
                        <option value="performance">Performance</option>
                      </select>
                    </label>
                  </div>

                  <button onClick={saveTargetsFromSetup} className="mt-5 w-full rounded-[22px] border border-[rgba(127,214,255,0.44)] bg-[linear-gradient(180deg,rgba(77,163,255,0.34),rgba(77,163,255,0.18))] px-4 py-3 font-semibold text-white shadow-[0_0_30px_rgba(77,163,255,0.35)]">
                    Save Targets
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )

}
