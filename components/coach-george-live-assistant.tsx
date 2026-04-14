"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Flame, Loader2, MessageSquareText, Mic } from "lucide-react"
import {
  buildMealPlan,
  foods,
  getDailyTargets,
  type ActivityLevel,
  type DietaryPreference,
  type Goal,
  type Nutrition,
  type Profile,
  type Sex,
} from "@/lib/coach-george/coach-george-nutrition"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"
type PartialProfile = Partial<Profile>
type OnboardingStep = keyof Profile

type QuickReply = {
  label: string
  value: string
}

type PendingConfirmation = {
  step: OnboardingStep
  candidate: Goal | Sex | ActivityLevel | 3 | 4 | 5 | DietaryPreference
  prompt: string
}

type StatsState = {
  currentWeightKg: number
  dayStreak: number
  totalCalories: number
  protein: number
  carbs: number
  fats: number
}

type CoachState = {
  profile: PartialProfile
  profileComplete: boolean
  targets: Nutrition
  stats: StatsState
  latestPlan: string | null
  messages: LiveMessage[]
  weightInput: string
  lastActiveDate: string | null
  lockedSteps: OnboardingStep[]
  pendingConfirmation: PendingConfirmation | null
  activeStep: OnboardingStep | null
  quickReplies: QuickReply[]
}

const SESSION_KEY = "coach-george-session-v5"

const ZERO_TARGETS: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 }
const ZERO_STATS: StatsState = { currentWeightKg: 0, dayStreak: 0, totalCalories: 0, protein: 0, carbs: 0, fats: 0 }

const STEP_ORDER: OnboardingStep[] = [
  "goal",
  "sex",
  "age",
  "heightCm",
  "currentWeightKg",
  "activityLevel",
  "allergies",
  "dislikedFoods",
  "mealsPerDay",
  "dietaryPreference",
]

const STEP_QUICK_REPLIES: Partial<Record<OnboardingStep, QuickReply[]>> = {
  goal: [
    { label: "Lose fat", value: "lose fat" },
    { label: "Recomp", value: "recomp" },
    { label: "Gain muscle", value: "gain muscle" },
  ],
  sex: [
    { label: "Male", value: "male" },
    { label: "Female", value: "female" },
  ],
  activityLevel: [
    { label: "Sedentary", value: "sedentary" },
    { label: "Light", value: "light" },
    { label: "Moderate", value: "moderate" },
    { label: "Active", value: "active" },
    { label: "Very active", value: "very active" },
  ],
  mealsPerDay: [
    { label: "3", value: "3" },
    { label: "4", value: "4" },
    { label: "5", value: "5" },
  ],
  dietaryPreference: [
    { label: "I eat everything", value: "normal" },
    { label: "Vegetarian", value: "vegetarian" },
    { label: "Pescatarian", value: "pescatarian" },
    { label: "Vegan", value: "vegan" },
  ],
}

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "assistant",
    content: "Hi — I’m Coach George. Let’s set your basics quickly. What’s your main goal: lose fat, recomp, or gain muscle?",
  },
]

const INITIAL_STATE: CoachState = {
  profile: {},
  profileComplete: false,
  targets: ZERO_TARGETS,
  stats: ZERO_STATS,
  latestPlan: null,
  messages: INITIAL_MESSAGES,
  weightInput: "",
  lastActiveDate: null,
  lockedSteps: [],
  pendingConfirmation: null,
  activeStep: "goal",
  quickReplies: STEP_QUICK_REPLIES.goal || [],
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

function hasValue(step: OnboardingStep, value: PartialProfile[OnboardingStep]) {
  if (step === "allergies" || step === "dislikedFoods") return Array.isArray(value)
  return value !== undefined && value !== null && value !== ""
}

function isProfileComplete(profile: PartialProfile): profile is Profile {
  return STEP_ORDER.every((step) => hasValue(step, profile[step]))
}

function getNextStep(profile: PartialProfile, lockedSteps: OnboardingStep[]) {
  return STEP_ORDER.find((step) => !lockedSteps.includes(step) && !hasValue(step, profile[step])) || null
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

function onboardingPrompt(field: OnboardingStep | null) {
  switch (field) {
    case "goal":
      return "What’s your main goal right now: lose fat, recomp, or gain muscle?"
    case "sex":
      return "What sex should I use for your calorie calculation: male or female?"
    case "age":
      return "How old are you?"
    case "heightCm":
      return "What is your height? You can say 196 cm or 6 foot 5."
    case "currentWeightKg":
      return "What is your current body weight in kg?"
    case "activityLevel":
      return "What is your activity level: sedentary, light, moderate, active, or very active?"
    case "allergies":
      return "Do you have any allergies? Say none if not."
    case "dislikedFoods":
      return "Any foods you dislike or want me to avoid? Say none if not."
    case "mealsPerDay":
      return "How many meals per day do you want: 3, 4, or 5?"
    case "dietaryPreference":
      return "What dietary preference should I use: omnivore, vegetarian, pescatarian, or vegan?"
    default:
      return "Let’s set your basics first so I can do this properly."
  }
}

function parseListValue(raw: string) {
  if (/\bnone\b|\bno\b/i.test(raw)) return []
  return raw
    .split(/,| and /i)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
}

function parseYesNo(raw: string): "yes" | "no" | null {
  const text = raw.toLowerCase().trim()
  if (/\b(yes|yeah|yep|correct|right|exactly|confirm)\b/.test(text)) return "yes"
  if (/\b(no|nope|nah|wrong|incorrect)\b/.test(text)) return "no"
  return null
}

function wordToDigit(raw: string) {
  if (raw === "three") return 3
  if (raw === "four") return 4
  if (raw === "five") return 5
  return Number(raw)
}

function parseHeightCm(text: string): number | null {
  const cm = text.match(/(\d{2,3}(?:\.\d+)?)\s*cm\b/)
  if (cm) return Math.round(Number(cm[1]))

  const feetInches = text.match(/(\d)\s*(?:foot|feet|ft|')\s*(\d{1,2})?\s*(?:inches|inch|in|\")?\b/)
  if (feetInches) {
    const feet = Number(feetInches[1])
    const inches = Number(feetInches[2] || 0)
    return Math.round((feet * 12 + inches) * 2.54)
  }

  const compact = text.match(/\b(\d)'(\d{1,2})\b/)
  if (compact) {
    const feet = Number(compact[1])
    const inches = Number(compact[2])
    return Math.round((feet * 12 + inches) * 2.54)
  }

  return null
}

function parseGoal(text: string): Goal | null {
  const raw = text.toLowerCase()
  if (/\b(recomp)\b/.test(raw)) return "recomp"
  if (/\b(lose fat|fat loss|weight loss|cut|cutting)\b/.test(raw)) return "lose-fat"
  if (/\b(gain muscle|build muscle|bulk|bulking)\b/.test(raw)) return "gain-muscle"
  return null
}

function parseSex(text: string): Sex | null {
  const raw = text.toLowerCase()
  if (/\bfemale\b/.test(raw)) return "female"
  if (/\bmale\b/.test(raw)) return "male"
  return null
}

function parseActivity(text: string): ActivityLevel | null {
  const raw = text.toLowerCase()
  if (/\bvery\s*active\b/.test(raw)) return "very-active"
  if (/\bsedentary\b/.test(raw)) return "sedentary"
  if (/\blight\b/.test(raw)) return "light"
  if (/\bmoderate\b/.test(raw)) return "moderate"
  if (/\bactive\b/.test(raw)) return "active"
  return null
}

function parseMealsPerDay(text: string): 3 | 4 | 5 | null {
  const raw = text.toLowerCase()
  const match = raw.match(/\b(3|4|5|three|four|five)\b/)
  if (!match) return null
  const value = wordToDigit(match[1])
  if (value === 3 || value === 4 || value === 5) return value
  return null
}

function parseDietaryPreference(text: string): DietaryPreference | null {
  const raw = text.toLowerCase()
  if (/\b(omnivore|normal|just normal|eat everything|i eat everything)\b/.test(raw)) return "omnivore"
  if (/\bvegetarian\b/.test(raw)) return "vegetarian"
  if (/\bpescatarian\b/.test(raw)) return "pescatarian"
  if (/\bvegan\b/.test(raw)) return "vegan"
  return null
}

function inferCandidateForConfirmation(step: OnboardingStep, text: string): PendingConfirmation["candidate"] | null {
  const raw = text.toLowerCase()
  if (step === "goal") {
    if (/\b(lose|cut)\b/.test(raw)) return "lose-fat"
    if (/\b(gain|bulk|muscle)\b/.test(raw)) return "gain-muscle"
    if (/\brecomp\b/.test(raw)) return "recomp"
  }

  if (step === "sex") {
    if (raw.includes("fem")) return "female"
    if (raw.includes("mal")) return "male"
  }

  if (step === "activityLevel") {
    if (raw.includes("very")) return "very-active"
    if (raw.includes("sed")) return "sedentary"
    if (raw.includes("light")) return "light"
    if (raw.includes("mod")) return "moderate"
    if (raw.includes("act")) return "active"
  }

  if (step === "mealsPerDay") {
    if (raw.includes("3") || raw.includes("three")) return 3
    if (raw.includes("4") || raw.includes("four")) return 4
    if (raw.includes("5") || raw.includes("five")) return 5
  }

  if (step === "dietaryPreference") {
    if (raw.includes("omni") || raw.includes("normal") || raw.includes("everything")) return "omnivore"
    if (raw.includes("vegetarian")) return "vegetarian"
    if (raw.includes("pesc")) return "pescatarian"
    if (raw.includes("vegan")) return "vegan"
  }

  return null
}

function parseStepValue(step: OnboardingStep, text: string) {
  switch (step) {
    case "goal": {
      const parsed = parseGoal(text)
      return parsed ? { status: "ok" as const, value: parsed } : { status: "unclear" as const }
    }
    case "sex": {
      const parsed = parseSex(text)
      return parsed ? { status: "ok" as const, value: parsed } : { status: "unclear" as const }
    }
    case "age": {
      const parsed = text.toLowerCase().match(/\b(\d{1,2})\b/)
      if (!parsed) return { status: "unclear" as const }
      const age = Number(parsed[1])
      if (age < 13 || age > 95) return { status: "unclear" as const }
      return { status: "ok" as const, value: age }
    }
    case "heightCm": {
      const heightCm = parseHeightCm(text.toLowerCase())
      if (!heightCm || heightCm < 120 || heightCm > 230) return { status: "unclear" as const }
      return { status: "ok" as const, value: heightCm }
    }
    case "currentWeightKg": {
      const parsed = text.toLowerCase().match(/\b(\d{2,3}(?:\.\d+)?)\s*(kg)?\b/)
      if (!parsed) return { status: "unclear" as const }
      const weight = Number(parsed[1])
      if (weight < 35 || weight > 350) return { status: "unclear" as const }
      return { status: "ok" as const, value: Math.round(weight * 10) / 10 }
    }
    case "activityLevel": {
      const parsed = parseActivity(text)
      return parsed ? { status: "ok" as const, value: parsed } : { status: "unclear" as const }
    }
    case "allergies":
      return { status: "ok" as const, value: parseListValue(text) }
    case "dislikedFoods":
      return { status: "ok" as const, value: parseListValue(text) }
    case "mealsPerDay": {
      const parsed = parseMealsPerDay(text)
      return parsed ? { status: "ok" as const, value: parsed } : { status: "unclear" as const }
    }
    case "dietaryPreference": {
      const parsed = parseDietaryPreference(text)
      return parsed ? { status: "ok" as const, value: parsed } : { status: "unclear" as const }
    }
  }
}

function formatTargetSummary(targets: Nutrition) {
  return `Targets updated: ${targets.calories} kcal | Protein ${targets.protein}g | Carbs ${targets.carbs}g | Fats ${targets.fat}g.`
}

function formatMealPlan(profile: Profile) {
  const result = buildMealPlan(profile)
  const lines = [formatTargetSummary(result.targets), ""]

  result.plan.forEach((meal, index) => {
    lines.push(`Meal ${index + 1}: ${meal.name}`)
    meal.ingredients.forEach((ingredient) => {
      const food = foods.find((entry) => entry.id === ingredient.foodId)
      lines.push(`- ${food?.name || ingredient.foodId}: ${ingredient.grams}g`)
    })
    lines.push(`Macros: ${meal.nutrition.calories} kcal | P ${meal.nutrition.protein}g | C ${meal.nutrition.carbs}g | F ${meal.nutrition.fat}g`)
    lines.push("")
  })

  return lines.join("\n").trim()
}

export function CoachGeorgeLiveAssistant() {
  const [state, setState] = useState<CoachState>(INITIAL_STATE)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [error, setError] = useState<string | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)

  const canStart = useMemo(() => connectionState === "idle" || connectionState === "error", [connectionState])

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
    try {
      const raw = window.localStorage.getItem(SESSION_KEY)
      if (!raw) return
      const stored = JSON.parse(raw) as CoachState
      const today = new Date().toISOString().slice(0, 10)
      const last = stored.lastActiveDate
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      const dayStreak = last ? (last === today ? stored.stats.dayStreak : last === yesterday ? stored.stats.dayStreak + 1 : 1) : 1

      const lockedSteps = stored.lockedSteps || STEP_ORDER.filter((step) => hasValue(step, stored.profile?.[step]))
      const activeStep = stored.profileComplete ? null : getNextStep(stored.profile || {}, lockedSteps)
      const quickReplies = stored.pendingConfirmation
        ? [
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ]
        : activeStep
          ? (STEP_QUICK_REPLIES[activeStep] ?? [])
          : []

      setState({
        ...INITIAL_STATE,
        ...stored,
        lockedSteps,
        activeStep,
        quickReplies,
        messages: stored.profileComplete
          ? [...trimMessagesForStorage(stored.messages || []), makeMessage("assistant", "Welcome back — pick up where you left off.")]
          : trimMessagesForStorage(stored.messages || INITIAL_MESSAGES),
        stats: { ...stored.stats, dayStreak },
        weightInput: stored.weightInput ?? (stored.profileComplete ? String(stored.profile.currentWeightKg ?? "") : ""),
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
        lastActiveDate: new Date().toISOString().slice(0, 10),
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

  function completeOnboardingWithProfile(profile: Profile, lockedSteps: OnboardingStep[]) {
    const dayStreak = state.stats.dayStreak > 0 ? state.stats.dayStreak : 1
    const calculated = buildTargetsAndStats(profile, dayStreak)
    const targetLine = formatTargetSummary(calculated.targets)
    const shortSummary = "Profile complete. Targets are set — tell me when to build your plan."

    setState((prev) => ({
      ...prev,
      profile,
      profileComplete: true,
      targets: calculated.targets,
      stats: calculated.stats,
      lockedSteps,
      activeStep: null,
      quickReplies: [],
      pendingConfirmation: null,
      messages: [...prev.messages, makeMessage("assistant", targetLine), makeMessage("assistant", shortSummary)],
    }))
    speakIfConnected(shortSummary)
  }

  function moveToNextStep(profile: PartialProfile, lockedSteps: OnboardingStep[]) {
    if (isProfileComplete(profile)) {
      completeOnboardingWithProfile(profile, lockedSteps)
      return
    }

    const nextStep = getNextStep(profile, lockedSteps)
    const prompt = onboardingPrompt(nextStep)
    const quickReplies = nextStep ? (STEP_QUICK_REPLIES[nextStep] ?? []) : []

    setState((prev) => ({
      ...prev,
      profile,
      lockedSteps,
      activeStep: nextStep,
      quickReplies,
      pendingConfirmation: null,
      messages: [...prev.messages, makeMessage("assistant", prompt)],
    }))
    speakIfConnected(prompt)
  }

  function askForConfirmation(step: OnboardingStep, candidate: PendingConfirmation["candidate"], prompt: string) {
    setState((prev) => ({
      ...prev,
      pendingConfirmation: { step, candidate, prompt },
      quickReplies: [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" },
      ],
      messages: [...prev.messages, makeMessage("assistant", prompt)],
    }))
    speakIfConnected(prompt)
  }

  function lockAndAdvance(step: OnboardingStep, value: PartialProfile[OnboardingStep]) {
    if (state.profileComplete) return
    const nextProfile = { ...state.profile, [step]: value }
    const nextLocked = state.lockedSteps.includes(step) ? state.lockedSteps : [...state.lockedSteps, step]
    moveToNextStep(nextProfile, nextLocked)
  }

  function processOnboardingInput(rawInput: string) {
    const input = rawInput.trim()
    if (!input) return

    const pending = state.pendingConfirmation
    if (pending) {
      const yesNo = parseYesNo(input)
      const explicit = parseStepValue(pending.step, input)

      if (yesNo === "yes") {
        lockAndAdvance(pending.step, pending.candidate)
        return
      }

      if (explicit.status === "ok") {
        lockAndAdvance(pending.step, explicit.value)
        return
      }

      const retry = `No problem — ${onboardingPrompt(pending.step)}`
      setState((prev) => ({
        ...prev,
        pendingConfirmation: null,
        quickReplies: STEP_QUICK_REPLIES[pending.step] ?? [],
        messages: [...prev.messages, makeMessage("assistant", retry)],
      }))
      speakIfConnected(retry)
      return
    }

    const currentStep = state.activeStep || getNextStep(state.profile, state.lockedSteps)
    if (!currentStep) return

    const parsed = parseStepValue(currentStep, input)
    if (parsed.status !== "ok") {
      if (["goal", "sex", "activityLevel", "mealsPerDay", "dietaryPreference"].includes(currentStep)) {
        const candidate = inferCandidateForConfirmation(currentStep, input)
        if (candidate) {
          const confirmPrompt = `Just to confirm — do you mean ${String(candidate).replace("-", " ")}?`
          askForConfirmation(currentStep, candidate, confirmPrompt)
          return
        }
      }

      const prompt = onboardingPrompt(currentStep)
      setState((prev) => ({
        ...prev,
        quickReplies: STEP_QUICK_REPLIES[currentStep] ?? [],
        messages: [...prev.messages, makeMessage("assistant", `I didn’t catch that. ${prompt}`)],
      }))
      speakIfConnected(prompt)
      return
    }

    lockAndAdvance(currentStep, parsed.value)
  }

  function handleUserTranscript(text: string) {
    const cleaned = text.trim()
    if (!cleaned) return
    appendUserMessage(cleaned)

    if (!state.profileComplete) {
      processOnboardingInput(cleaned)
    }
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
      remoteAudio.playsInline = true
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
        const intro = state.profileComplete
          ? "You are Coach George. User is returning. Keep spoken replies short and practical."
          : `You are Coach George. Ask one onboarding question at a time. Start with: ${onboardingPrompt(state.activeStep)}`
        dataChannel.send(JSON.stringify({ type: "response.create", response: { instructions: intro } }))
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

  function buildMyPlan() {
    appendUserMessage("Build My Plan")
    if (!state.profileComplete || !isProfileComplete(state.profile)) {
      const gate = "Please finish onboarding first so I can build this correctly."
      appendAssistantMessage(gate)
      speakIfConnected(gate)
      return
    }

    const planText = formatMealPlan(state.profile)
    setState((prev) => ({ ...prev, latestPlan: planText, messages: [...prev.messages, makeMessage("assistant", planText)] }))
    const spoken = "I’ve built your plan. Have a look below and tell me what you want to change."
    appendAssistantMessage(spoken)
    speakIfConnected(spoken)
  }

  function updateWeight() {
    appendUserMessage("Update Weight")
    if (!state.profileComplete || !isProfileComplete(state.profile)) {
      const gate = "Finish onboarding first — weight updates are for returning users."
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

    setState((prev) => ({
      ...prev,
      profile: nextProfile,
      targets: calculated.targets,
      stats: calculated.stats,
      messages: [...prev.messages, makeMessage("assistant", targetLine), makeMessage("assistant", "Done — your stats are refreshed.")],
    }))

    speakIfConnected("Done — your stats are refreshed.")
  }

  function resetGoalsAndStats() {
    appendUserMessage("Reset Goals & Stats")
    const next: CoachState = {
      ...INITIAL_STATE,
      messages: [...INITIAL_MESSAGES, makeMessage("assistant", onboardingPrompt("goal"))],
      stats: { ...ZERO_STATS, dayStreak: 0 },
      targets: ZERO_TARGETS,
      weightInput: "",
      profile: {},
      profileComplete: false,
      latestPlan: null,
      lockedSteps: [],
      activeStep: "goal",
      pendingConfirmation: null,
      quickReplies: STEP_QUICK_REPLIES.goal || [],
      lastActiveDate: null,
    }
    setState(next)
    window.localStorage.removeItem(SESSION_KEY)
    speakIfConnected("I’ve reset everything. Let’s restart onboarding. What’s your main goal?")
  }

  function handleQuickReply(value: string) {
    appendUserMessage(value)
    if (!state.profileComplete) {
      processOnboardingInput(value)
    }
  }

  return (
    <section className="bg-[#060a12] px-3 py-4 text-white sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-[860px] rounded-[28px] border border-white/10 bg-gradient-to-b from-[#101b31] via-[#0b1323] to-[#090f1a] p-4 shadow-[0_20px_100px_rgba(72,132,255,0.2)] sm:p-5">
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

        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <button onClick={buildMyPlan} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-medium text-[#d5e3ff] shadow-[0_6px_20px_rgba(80,124,255,0.2)]">Build My Plan</button>
          <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2 shadow-[inset_0_0_20px_rgba(87,130,255,0.08)]">
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
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/10 px-2 py-1 text-sm disabled:opacity-50"
            />
            <button onClick={updateWeight} className="rounded-xl border border-white/10 bg-white/10 px-2 py-1 text-xs font-medium">Update Weight</button>
          </div>
          <button onClick={resetGoalsAndStats} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-medium text-[#d5e3ff] shadow-[0_6px_20px_rgba(80,124,255,0.2)]">Reset Goals & Stats</button>
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-[#0a1222] p-3 shadow-[inset_0_0_35px_rgba(105,154,255,0.08)]">
          <div className="mb-3 flex items-center gap-2 px-1"><MessageSquareText className="h-4 w-4" /><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9fb4dc]">Conversation</p></div>

          {state.quickReplies.length ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {state.quickReplies.map((reply) => (
                <button
                  key={`${reply.label}-${reply.value}`}
                  onClick={() => handleQuickReply(reply.value)}
                  className="rounded-full border border-[#8ab0ff]/40 bg-[#21385e] px-3 py-1 text-xs text-[#d9e7ff]"
                >
                  {reply.label}
                </button>
              ))}
            </div>
          ) : null}

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
      </div>
    </section>
  )
}
