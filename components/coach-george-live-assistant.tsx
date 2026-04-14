"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Flame, Loader2, MessageSquareText, Mic } from "lucide-react"
import {
  buildMealPlan,
  foods,
  getDailyTargets,
  type Nutrition,
  type Profile,
} from "@/lib/coach-george/coach-george-nutrition"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

type PartialProfile = Partial<Profile>

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
}

const SESSION_KEY = "coach-george-session-v4"

const ZERO_TARGETS: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 }
const ZERO_STATS: StatsState = { currentWeightKg: 0, dayStreak: 0, totalCalories: 0, protein: 0, carbs: 0, fats: 0 }

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "assistant",
    content: "Hi — I’m Coach George. Tap the round button and we’ll set your basics together, then build your plan.",
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
}

const REQUIRED_FIELDS: Array<keyof Profile> = [
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

function isProfileComplete(profile: PartialProfile): profile is Profile {
  return REQUIRED_FIELDS.every((key) => {
    const value = profile[key]
    if (Array.isArray(value)) return true
    return value !== undefined && value !== null && value !== ""
  })
}

function getMissingField(profile: PartialProfile): keyof Profile | null {
  for (const key of REQUIRED_FIELDS) {
    const value = profile[key]
    if (Array.isArray(value)) continue
    if (value === undefined || value === null || value === "") return key
  }
  return null
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

function onboardingPrompt(field: keyof Profile | null) {
  switch (field) {
    case "goal":
      return "What’s your main goal right now: lose fat, recomp, or gain muscle?"
    case "sex":
      return "What sex should I use for your calorie calculation: male or female?"
    case "age":
      return "How old are you?"
    case "heightCm":
      return "What is your height in cm?"
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

function inferProfileUpdate(input: string, profile: PartialProfile): PartialProfile | null {
  const text = input.toLowerCase()
  const next = { ...profile }
  let changed = false

  const age = text.match(/(?:age\s*(?:is|=)?\s*|i(?:'| a)?m\s*)(\d{1,2})\b/)
  if (age) {
    next.age = Number(age[1])
    changed = true
  }

  const height = text.match(/(?:height\s*(?:is|=)?\s*|(?:i(?:'| a)?m\s*)?)(\d{2,3})\s*cm\b/)
  if (height) {
    next.heightCm = Number(height[1])
    changed = true
  }

  const weight = text.match(/(?:weight\s*(?:is|=)?\s*|i\s*weigh\s*)(\d{2,3}(?:\.\d+)?)\s*kg\b/)
  if (weight) {
    next.currentWeightKg = Number(weight[1])
    changed = true
  }

  if (text.includes("lose fat") || text.includes("weight loss") || text.includes("cut")) {
    next.goal = "lose-fat"
    changed = true
  } else if (text.includes("gain") || text.includes("build muscle") || text.includes("bulk")) {
    next.goal = "gain-muscle"
    changed = true
  } else if (text.includes("recomp")) {
    next.goal = "recomp"
    changed = true
  }

  if (text.includes("female")) {
    next.sex = "female"
    changed = true
  } else if (text.includes("male")) {
    next.sex = "male"
    changed = true
  }

  if (text.includes("sedentary")) next.activityLevel = "sedentary"
  else if (text.includes("very active")) next.activityLevel = "very-active"
  else if (text.includes("active")) next.activityLevel = "active"
  else if (text.includes("moderate")) next.activityLevel = "moderate"
  else if (text.includes("light")) next.activityLevel = "light"
  if (["sedentary", "very-active", "active", "moderate", "light"].some((a) => text.includes(a.replace("-", " ")) || text.includes(a))) {
    changed = true
  }

  const meals = text.match(/(3|4|5)\s*(?:meals|meals per day|meal)/)
  if (meals) {
    next.mealsPerDay = Number(meals[1]) as 3 | 4 | 5
    changed = true
  }

  if (text.includes("vegan")) next.dietaryPreference = "vegan"
  else if (text.includes("vegetarian")) next.dietaryPreference = "vegetarian"
  else if (text.includes("pescatarian")) next.dietaryPreference = "pescatarian"
  else if (text.includes("omnivore")) next.dietaryPreference = "omnivore"
  if (["vegan", "vegetarian", "pescatarian", "omnivore"].some((d) => text.includes(d))) {
    changed = true
  }

  const allergies = text.match(/allerg(?:y|ies)\s*(?:to|:)?\s*([^.;]+)/)
  if (allergies) {
    next.allergies = parseListValue(allergies[1])
    changed = true
  }

  const dislikes = text.match(/(?:dislike|avoid|don'?t like)\s*([^.;]+)/)
  if (dislikes) {
    next.dislikedFoods = parseListValue(dislikes[1])
    changed = true
  }

  if (!next.allergies && /\bnone\b/.test(text) && (text.includes("allerg") || text.includes("allergy"))) {
    next.allergies = []
    changed = true
  }

  if (!next.dislikedFoods && /\bnone\b/.test(text) && (text.includes("dislike") || text.includes("avoid"))) {
    next.dislikedFoods = []
    changed = true
  }

  return changed ? next : null
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
      setState({
        ...INITIAL_STATE,
        ...stored,
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

  function continueOnboarding(nextProfile: PartialProfile) {
    if (isProfileComplete(nextProfile)) {
      const dayStreak = state.stats.dayStreak > 0 ? state.stats.dayStreak : 1
      const calculated = buildTargetsAndStats(nextProfile, dayStreak)
      const targetLine = formatTargetSummary(calculated.targets)
      setState((prev) => ({
        ...prev,
        profile: nextProfile,
        profileComplete: true,
        targets: calculated.targets,
        stats: calculated.stats,
        messages: [...prev.messages, makeMessage("assistant", targetLine), makeMessage("assistant", "Great — your profile is complete. I’ll keep this concise and personalized from here.")],
      }))
      speakIfConnected("Great — your profile is complete. I’ve set your targets. Tell me when to build your meal plan.")
      return
    }

    const missing = getMissingField(nextProfile)
    const prompt = onboardingPrompt(missing)
    setState((prev) => ({ ...prev, profile: nextProfile, messages: [...prev.messages, makeMessage("assistant", prompt)] }))
    speakIfConnected(prompt)
  }

  function handleUserTranscript(text: string) {
    const cleaned = text.trim()
    if (!cleaned) return
    appendUserMessage(cleaned)

    setState((prev) => {
      if (prev.profileComplete) return prev
      const updated = inferProfileUpdate(cleaned, prev.profile)
      if (!updated) return prev
      return { ...prev, profile: updated }
    })

    const updatedProfile = inferProfileUpdate(cleaned, state.profile)
    if (!state.profileComplete && updatedProfile) {
      continueOnboarding(updatedProfile)
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
          ? "You are Coach George. Continue from saved state and keep spoken replies short."
          : `You are Coach George. Ask onboarding one question at a time. Start with: ${onboardingPrompt(getMissingField(state.profile))}`
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
      const gate = "Let’s set your basics first so I can do this properly."
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
      const gate = "Let’s set your basics first so I can do this properly."
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
    const targetLine = formatTargetSummary(calculated.targets)

    setState((prev) => ({
      ...prev,
      profile: nextProfile,
      targets: calculated.targets,
      stats: calculated.stats,
      messages: [...prev.messages, makeMessage("assistant", targetLine), makeMessage("assistant", "Weight updated. I’ve refreshed your targets.")],
    }))

    speakIfConnected("Weight updated. I’ve refreshed your targets.")
  }

  function resetGoalsAndStats() {
    appendUserMessage("Reset Goals & Stats")
    const next = { ...INITIAL_STATE, messages: [...INITIAL_MESSAGES, makeMessage("assistant", onboardingPrompt("goal"))] }
    setState(next)
    window.localStorage.removeItem(SESSION_KEY)
    speakIfConnected("I’ve reset everything. Let’s restart onboarding. What’s your main goal?")
  }

  return (
    <section className="bg-[#060a12] px-3 py-4 text-white sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-[860px] rounded-[28px] border border-white/10 bg-gradient-to-b from-[#0f1727] to-[#090f1a] p-4 shadow-[0_0_80px_rgba(93,123,255,0.12)] sm:p-5">
        <div className="rounded-3xl border border-white/10 bg-[#0a1120]/90 p-4">
          <button
            type="button"
            onClick={connectionState === "connected" ? stopConversation : startConversation}
            disabled={connectionState === "connecting"}
            className={`mx-auto flex h-[152px] w-[152px] items-center justify-center rounded-full ${connectionState === "connected" ? "animate-pulse" : ""}`}
            style={{ background: "radial-gradient(circle at 32% 26%, #284775 0%, #1a2e52 52%, #0d1a33 100%)" }}
          >
            {connectionState === "connecting" ? <Loader2 className="h-10 w-10 animate-spin" /> : <Mic className="h-10 w-10" />}
          </button>
          <p className="mt-3 text-center text-lg font-semibold">Tap to Talk</p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Total Calories</p><p className="text-xl font-semibold">{state.stats.totalCalories}</p></div>
          <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Current Weight</p><p className="text-xl font-semibold">{state.stats.currentWeightKg}kg</p></div>
          <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Day Streak</p><p className="inline-flex items-center gap-1 text-xl font-semibold"><Flame className="h-4 w-4 text-orange-300" />{state.stats.dayStreak}</p></div>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Protein</p><p className="text-lg font-semibold">{state.stats.protein}g</p></div>
          <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Carbs</p><p className="text-lg font-semibold">{state.stats.carbs}g</p></div>
          <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Fats</p><p className="text-lg font-semibold">{state.stats.fats}g</p></div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <button onClick={buildMyPlan} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-medium text-[#d5e3ff]">Build My Plan</button>
          <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
            <input
              value={state.weightInput}
              onChange={(e) => setState((prev) => ({ ...prev, weightInput: e.target.value }))}
              placeholder="kg"
              className="min-w-0 flex-1 rounded-xl bg-white/10 px-2 py-1 text-sm"
            />
            <button onClick={updateWeight} className="rounded-xl border border-white/10 bg-white/10 px-2 py-1 text-xs font-medium">Update Weight</button>
          </div>
          <button onClick={resetGoalsAndStats} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-medium text-[#d5e3ff]">Reset Goals & Stats</button>
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-[#0a1222] p-3">
          <div className="mb-3 flex items-center gap-2 px-1"><MessageSquareText className="h-4 w-4" /><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9fb4dc]">Conversation</p></div>
          <div ref={chatScrollRef} className="h-[360px] sm:h-[440px] space-y-3 overflow-y-auto rounded-2xl bg-white/[0.03] p-3">
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
