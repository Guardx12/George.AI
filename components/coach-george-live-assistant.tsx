"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Flame, Loader2, MessageSquareText, Mic } from "lucide-react"
import {
  buildMealPlan,
  getDailyTargets,
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

function getPlannerSourceLabel(plannerData: PlannerPayload) {
  if (plannerData.source === "uploaded_csv") return "Uploaded CSV data"
  if (plannerData.source === "google_sheets") return "Live Google Sheets"
  return "Local fallback data"
}

function buildVoicePlannerSummary(plannerData: PlannerPayload) {
  const names = plannerData.recipes.slice(0, 12).map((recipe) => recipe.name).join(", ")
  return `Plan source: ${getPlannerSourceLabel(plannerData)}. ${plannerData.statusMessage} Available recipes include: ${names || "standard meals"}.`
}

function formatComputedPlan(result: MealPlanResult, plannerData: PlannerPayload) {
  const lines = [formatTargetSummary(result.targets), "", `Planned totals: ${result.totals.calories} kcal | Protein ${result.totals.protein}g | Carbs ${result.totals.carbs}g | Fats ${result.totals.fat}g.`, ""]

  result.plan.forEach((meal, index) => {
    lines.push(`Meal ${index + 1}: ${meal.name}${meal.servingMultiplier !== 1 ? ` (x${meal.servingMultiplier})` : ""}`)
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

export function CoachGeorgeLiveAssistant() {
  const [state, setState] = useState<CoachState>(INITIAL_STATE)
  const [setupForm, setSetupForm] = useState<SetupFormState>(DEFAULT_SETUP_FORM)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [plannerData, setPlannerData] = useState<PlannerPayload>(LOCAL_FALLBACK)
  const [plannerLoading, setPlannerLoading] = useState(true)

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

  const canStart = useMemo(() => connectionState === "idle" || connectionState === "error", [connectionState])
  const showSetupModal = !state.profileComplete
  const plannerSourceLabel = getPlannerSourceLabel(plannerData)

  const appendAssistantMessage = (content: string) => {
    setState((prev) => ({ ...prev, messages: [...prev.messages, makeMessage("assistant", content)] }))
  }

  const appendUserMessage = (content: string) => {
    setState((prev) => ({ ...prev, messages: [...prev.messages, makeMessage("user", content)] }))
  }

  const speakIfConnected = (instructions: string) => {
    const channel = dcRef.current
    if (!channel || channel.readyState !== "open") return
    channel.send(JSON.stringify({ type: "response.create", response: { instructions } }))
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
      const latestMessage = stored.messages?.[stored.messages.length - 1]?.content || ""
      const needsWelcomeBack = !latestMessage.toLowerCase().includes("welcome back")
      const restoredMessages = trimMessagesForStorage(stored.messages || [])

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
        messages: needsWelcomeBack
          ? [...restoredMessages, makeMessage("assistant", "Welcome back — ready to carry on?")]
          : restoredMessages,
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
        planMode: ((stored.profile as Profile).planMode || "balanced") as PlanMode,
      })
    } catch {
      // ignore corrupted storage
    }
  }, [])

  useEffect(() => {
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
  }, [state])

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
    profileRef.current = state.profile
    targetsRef.current = state.targets
    currentPlanRef.current = state.currentPlan
    profileCompleteRef.current = state.profileComplete
  }, [state.profile, state.targets, state.currentPlan, state.profileComplete])

  function formatTargetsForSpeech(targets: Nutrition) {
    return `${targets.calories} calories, ${targets.protein} grams of protein, ${targets.carbs} grams of carbs, and ${targets.fat} grams of fats`
  }

  function summarizeMeals(result: MealPlanResult) {
    return result.plan
      .map((meal, index) => `${index + 1}. ${meal.name}${meal.servingMultiplier !== 1 ? ` x${meal.servingMultiplier}` : ""}`)
      .join(". ")
  }

  function buildConnectedGeorgeInstructions() {
    const profile = profileRef.current
    const targets = targetsRef.current
    const currentPlan = currentPlanRef.current

    if (!profileCompleteRef.current || !profile) {
      return `You are Coach George. There is no saved profile yet. Ask the user to complete the on-screen setup form before you discuss targets or meal plans. Never ask for setup details if the app already has a saved profile. ${buildVoicePlannerSummary(plannerData)}`
    }

    const profileSummary = `Saved profile: sex ${profile.sex}, age ${profile.age}, height ${profile.heightCm}cm, weight ${profile.currentWeightKg}kg, goal ${profile.goal}, activity ${profile.activityLevel}, meals per day ${profile.mealsPerDay}, diet ${profile.dietaryPreference}, plan mode ${profile.planMode}.`
    const targetSummary = `Current targets: ${formatTargetsForSpeech(targets)}.`
    const planSummary = currentPlan
      ? `There is an active computed meal plan. Planned totals are ${formatTargetsForSpeech(currentPlan.totals)}. Meals are: ${summarizeMeals(currentPlan)}.`
      : 'There is no active computed meal plan yet.'

    return `You are Coach George. Act as the connected voice interface for the Coach George app, not as a separate chatbot. Never ask onboarding questions again when a saved profile exists. Never invent a separate meal plan. If the user asks about their targets or current plan, answer from the saved app state. If asked to build a new plan, the app will generate the real plan and you should then speak from that exact computed plan only. Keep spoken replies short, practical, and consistent with the app state. ${profileSummary} ${targetSummary} ${planSummary} ${buildVoicePlannerSummary(plannerData)}`
  }

  function syncGeorgeContext() {
    const channel = dcRef.current
    if (!channel || channel.readyState !== "open") return
    channel.send(JSON.stringify({ type: "session.update", session: { instructions: buildConnectedGeorgeInstructions() } }))
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

  function applyComputedPlan(result: MealPlanResult, leadMessage?: string) {
    const planText = formatComputedPlan(result, plannerData)
    const spoken = `${leadMessage ? `${leadMessage} ` : ""}I've built your plan. Your targets are ${formatTargetsForSpeech(result.targets)}. Planned totals are ${result.totals.calories} calories, ${result.totals.protein} grams of protein, ${result.totals.carbs} grams of carbs, and ${result.totals.fat} grams of fats. Your meals are ${summarizeMeals(result)}.`
    currentPlanRef.current = result
    setState((prev) => ({
      ...prev,
      currentPlan: result,
      latestPlan: planText,
      messages: [...prev.messages, makeMessage("assistant", planText), makeMessage("assistant", spoken)],
    }))
    speakIfConnected(`${spoken} Describe the meals exactly as shown on screen.`)
  }

  function handleUserTranscript(text: string) {
    const cleaned = text.trim()
    if (!cleaned) return
    appendUserMessage(cleaned)

    const lower = cleaned.toLowerCase()
    const savedProfile = profileRef.current
    const savedTargets = targetsRef.current
    const savedPlan = currentPlanRef.current
    const hasProfile = profileCompleteRef.current && Boolean(savedProfile)

    if (/\b(reset|start over|clear)\b/.test(lower)) {
      resetGoalsAndStats(false)
      return
    }

    if (!hasProfile || !savedProfile) {
      const setupPrompt = "You haven't finished setup yet. Complete the on-screen form first and then I can build your targets and meal plan properly."
      appendAssistantMessage(setupPrompt)
      speakIfConnected(setupPrompt)
      return
    }

    if (/\b(build|make|create|generate)\b.*\b(new )?\b(plan|meal plan)\b|\b(can i have a new plan)\b|\bmake my plan\b/.test(lower)) {
      const result = computePlanForProfile(savedProfile)
      applyComputedPlan(result, "Built from your latest saved targets.")
      return
    }

    if (/\bwhat (plan am i on|are my meals)\b|\bcurrent plan\b|\bmy plan\b/.test(lower)) {
      if (!savedPlan) {
        const noPlan = `You have a saved profile and targets, but no active meal plan yet. Your current targets are ${formatTargetsForSpeech(savedTargets)}. Say build me a new plan when you want me to generate it.`
        appendAssistantMessage(noPlan)
        speakIfConnected(noPlan)
        return
      }

      const planAnswer = `Your current plan is based on targets of ${formatTargetsForSpeech(savedPlan.targets)}. Planned totals are ${savedPlan.totals.calories} calories, ${savedPlan.totals.protein} grams of protein, ${savedPlan.totals.carbs} grams of carbs, and ${savedPlan.totals.fat} grams of fats. Your meals are ${summarizeMeals(savedPlan)}.`
      appendAssistantMessage(planAnswer)
      speakIfConnected(planAnswer)
      return
    }

    if (/\bwhat are my targets\b|\bmy targets\b|\bcurrent targets\b|\bcalories\b|\bprotein\b|\bcarbs\b|\bfats\b/.test(lower)) {
      const targetAnswer = `Your current targets are ${formatTargetsForSpeech(savedTargets)}.`
      appendAssistantMessage(targetAnswer)
      speakIfConnected(targetAnswer)
      return
    }

    syncGeorgeContext()
  }

  function handleRealtimeEvent(event: any) {
    const type = event?.type
    if (!type) return

    switch (type) {
      case "response.output_audio_transcript.delta":
        appendOrUpdateAssistantPartial(typeof event.delta === "string" ? event.delta : "")
        break
      case "response.output_audio_transcript.done":
        appendOrUpdateAssistantPartial(typeof event.transcript === "string" ? event.transcript : "", true)
        break
      case "conversation.item.input_audio_transcription.completed":
        handleUserTranscript(typeof event.transcript === "string" ? event.transcript : "")
        break
      case "response.output_item.done": {
        const content = Array.isArray(event?.item?.content) ? event.item.content : []
        const transcript = content
          .map((part: any) => {
            if (typeof part?.transcript === "string") return part.transcript
            if (typeof part?.text === "string") return part.text
            return ""
          })
          .filter(Boolean)
          .join("\n")
        if (transcript) appendOrUpdateAssistantPartial(transcript, true)
        break
      }
      case "error":
        setError(event?.error?.message || "George hit a voice error.")
        break
      default:
        break
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
    if (!canStart) return
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
      audioRef.current = remoteAudio

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams
        if (remoteStream) {
          remoteAudio.srcObject = remoteStream
          void remoteAudio.play().catch(() => {})
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      const dataChannel = pc.createDataChannel("oai-events")
      dcRef.current = dataChannel
      dataChannel.addEventListener("open", () => {
        setConnectionState("connected")
        dataChannel.send(JSON.stringify({ type: "session.update", session: { instructions: buildConnectedGeorgeInstructions() } }))
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
    const summary = `Profile saved: goal ${profile.goal.replace("-", " ")}, ${profile.currentWeightKg}kg, ${profile.mealsPerDay} meals/day, ${profile.dietaryPreference}.`
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
      messages: [...prev.messages, makeMessage("assistant", formatTargetSummary(calculated.targets)), makeMessage("assistant", summary), makeMessage("assistant", georgeLine)],
    }))
    speakIfConnected(georgeLine)
  }

  function buildMyPlan() {
    appendUserMessage("Build My Plan")
    if (!state.profileComplete || !state.profile) {
      const gate = "Please complete setup first so I can build this correctly."
      appendAssistantMessage(gate)
      speakIfConnected(gate)
      return
    }

    const result = computePlanForProfile(state.profile)
    applyComputedPlan(result)
  }

  function updateWeight() {
    appendUserMessage("Update Weight")
    if (!state.profileComplete || !state.profile) {
      const gate = "Finish setup first — weight updates are for after setup."
      appendAssistantMessage(gate)
      speakIfConnected(gate)
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
      messages: [...prev.messages, makeMessage("assistant", targetLine), makeMessage("assistant", confirm)],
    }))

    speakIfConnected(confirm)
  }

  function resetGoalsAndStats(announce = true) {
    appendUserMessage("Reset Goals & Stats")
    const resetLine = makeMessage("assistant", "Everything is cleared. Complete setup to continue.")
    profileRef.current = null
    targetsRef.current = ZERO_TARGETS
    currentPlanRef.current = null
    profileCompleteRef.current = false
    setState({
      ...INITIAL_STATE,
      messages: [resetLine],
    })
    setSetupForm(DEFAULT_SETUP_FORM)
    window.localStorage.removeItem(SESSION_KEY)
    setError(null)
    if (announce) speakIfConnected("I’ve reset everything. Complete your setup form when you’re ready.")
  }

  return (
    <section className="bg-[#060a12] px-3 py-4 text-white sm:px-4 sm:py-8">
      <div className="relative mx-auto w-full max-w-[860px] rounded-[28px] border border-white/10 bg-gradient-to-b from-[#101b31] via-[#0b1323] to-[#090f1a] p-4 shadow-[0_20px_100px_rgba(72,132,255,0.2)] sm:p-5">
        <div className="rounded-3xl border border-white/10 bg-[#0a1120]/90 p-4 shadow-[inset_0_0_40px_rgba(123,166,255,0.15)]">
          <button
            type="button"
            onClick={connectionState === "connected" ? stopConversation : startConversation}
            disabled={connectionState === "connecting"}
            className={`mx-auto flex h-[152px] w-[152px] items-center justify-center rounded-full border border-[#95bcff]/50 shadow-[0_0_40px_rgba(85,141,255,0.55)] transition ${connectionState === "connected" ? "animate-pulse" : ""}`}
            style={{ background: "radial-gradient(circle at 32% 26%, #3a5f98 0%, #1e3157 52%, #0d1a33 100%)" }}
          >
            {connectionState === "connecting" ? <Loader2 className="h-10 w-10 animate-spin" /> : <Mic className="h-10 w-10" />}
          </button>
          <p className="mt-3 text-center text-lg font-semibold">Tap to Talk</p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-[inset_0_0_20px_rgba(124,162,255,0.08)]"><p className="text-xs text-[#8ea5cc]">Total Calories</p><p className="text-xl font-semibold">{state.stats.totalCalories}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-[inset_0_0_20px_rgba(124,162,255,0.08)]"><p className="text-xs text-[#8ea5cc]">Current Weight</p><p className="text-xl font-semibold">{state.stats.currentWeightKg}kg</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-[inset_0_0_20px_rgba(124,162,255,0.08)]"><p className="text-xs text-[#8ea5cc]">Day Streak</p><p className="inline-flex items-center gap-1 text-xl font-semibold"><Flame className="h-4 w-4 text-orange-300" />{state.stats.dayStreak}</p></div>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-[inset_0_0_20px_rgba(124,162,255,0.08)]"><p className="text-xs text-[#8ea5cc]">Protein</p><p className="text-lg font-semibold">{state.stats.protein}g</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-[inset_0_0_20px_rgba(124,162,255,0.08)]"><p className="text-xs text-[#8ea5cc]">Carbs</p><p className="text-lg font-semibold">{state.stats.carbs}g</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-[inset_0_0_20px_rgba(124,162,255,0.08)]"><p className="text-xs text-[#8ea5cc]">Fats</p><p className="text-lg font-semibold">{state.stats.fats}g</p></div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[#b5c9ee]">
          <span>Food source: {plannerSourceLabel}</span>
          <span>{plannerLoading ? "Syncing..." : `${plannerData.recipes.length} recipes loaded`}</span>
        </div>

        <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[#b5c9ee]">
          <div>{plannerData.statusMessage}</div>
          {plannerData.fallbackReason ? <div className="mt-1 text-[#ffb4bb]">Fallback reason: {plannerData.fallbackReason}</div> : null}
        </div>

        <div className="mt-4 grid gap-2 text-sm md:grid-cols-[1fr_1.2fr_1fr]">
          <button onClick={buildMyPlan} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-medium text-[#d5e3ff] shadow-[0_6px_20px_rgba(80,124,255,0.2)]">Build My Plan</button>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2 shadow-[inset_0_0_20px_rgba(87,130,255,0.08)]">
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
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm disabled:opacity-50"
            />
            <button onClick={updateWeight} className="whitespace-nowrap rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium">Update Weight</button>
          </div>
          <button onClick={resetGoalsAndStats} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-medium text-[#d5e3ff] shadow-[0_6px_20px_rgba(80,124,255,0.2)]">Reset Goals & Stats</button>
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-[#0a1222] p-3 shadow-[inset_0_0_35px_rgba(105,154,255,0.08)]">
          <div className="mb-3 flex items-center gap-2 px-1"><MessageSquareText className="h-4 w-4" /><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9fb4dc]">Conversation</p></div>

          <div ref={chatScrollRef} className="h-[360px] space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:h-[440px]">
            {state.messages.map((message) => {
              const isUser = message.role === "user"
              return (
                <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 ${isUser ? "bg-[#365fa5] text-white" : "border border-white/10 bg-[#121f35] text-[#dce8ff]"}`}>
                    {message.content}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-[#ff8892]">{error}</p> : null}

        {showSetupModal ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[28px] bg-[#02050c]/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-3xl border border-[#8fb4ff]/20 bg-gradient-to-b from-[#0f1a2d] to-[#0a1222] p-5 shadow-[0_30px_100px_rgba(40,90,220,0.45)] sm:p-6">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9fb4dc]">Quick setup</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Set your targets</h2>
                <p className="mt-1 text-sm text-[#a9bcdf]">Fast profile setup so George can coach you properly.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-[#d4e3ff]">Goal
                  <select value={setupForm.goal} onChange={(e) => setSetupForm((prev) => ({ ...prev, goal: e.target.value as Goal }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#111f36] px-3 py-2">
                    <option value="lose-fat">Lose fat</option>
                    <option value="recomp">Recomp</option>
                    <option value="gain-muscle">Gain muscle</option>
                  </select>
                </label>
                <label className="text-sm text-[#d4e3ff]">Sex
                  <select value={setupForm.sex} onChange={(e) => setSetupForm((prev) => ({ ...prev, sex: e.target.value as Sex }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#111f36] px-3 py-2">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </label>
                <label className="text-sm text-[#d4e3ff]">Age
                  <input value={setupForm.age} onChange={(e) => setSetupForm((prev) => ({ ...prev, age: e.target.value }))} type="number" min={13} max={95} className="mt-1 w-full rounded-xl border border-white/10 bg-[#111f36] px-3 py-2" />
                </label>
                <label className="text-sm text-[#d4e3ff]">Height (cm)
                  <input value={setupForm.heightCm} onChange={(e) => setSetupForm((prev) => ({ ...prev, heightCm: e.target.value }))} type="number" min={120} max={230} className="mt-1 w-full rounded-xl border border-white/10 bg-[#111f36] px-3 py-2" />
                </label>
                <label className="text-sm text-[#d4e3ff]">Current weight (kg)
                  <input value={setupForm.currentWeightKg} onChange={(e) => setSetupForm((prev) => ({ ...prev, currentWeightKg: e.target.value }))} type="number" min={35} max={350} step="0.1" className="mt-1 w-full rounded-xl border border-white/10 bg-[#111f36] px-3 py-2" />
                </label>
                <label className="text-sm text-[#d4e3ff]">Activity level
                  <select value={setupForm.activityLevel} onChange={(e) => setSetupForm((prev) => ({ ...prev, activityLevel: e.target.value as ActivityLevel }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#111f36] px-3 py-2">
                    <option value="sedentary">Sedentary</option>
                    <option value="light">Light</option>
                    <option value="moderate">Moderate</option>
                    <option value="active">Active</option>
                    <option value="very-active">Very active</option>
                  </select>
                </label>
                <label className="text-sm text-[#d4e3ff]">Allergies
                  <input value={setupForm.allergies} onChange={(e) => setSetupForm((prev) => ({ ...prev, allergies: e.target.value }))} placeholder="e.g. nuts, shellfish or none" className="mt-1 w-full rounded-xl border border-white/10 bg-[#111f36] px-3 py-2" />
                </label>
                <label className="text-sm text-[#d4e3ff]">Disliked foods
                  <input value={setupForm.dislikedFoods} onChange={(e) => setSetupForm((prev) => ({ ...prev, dislikedFoods: e.target.value }))} placeholder="e.g. mushrooms, olives or none" className="mt-1 w-full rounded-xl border border-white/10 bg-[#111f36] px-3 py-2" />
                </label>
                <label className="text-sm text-[#d4e3ff]">Meals per day
                  <select value={setupForm.mealsPerDay} onChange={(e) => setSetupForm((prev) => ({ ...prev, mealsPerDay: e.target.value as "3" | "4" | "5" }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#111f36] px-3 py-2">
                    <option value="3">3 meals</option>
                    <option value="4">4 meals</option>
                    <option value="5">5 meals</option>
                  </select>
                </label>
                <label className="text-sm text-[#d4e3ff]">Dietary preference
                  <select value={setupForm.dietaryPreference} onChange={(e) => setSetupForm((prev) => ({ ...prev, dietaryPreference: e.target.value as DietaryPreference }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#111f36] px-3 py-2">
                    <option value="omnivore">Omnivore</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="pescatarian">Pescatarian</option>
                    <option value="vegan">Vegan</option>
                  </select>
                </label>
                <label className="text-sm text-[#d4e3ff]">Plan mode
                  <select value={setupForm.planMode} onChange={(e) => setSetupForm((prev) => ({ ...prev, planMode: e.target.value as PlanMode }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#111f36] px-3 py-2">
                    <option value="balanced">Balanced</option>
                    <option value="higher-carb">Higher carb</option>
                    <option value="lower-carb">Lower carb</option>
                  </select>
                </label>
              </div>

              <button onClick={saveTargetsFromSetup} className="mt-5 w-full rounded-xl border border-[#8eb2ff]/40 bg-[#2b4f89] px-4 py-3 font-semibold text-white shadow-[0_12px_30px_rgba(79,131,255,0.4)] hover:bg-[#355f9f]">
                Save Targets
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
