"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Flame, Loader2, MessageSquareText, Mic, RefreshCcw, ShoppingBag, UtensilsCrossed } from "lucide-react"
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

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    hydratedRef.current = hydrated
  }, [hydrated])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(SESSION_KEY)
      if (!raw) return
      const stored = JSON.parse(raw) as CoachState
      const hasProfile = Boolean(stored.profileComplete && stored.profile)

      if (!hasProfile) {
        setState({ ...INITIAL_STATE, messages: trimMessagesForStorage(stored.messages || INITIAL_MESSAGES) })
        return
      }

      const nextStreak = computeNextStreak(stored.lastActiveDate, stored.stats?.dayStreak || 0)
      const restoredMessages = trimMessagesForStorage(stored.messages || INITIAL_MESSAGES)

      const calculated = buildTargetsAndStats(stored.profile as Profile, nextStreak)
      setState({
        ...INITIAL_STATE,
        ...stored,
        profile: stored.profile,
        profileComplete: true,
        targets: calculated.targets,
        stats: calculated.stats,
        weightInput: String((stored.profile as Profile).currentWeightKg || ""),
        currentPlan: stored.currentPlan || null,
        latestPlan: stored.latestPlan || null,
        messages: restoredMessages,
      })
      setSetupForm({
        goal: (stored.profile as Profile).goal,
        sex: (stored.profile as Profile).sex,
        age: String((stored.profile as Profile).age),
        heightCm: String((stored.profile as Profile).heightCm),
        currentWeightKg: String((stored.profile as Profile).currentWeightKg),
        activityLevel: (stored.profile as Profile).activityLevel,
        allergies: (stored.profile as Profile).allergies.join(", "),
        dislikedFoods: (stored.profile as Profile).dislikedFoods.join(", "),
        mealsPerDay: String((stored.profile as Profile).mealsPerDay) as "3" | "4" | "5",
        dietaryPreference: (stored.profile as Profile).dietaryPreference,
        planMode: ((((stored.profile as Profile).planMode === "higher-carb") ? "flexible" : ((stored.profile as Profile).planMode === "lower-carb") ? "performance" : (stored.profile as Profile).planMode) || "balanced") as PlanMode,
      })
    } catch {
      // ignore corrupted storage
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      const payload: CoachState = {
        ...state,
        messages: trimMessagesForStorage(state.messages),
        lastActiveDate: toIsoDate(new Date()),
      }
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
    } catch {
      // ignore
    }
  }, [hydrated, state])

  useEffect(() => {
    return () => {
      void cleanupConversation()
    }
  }, [])

  useEffect(() => {
    if (!chatScrollRef.current) return
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [state.messages])


  useEffect(() => {
    liveStateRef.current = state
    profileRef.current = state.profile
    targetsRef.current = state.targets
    currentPlanRef.current = state.currentPlan
    profileCompleteRef.current = state.profileComplete
  }, [state])

  useEffect(() => {
    plannerDataRef.current = plannerData
  }, [plannerData])

  useEffect(() => {
    const mealCount = state.profile?.mealsPerDay || state.currentPlan?.plan.length || 3
    if (selectedSwapMeal > Math.max(0, mealCount - 1)) {
      setSelectedSwapMeal(Math.max(0, mealCount - 1))
    }
  }, [selectedSwapMeal, state.currentPlan, state.profile])


function formatTargetsForSpeech(targets: Nutrition) {
  return `${targets.calories} calories, ${targets.protein} grams of protein, ${targets.carbs} grams of carbs, and ${targets.fat} grams of fats`
}

function summarizeMeals(result: MealPlanResult) {
  return result.plan
    .map((meal, index) => `${index + 1}. ${meal.name}`)
    .join(". ")
}

function summarizePlan(plan: MealPlanResult) {
  return `You’ve got ${plan.plan.length} meals today — ${plan.plan.map((meal) => meal.name).join(", ")}. Want the full breakdown or change something?`
}

function getReturningUserPrompt(snapshot = getLiveCoachStateSnapshot(liveStateRef.current, plannerDataRef.current)) {
  if (!snapshot.profileComplete || !snapshot.profile) {
    return "Complete the setup form first and we’ll get you moving properly."
  }

  if (snapshot.currentPlan) {
    return "You’ve already got structure in place. Check your plan and we’ll tighten anything that needs work."
  }

  return "You’re set — hit Build Plan and it’ll show up. Once it’s there, we’ll tighten it up if needed."
}

function controlledFallback(plan: MealPlanResult | null) {
  return plan
    ? "You’ve already got a plan in place. Check it through and we’ll adjust anything that needs work."
    : "You’re set — hit Build Plan and it’ll show up. After that, we’ll shape it properly."
}

function buildWorkoutResponse(text: string) {
  const lower = normalizeTranscriptForIntent(text)

  if (!workoutProfileRef.current) {
    if (pendingWorkoutQuestionRef.current === "experience") {
      const match = lower.match(/beginner|intermediate|advanced/)
      if (match) {
        workoutProfileRef.current = { experience: match[0] as WorkoutExperience, goal: "fat-loss" }
        pendingWorkoutQuestionRef.current = "goal"
        return "Good — and what’s the goal with training: fat loss, muscle, or something sport-specific?"
      }
    }

    if (pendingWorkoutQuestionRef.current === "goal") {
      if (/fat loss|muscle|sport/.test(lower) && workoutProfileRef.current) {
        workoutProfileRef.current = {
          ...workoutProfileRef.current,
          goal: /muscle/.test(lower) ? "muscle" : /sport/.test(lower) ? "sport-specific" : "fat-loss",
        }
        pendingWorkoutQuestionRef.current = null
      }
    }

    if (!workoutProfileRef.current || pendingWorkoutQuestionRef.current) {
      pendingWorkoutQuestionRef.current = "experience"
      return "Before we set training up properly, are you beginner, intermediate, or advanced?"
    }
  }

  const workoutProfile = workoutProfileRef.current || { experience: "beginner" as WorkoutExperience, goal: "fat-loss" as WorkoutGoal }
  const boxing = /boxing|bag|shadow|pad|spar/.test(lower)
  const home = /home|at home/.test(lower)
  const gym = /gym/.test(lower)

  if (boxing || workoutProfile.goal === "sport-specific") {
    return home
      ? "Perfect — let’s keep it sharp. Do 5 minutes of skipping or fast feet, then 6 rounds of 2 minutes shadowboxing or bag work with 1 minute rest, then 3 rounds of 10 push ups, 12 rows, and a 30 second plank. Are you training now or planning ahead?"
      : "Perfect — let’s get a proper boxing session in. Start with a 5 minute warm up, then 8 rounds of 2 minutes on the bag with 1 minute rest, then 3 rounds of 8 goblet squats, 10 push ups, and 12 rows. Are you training now or later?"
  }

  if (workoutProfile.goal === "muscle") {
    return gym
      ? "Perfect — let’s get a solid muscle session in. Do 4 sets of 8 leg press, 4 sets of 8 chest press, 4 sets of 10 lat pulldowns, 3 sets of 10 shoulder press, then 8 minutes incline walk. Are you training now or planning ahead?"
      : "Perfect — keep it simple at home. Run 4 rounds of 12 goblet squats, 10 push ups, 12 one arm rows each side, 15 kettlebell swings, and a 40 second plank. Want another session after this one?"
  }

  return home
    ? "Perfect — here’s a simple home fat loss session: 5 rounds of 12 squats, 10 push ups, 12 rows, 15 swings, and 45 seconds brisk marching or step ups. Keep it controlled and keep moving. Want a gym version too?"
    : "Perfect — let’s get you training. Do 4 rounds of 10 leg press, 10 chest press, 10 rows, 12 walking lunges, then 10 minutes steady cardio. Keep the pace up and push yourself. Are you training now or planning ahead?"
}

function buildDailyCoachingResponse(text: string) {
  const lower = normalizeTranscriptForIntent(text)
  if (/fell off|messed up|ate badly|off plan|binged/.test(lower)) {
    sessionPatternRef.current.fallsOff += 1
    const nudge = sessionPatternRef.current.fallsOff >= 2 ? " Looks like consistency’s been tricky — want me to simplify your plan a bit?" : ""
    return `No problem — get straight back on plan next meal and keep it simple. Don’t try to overcorrect.${nudge}`
  }

  if (/eating out|restaurant|takeaway|ordered out/.test(lower)) {
    return "That’s fine — just steady the rest of the day. Keep the next meals lighter, keep protein high, and move on."
  }

  if (/skip/.test(lower)) {
    sessionPatternRef.current.skippedMeals += 1
    const nudge = sessionPatternRef.current.skippedMeals >= 2 ? " If meals keep getting missed, I can simplify the plan a bit." : ""
    return `No problem — just nail the next meal and keep protein high.${nudge}`
  }

  return "Keep it simple — stay close to plan, keep protein high, and focus on the next good decision. Want me to sort training next?"
}

  function findSwapTarget(text: string, plan: MealPlanResult) {
    const lower = normalizeTranscriptForIntent(text)
    const directIndex = getMealIndexFromInput(lower, plan.plan.length)
    if (directIndex !== null) return directIndex

    const mealNumberMatch = lower.match(/(?:swap|change|replace)\s+(?:meal\s+)?(\d+)/)
    if (mealNumberMatch) {
      const index = Number(mealNumberMatch[1]) - 1
      if (index >= 0 && index < plan.plan.length) return index
    }

    const mealTypeMap: Array<{ pattern: RegExp; index: number | null }> = [
      { pattern: /breakfast/, index: plan.plan.findIndex((meal) => meal.mealType === "breakfast") },
      { pattern: /lunch/, index: plan.plan.findIndex((meal) => meal.mealType === "lunch") },
      { pattern: /dinner/, index: plan.plan.findIndex((meal) => meal.mealType === "dinner") },
      { pattern: /snack/, index: plan.plan.findIndex((meal) => meal.mealType === "snack") },
    ]

    for (const entry of mealTypeMap) {
      if (entry.pattern.test(lower) && entry.index !== null && entry.index >= 0) return entry.index
    }

    const namedIndex = plan.plan.findIndex((meal) => lower.includes(normalizeTranscriptForIntent(meal.name)))
    return namedIndex >= 0 ? namedIndex : null
  }

  function selectReplacementMeal(profile: Profile, plan: MealPlanResult, targetIndex: number, requestText: string) {
    const currentMeal = plan.plan[targetIndex]
    const usedIds = new Set(plan.plan.map((meal) => meal.id))
    const requestLower = normalizeText(requestText)
    const blockedTerms = profile.dislikedFoods.map((item) => normalizeText(item)).filter(Boolean)

    const candidatePool = plannerDataRef.current.recipes
      .filter((recipe) => recipe.id !== currentMeal.id)
      .filter((recipe) => recipe.mealType === currentMeal.mealType)
      .filter((recipe) => recipe.dietary.includes(profile.dietaryPreference))
      .map((recipe) => ({ ...recipe, nutrition: getRecipeNutrition(recipe, plannerDataRef.current.foods) }))
      .filter((recipe) => recipe.ingredients.every((ingredient) => {
        const food = plannerDataRef.current.foods.find((entry) => entry.id === ingredient.foodId)
        if (!food) return false
        const lowerName = normalizeText(food.name)
        const blockedByDislike = blockedTerms.some((item) => lowerName.includes(item))
        const blockedByAllergen = food.allergens.some((allergen) => profile.allergies.includes(allergen.toLowerCase()))
        return !blockedByDislike && !blockedByAllergen
      }))
      .filter((recipe) => !usedIds.has(recipe.id) || recipe.id === currentMeal.id)

    const scored = candidatePool
      .map((candidate) => {
        const calorieGap = Math.abs(candidate.nutrition.calories - currentMeal.nutrition.calories)
        const proteinDelta = candidate.nutrition.protein - currentMeal.nutrition.protein
        const carbGap = Math.abs(candidate.nutrition.carbs - currentMeal.nutrition.carbs)
        const fatGap = Math.abs(candidate.nutrition.fat - currentMeal.nutrition.fat)
        const avoidDuplicatePenalty = usedIds.has(candidate.id) ? 250 : 0
        const requestPenalty = requestLower.includes("don t like") || requestLower.includes("dont like") || requestLower.includes("replace") ? 0 : 0
        const score =
          calorieGap * 1.2 +
          carbGap * 0.8 +
          fatGap * 0.5 +
          Math.max(0, -proteinDelta) * 6 -
          Math.max(0, proteinDelta) * 3 +
          avoidDuplicatePenalty +
          requestPenalty
        return { candidate, score }
      })
      .sort((a, b) => a.score - b.score)

    return scored[0]?.candidate ?? null
  }

  function calculateSwapValidationScore(totals: Nutrition, targets: Nutrition) {
    const calorieTolerance = Math.max(40, Math.round(targets.calories * 0.02))
    const calorieMiss = Math.max(0, Math.abs(totals.calories - targets.calories) - calorieTolerance)
    const proteinMiss = Math.max(0, targets.protein * 0.95 - totals.protein)
    const carbMiss = Math.max(0, Math.abs(totals.carbs - targets.carbs) - Math.max(20, Math.round(targets.carbs * 0.12)))
    const fatMiss = Math.max(0, Math.abs(totals.fat - targets.fat) - Math.max(10, Math.round(targets.fat * 0.12)))
    return calorieMiss * 8 + proteinMiss * 16 + carbMiss * 4 + fatMiss * 5
  }

  function buildValidatedSwapPlan(profile: Profile, plan: MealPlanResult, targetIndex: number, requestText: string) {
    const currentMeal = plan.plan[targetIndex]
    const usedIds = new Set(plan.plan.map((meal) => meal.id))
    const blockedTerms = profile.dislikedFoods.map((item) => normalizeText(item)).filter(Boolean)
    const targetTotals = plan.targets

    const candidatePool = plannerDataRef.current.recipes
      .filter((recipe) => recipe.id !== currentMeal.id)
      .filter((recipe) => recipe.mealType === currentMeal.mealType)
      .filter((recipe) => recipe.dietary.includes(profile.dietaryPreference))
      .map((recipe) => ({ ...recipe, nutrition: getRecipeNutrition(recipe, plannerDataRef.current.foods) }))
      .filter((recipe) => recipe.ingredients.every((ingredient) => {
        const food = plannerDataRef.current.foods.find((entry) => entry.id === ingredient.foodId)
        if (!food) return false
        const lowerName = normalizeText(food.name)
        const blockedByDislike = blockedTerms.some((item) => lowerName.includes(item))
        const blockedByAllergen = food.allergens.some((allergen) => profile.allergies.includes(allergen.toLowerCase()))
        return !blockedByDislike && !blockedByAllergen
      }))
      .filter((recipe) => !usedIds.has(recipe.id))

    let best: { plan: MealPlanResult; replacementName: string; score: number; valid: boolean } | null = null

    for (const candidate of candidatePool) {
      const baseCalories = Math.max(1, candidate.nutrition.calories)
      const targetMealCalories = Math.max(1, currentMeal.nutrition.calories)
      const preferredScale = Math.max(0.8, Math.min(1.55, targetMealCalories / baseCalories))

      for (const adjustment of [-0.12, -0.06, 0, 0.06, 0.12]) {
        const scale = Math.max(0.78, Math.min(1.7, preferredScale + adjustment))
        const updatedMeal = {
          ...candidate,
          servingMultiplier: Number(scale.toFixed(2)),
          nutrition: {
            calories: Math.round(candidate.nutrition.calories * scale),
            protein: Math.round(candidate.nutrition.protein * scale),
            carbs: Math.round(candidate.nutrition.carbs * scale),
            fat: Math.round(candidate.nutrition.fat * scale),
          },
          ingredients: candidate.ingredients.map((ingredient) => ({
            ...ingredient,
            grams: Math.round(ingredient.grams * scale),
          })),
        }

        const nextMeals = plan.plan.map((meal, index) => (index === targetIndex ? updatedMeal : meal))
        const nextTotals = sumPlanNutrition(nextMeals)
        const score = calculateSwapValidationScore(nextTotals, targetTotals)
        const valid = Math.abs(nextTotals.calories - targetTotals.calories) <= Math.max(40, Math.round(targetTotals.calories * 0.02)) && nextTotals.protein >= targetTotals.protein * 0.95
        const nextPlan: MealPlanResult = { ...plan, plan: nextMeals, totals: nextTotals }

        if (!best || score < best.score || (valid && !best.valid)) {
          best = { plan: nextPlan, replacementName: candidate.name, score, valid }
        }
      }
    }

    return best
  }

  function buildConnectedGeorgeInstructions() {
    return buildVoiceRendererInstructions()
  }

  function syncGeorgeContext() {
    const channel = dcRef.current
    if (!channel || channel.readyState !== "open") return
    const payload = { type: "session.update", session: buildRealtimeSessionPayload(buildConnectedGeorgeInstructions()) }
    console.debug("[George realtime] session.update", payload)
    channel.send(JSON.stringify(payload))
  }

  function respondFromState(text: string) {
    respond(text)
  }

  function detectShoppingListDays(text: string) {
    const match = text.match(/\b(1|3|5|7)\s*day/)
    if (match) return Number(match[1]) as 1 | 3 | 5 | 7
    return null
  }

  function appendOrUpdateAssistantPartial(delta: string, isFinal = false) {
    if (!delta) return

    if (!currentAssistantMessageIdRef.current) {
      const message = makeMessage("assistant", delta)
      currentAssistantMessageIdRef.current = message.id
      currentAssistantTextRef.current = delta
      setState((prev) => ({ ...prev, messages: [...prev.messages, message] }))
      if (isFinal) {
        currentAssistantMessageIdRef.current = null
        currentAssistantTextRef.current = ""
      }
      return
    }

    currentAssistantTextRef.current += delta
    const targetId = currentAssistantMessageIdRef.current
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((message) => (message.id === targetId ? { ...message, content: currentAssistantTextRef.current } : message)),
    }))

    if (isFinal) {
      currentAssistantMessageIdRef.current = null
      currentAssistantTextRef.current = ""
    }
  }

  function computePlanForProfile(profile: Profile) {
    return buildMealPlan(profile, plannerData)
  }

  function applyComputedPlan(result: MealPlanResult) {
    const planText = formatComputedPlan(result, plannerDataRef.current)
    currentPlanRef.current = result
    setState((prev) => ({
      ...prev,
      currentPlan: result,
      latestPlan: planText,
    }))
    appendSystemMessage(planText)
    respond("Nice — your plan’s ready. Take a look through it. Next step — we’ll either tweak meals or get your training sorted.")
  }


function handleUserInput(text: string) {
  if (!hydratedRef.current) return
  const cleaned = text.trim()
  if (!cleaned) return
  appendUserMessage(cleaned)

  const normalized = normalizeTranscriptForIntent(cleaned)
  const lastHandled = lastHandledInputRef.current
  if (lastHandled && lastHandled.normalized === normalized && Date.now() - lastHandled.at < 1500) {
    return
  }
  lastHandledInputRef.current = { normalized, at: Date.now() }

  const profile = profileRef.current
  const targets = targetsRef.current
  const plan = currentPlanRef.current
  const hasProfile = Boolean(profile && profileCompleteRef.current)

  if (pendingWorkoutPromptRef.current === "type" && isLikelyWorkoutFollowUp(normalized)) {
    pendingWorkoutPromptRef.current = null
    lastIntentRef.current = "workout"
    respond(buildWorkoutReply(normalized))
    return
  }

  const intent = detectIntent(normalized, { hasPlan: Boolean(plan), lastIntent: lastIntentRef.current })
  if (intent === "no_response") return
  lastIntentRef.current = intent === "unknown" ? lastIntentRef.current : intent

  switch (intent) {
    case "show_plan":
      if (!plan) {
        respond("No plan there yet — hit Build Plan and it’ll show up. Once it’s there, we’ll tighten it up if needed.")
        return
      }
      respond("Your full plan is in the plan section now. Take a look through it, then we’ll adjust anything that needs work.")
      return
    case "show_targets":
      if (!targets || !targets.calories) {
        respond("Your targets aren’t ready yet. Finish setup first and then we’ll get everything lined up properly.")
        return
      }
      respond(`You’re currently set at ${targets.calories} calories, ${targets.protein} grams of protein, ${targets.carbs} grams of carbs, and ${targets.fat} grams of fats. That gives us a clear target to work from.`)
      return
    case "build_plan":
      if (!hasProfile || !profile || !targets || !targets.calories) {
        respond("Complete setup first and we’ll get you moving properly from there.")
        return
      }
      respond("Hit Build Plan and it’ll show up. Once it’s there, we’ll tighten it up and keep it practical.")
      return
    case "swap_meal":
      if (!plan) {
        respond("You need a plan in place first. Hit Build Plan, then use Swap Meal and we’ll tidy it up from there.")
        return
      }
      {
        const targetIndex = getMealIndexFromInput(normalized, plan.plan.length) ?? findSwapTarget(normalized, plan)
        if (targetIndex !== null) {
          setSelectedSwapMeal(targetIndex)
        }
        respond(targetIndex === null ? "Yeah — use Swap Meal and pick the one you want to change. We’ll keep it high protein and on track." : `Yeah — swap Meal ${targetIndex + 1} using the Swap Meal button. That’ll update it straight away, then we’ll check it over.`)
        return
      }
    case "shopping_list":
      if (!plan) {
        respond("You need a plan there first. Hit Build Plan, then set your days and generate the shopping list.")
        return
      }
      {
        const detectedDays = detectShoppingListDays(normalized)
        if (detectedDays) setShoppingDays(detectedDays)
        respond("Set how many days you want, then generate your shopping list. Once that’s done, you’re organised for the week.")
        return
      }
    case "update_weight":
      if (!hasProfile) {
        respond("Finish setup first, then use Update Weight when your weight changes. That keeps your targets accurate.")
        return
      }
      respond("Use Update Weight and your targets will adjust straight away. Once that’s done, we’ll make sure the setup still looks right.")
      return
    case "workout":
      if (normalized.includes("workout plan")) {
        respond("No — that’s your meal plan. For training, tell me home, gym, boxing, push, pull, or legs and I’ll set it up simply.")
        pendingWorkoutPromptRef.current = "type"
        return
      }
      if (isLikelyWorkoutFollowUp(normalized)) {
        pendingWorkoutPromptRef.current = null
        respond(buildWorkoutReply(normalized))
        return
      }
      pendingWorkoutPromptRef.current = "type"
      respond("Perfect — let’s get you training. What are you doing today: home, gym, boxing, push, pull, or legs?")
      return
    case "eating_out":
      respond("That’s fine — keep the next meals lighter, keep protein high, and move straight back onto plan. Next step — steady the rest of the day.")
      return
    case "off_plan":
      respond("No problem — get straight back on plan next meal. Don’t overcorrect. Just tighten the next decision and move on.")
      return
    case "motivation":
      respond("Keep it simple — win the next meal or the next workout. That’s enough for today. Pick one now and do it properly.")
      return
    case "unknown":
    default:
      if (normalized.includes("chicken") || normalized.includes("bored") || normalized.includes("same food") || normalized.includes("everything is chicken") || normalized.includes("repetitive")) {
        respond("Yeah — fair, we’ll mix that up. We can rotate beef, turkey, eggs, fish, or yogurt and keep the same structure. If you want a change, use Swap Meal and we’ll start with one meal at a time.")
        return
      }
      if (normalized.includes("can t see") || normalized.includes("cant see") || normalized.includes("not showing") || normalized.includes("isn t showing") || normalized.includes("isnt showing")) {
        respond("It should be in the plan section above. If it still isn’t there, hit Build Plan again and it should load properly. Once it’s there, we’ll tighten it up if needed.")
        return
      }
      if (pendingWorkoutPromptRef.current === "type") {
        respond("Tell me whether you want home, gym, boxing, push, pull, or legs, and I’ll keep it simple.")
        return
      }
      respond(controlledFallback(plan))
      return
  }
}

  function handleRealtimeEvent(event: any) {
    const type = event?.type
    if (!type) return

    if (/^session\./.test(type) || /^response\./.test(type)) {
      console.debug("[George realtime event]", type, event)
    }

    switch (type) {
      case "session.created":
      case "session.updated":
      case "response.created":
      case "response.done":
        return
      case "conversation.item.input_audio_transcription.completed":
        handleUserInput(typeof event.transcript === "string" ? event.transcript : "")
        return
      case "error":
        console.error("[George realtime error]", event)
        setError(event?.error?.message || "George hit a voice error.")
        return
      default:
        return
    }
  }

  useEffect(() => {
    if (connectionState !== "connected") return
    syncGeorgeContext()
  }, [connectionState, state.profile, state.profileComplete, state.targets, state.currentPlan, plannerData])

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
  }

  async function startConversation() {
    if (!hydratedRef.current || !canStart) return
    greetedSessionRef.current = false
    await cleanupConversation()
    setConnectionState("connecting")
    setError(null)

    try {
      const tokenResponse = await fetch("/api/george-session", { method: "GET", cache: "no-store" })
      const tokenData = await tokenResponse.json().catch(() => null)
      if (!tokenResponse.ok) throw new Error(tokenData?.error || "Could not create a secure live session.")

      const ephemeralKey = tokenData?.value || tokenData?.client_secret?.value
      if (!ephemeralKey) throw new Error("Live voice token was missing.")

      const pc = new RTCPeerConnection()
      pcRef.current = pc

      const remoteAudio = document.createElement("audio")
      remoteAudio.autoplay = true
      remoteAudio.playsInline = true
      remoteAudio.preload = "auto"
      remoteAudio.style.display = "none"
      document.body.appendChild(remoteAudio)
      audioRef.current = remoteAudio

      pc.ontrack = (event) => {
        console.debug("[George realtime] audio track received", event)
        const [remoteStream] = event.streams
        if (remoteStream) {
          remoteAudio.srcObject = remoteStream
          void remoteAudio.play().then(() => console.debug("[George realtime] playback started")).catch((error) => {
            console.error("[George realtime] playback blocked", error)
            setError("George audio was returned but playback was blocked by the browser.")
          })
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      const dataChannel = pc.createDataChannel("oai-events")
      dcRef.current = dataChannel
      dataChannel.addEventListener("open", () => {
        const snapshot = getLiveCoachStateSnapshot(liveStateRef.current, plannerDataRef.current)
        if (!hydratedRef.current) {
          console.warn("[George realtime] data channel opened before hydration completed")
          return
        }
        profileRef.current = snapshot.profile
        targetsRef.current = snapshot.targets
        currentPlanRef.current = snapshot.currentPlan
        profileCompleteRef.current = snapshot.profileComplete
        setConnectionState("connected")
        const payload = { type: "session.update", session: buildRealtimeSessionPayload(buildConnectedGeorgeInstructions()) }
        console.debug("[George realtime] session.update on open", payload)
        dataChannel.send(JSON.stringify(payload))
        if (snapshot.profileComplete && snapshot.profile && !greetedSessionRef.current) {
          greetedSessionRef.current = true
          respond(getReturningUserPrompt(snapshot))
        }
      })

      dataChannel.addEventListener("message", (event) => {
        try {
          handleRealtimeEvent(JSON.parse(event.data))
        } catch {
          // ignore bad payloads
        }
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${ephemeralKey}`, "Content-Type": "application/sdp" },
        body: offer.sdp,
      })

      const answer = await sdpResponse.text()
      if (!sdpResponse.ok) throw new Error(answer || "Could not connect George.")

      await pc.setRemoteDescription({ type: "answer", sdp: answer })
      pc.addEventListener("connectionstatechange", () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) setConnectionState("error")
      })
    } catch (err) {
      await cleanupConversation()
      setConnectionState("error")
      setError(err instanceof Error ? err.message : "Could not connect George right now.")
    }
  }

  async function stopConversation() {
    greetedSessionRef.current = false
    await cleanupConversation()
    setError(null)
    setConnectionState("idle")
  }

  function saveTargetsFromSetup() {
    const age = Number(setupForm.age)
    const heightCm = Number(setupForm.heightCm)
    const currentWeightKg = Number(setupForm.currentWeightKg)

    if (!Number.isFinite(age) || age < 13 || age > 95) return setError("Please enter a valid age.")
    if (!Number.isFinite(heightCm) || heightCm < 120 || heightCm > 230) return setError("Please enter a valid height in cm.")
    if (!Number.isFinite(currentWeightKg) || currentWeightKg < 35 || currentWeightKg > 350) return setError("Please enter a valid current weight in kg.")

    setError(null)
    const dayStreak = state.stats.dayStreak > 0 ? state.stats.dayStreak : 1
    const profile: Profile = {
      goal: setupForm.goal,
      sex: setupForm.sex,
      age,
      heightCm,
      currentWeightKg,
      activityLevel: setupForm.activityLevel,
      allergies: parseListValue(setupForm.allergies),
      dislikedFoods: parseListValue(setupForm.dislikedFoods),
      mealsPerDay: Number(setupForm.mealsPerDay) as 3 | 4 | 5,
      dietaryPreference: setupForm.dietaryPreference,
      planMode: setupForm.planMode,
    }

    const calculated = buildTargetsAndStats(profile, dayStreak)
    const dietLabel = profile.dietaryPreference === "omnivore" ? "standard" : profile.dietaryPreference
    const summary = `Profile saved: goal ${profile.goal.replace("-", " ")}, ${profile.currentWeightKg}kg, ${profile.mealsPerDay} meals/day, ${dietLabel}.`
    const georgeLine = "Nice — I’ve got your targets set. I can build your plan now."

    profileRef.current = profile
    targetsRef.current = calculated.targets
    currentPlanRef.current = null
    profileCompleteRef.current = true
    setState((prev) => ({
      ...prev,
      profile,
      profileComplete: true,
      targets: calculated.targets,
      stats: calculated.stats,
      weightInput: String(profile.currentWeightKg),
      currentPlan: null,
      latestPlan: null,
    }))
    respond(`${formatTargetSummary(calculated.targets)}

${summary}

${georgeLine}`)
  }

  function buildMyPlan() {
    appendUserMessage("Build Plan")
    if (!state.profileComplete || !state.profile) {
      const gate = "Please complete setup first so I can build this correctly."
      respond(gate)
      return
    }

    const result = computePlanForProfile(state.profile)
    applyComputedPlan(result)
  }

  function updateWeight() {
    appendUserMessage("Update Weight")
    if (!state.profileComplete || !state.profile) {
      const gate = "Finish setup first — weight updates are for after setup."
      respond(gate)
      return
    }

    const value = Number(state.weightInput)
    if (!Number.isFinite(value) || value < 35 || value > 350) {
      setError("Please enter a valid weight in kg.")
      return
    }

    setError(null)
    const nextProfile: Profile = { ...state.profile, currentWeightKg: value }
    const calculated = buildTargetsAndStats(nextProfile, state.stats.dayStreak || 1)
    const targetLine = `Weight updated to ${value}kg. ${formatTargetSummary(calculated.targets)}`
    const confirm = "Done — your weight and targets are updated."

    profileRef.current = nextProfile
    targetsRef.current = calculated.targets
    currentPlanRef.current = null
    profileCompleteRef.current = true
    setState((prev) => ({
      ...prev,
      profile: nextProfile,
      targets: calculated.targets,
      stats: calculated.stats,
      currentPlan: null,
      latestPlan: null,
    }))

    appendSystemMessage(targetLine)
    respond(confirm)
  }

  function swapSelectedMeal() {
    appendUserMessage(`Swap Meal ${selectedSwapMeal + 1}`)
    if (!state.profileComplete || !state.profile || !state.currentPlan) {
      respond("Build a plan first, then use Swap Meal and we’ll tighten it from there.")
      return
    }

    const swapResult = buildValidatedSwapPlan(state.profile, state.currentPlan, selectedSwapMeal, `swap meal ${selectedSwapMeal + 1}`)
    if (!swapResult || !swapResult.valid) {
      respond("That swap would throw the plan off a bit too much. Pick another one and we’ll keep it tighter.")
      return
    }

    sessionPatternRef.current.swaps += 1
    const planText = formatComputedPlan(swapResult.plan, plannerDataRef.current)
    currentPlanRef.current = swapResult.plan
    setState((prev) => ({
      ...prev,
      currentPlan: swapResult.plan,
      latestPlan: planText,
    }))
    appendSystemMessage(planText)
    respond("Done — that’s swapped. You’re still on track. Next step — check it over and we’ll adjust anything else if needed.")
  }

  function resetGoalsAndStats(announce = true) {
    appendUserMessage("Reset")
    const resetText = "Everything is cleared. Complete setup to continue."
    profileRef.current = null
    targetsRef.current = ZERO_TARGETS
    currentPlanRef.current = null
    profileCompleteRef.current = false
    setState({
      ...INITIAL_STATE,
      messages: announce ? [] : [makeMessage("assistant", resetText)],
    })
    setSetupForm(DEFAULT_SETUP_FORM)
    window.localStorage.removeItem(SESSION_KEY)
    setError(null)
    if (announce) respond(resetText)
  }

  return (
    <section
      className="relative overflow-x-hidden bg-[#0B1220] px-3 py-4 text-white sm:px-4 sm:py-8"
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
