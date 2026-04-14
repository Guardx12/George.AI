"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Flame, Loader2, MessageSquareText, Mic } from "lucide-react"
import { buildMealPlan, foods, getDailyTargets, type Profile } from "@/lib/coach-george/coach-george-nutrition"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"
type CoachingStyle = "supportive" | "balanced" | "strict"
type ContextAction = { id: string; label: string; prompt: string }

type StatsState = {
  currentWeightKg: number
  dayStreak: number
}

type StoredSession = {
  messages: LiveMessage[]
  visitorName: string | null
  updatedAt: number
  profile: Profile
  coachingStyle: CoachingStyle
  stats: StatsState
  lastActiveDate: string
}

const SESSION_KEY = "coach-george-session-v3"

const DEFAULT_PROFILE: Profile = {
  goal: "lose-fat",
  sex: "male",
  age: 30,
  heightCm: 178,
  currentWeightKg: 82,
  activityLevel: "moderate",
  allergies: [],
  dislikedFoods: [],
  mealsPerDay: 4,
  dietaryPreference: "omnivore",
}

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "assistant",
    content: "Hi — I’m Coach George. Tap the round button and talk to me. I’ll coach your onboarding, plan, and updates right here.",
  },
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
  return messages.slice(-48)
}

function formatMealPlan(profile: Profile) {
  const result = buildMealPlan(profile)
  const targets = getDailyTargets(profile)
  const lines = [
    `Here’s your plan. Daily target: ${targets.calories} kcal | Protein ${targets.protein}g | Carbs ${targets.carbs}g | Fats ${targets.fat}g.`,
  ]

  result.plan.forEach((meal, index) => {
    lines.push(`Meal ${index + 1}: ${meal.name}`)
    meal.ingredients.forEach((ingredient) => {
      const food = foods.find((entry) => entry.id === ingredient.foodId)
      lines.push(`- ${food?.name || ingredient.foodId}: ${ingredient.grams}g`)
    })
    lines.push(
      `Macros: ${meal.nutrition.calories} kcal | P ${meal.nutrition.protein}g | C ${meal.nutrition.carbs}g | F ${meal.nutrition.fat}g`,
    )
  })

  return lines.join("\n")
}

function inferProfileUpdate(input: string, profile: Profile): Profile | null {
  const text = input.toLowerCase()
  let next = { ...profile }
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
    next.allergies = allergies[1].split(/,| and /).map((v) => v.trim()).filter(Boolean)
    changed = true
  }

  const dislikes = text.match(/(?:dislike|avoid|don'?t like)\s*([^.;]+)/)
  if (dislikes) {
    next.dislikedFoods = dislikes[1].split(/,| and /).map((v) => v.trim()).filter(Boolean)
    changed = true
  }

  return changed ? next : null
}

export function CoachGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [visitorName, setVisitorName] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [coachingStyle, setCoachingStyle] = useState<CoachingStyle>("balanced")
  const [latestWeightInput, setLatestWeightInput] = useState<string>(DEFAULT_PROFILE.currentWeightKg.toString())
  const [contextActions, setContextActions] = useState<ContextAction[]>([])

  const [stats, setStats] = useState<StatsState>({
    currentWeightKg: DEFAULT_PROFILE.currentWeightKg,
    dayStreak: 1,
  })

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)

  const targets = useMemo(() => getDailyTargets(profile), [profile])
  const canStart = useMemo(() => connectionState === "idle" || connectionState === "error", [connectionState])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY)
      if (!raw) return
      const stored = JSON.parse(raw) as StoredSession
      if (!Array.isArray(stored.messages)) return
      setMessages(stored.messages.length ? stored.messages : INITIAL_MESSAGES)
      setProfile(stored.profile ?? DEFAULT_PROFILE)
      setCoachingStyle(stored.coachingStyle ?? "balanced")
      setStats(stored.stats ?? { currentWeightKg: DEFAULT_PROFILE.currentWeightKg, dayStreak: 1 })
      setLatestWeightInput((stored.profile?.currentWeightKg ?? DEFAULT_PROFILE.currentWeightKg).toString())
      setVisitorName(stored.visitorName || null)

      const today = new Date().toISOString().slice(0, 10)
      if (stored.lastActiveDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
        setStats((prev) => ({ ...prev, dayStreak: stored.lastActiveDate === yesterday ? prev.dayStreak + 1 : 1 }))
      }
    } catch {
      // ignore corrupted storage
    }
  }, [])

  useEffect(() => {
    try {
      const trimmed = trimMessagesForStorage(messages)
      if (!trimmed.length) return
      const payload: StoredSession = {
        messages: trimmed,
        visitorName,
        updatedAt: Date.now(),
        profile,
        coachingStyle,
        stats,
        lastActiveDate: new Date().toISOString().slice(0, 10),
      }
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
    } catch {
      // ignore
    }
  }, [messages, visitorName, profile, coachingStyle, stats])

  useEffect(() => {
    return () => {
      void cleanupConversation()
    }
  }, [])

  useEffect(() => {
    if (!chatScrollRef.current) return
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [messages])

  function appendOrUpdateAssistantPartial(delta: string, isFinal = false) {
    if (!delta) return

    if (!currentAssistantMessageIdRef.current) {
      const message = makeMessage("assistant", delta)
      currentAssistantMessageIdRef.current = message.id
      currentAssistantTextRef.current = delta
      setMessages((prev) => [...prev, message])
      if (isFinal) {
        currentAssistantMessageIdRef.current = null
        currentAssistantTextRef.current = ""
      }
      return
    }

    currentAssistantTextRef.current += delta
    const targetId = currentAssistantMessageIdRef.current
    setMessages((prev) => prev.map((message) => (message.id === targetId ? { ...message, content: currentAssistantTextRef.current } : message)))

    if (isFinal) {
      currentAssistantMessageIdRef.current = null
      currentAssistantTextRef.current = ""
    }
  }

  function sendTextToCoach(text: string, userVisibleText = text) {
    setMessages((prev) => [...prev, makeMessage("user", userVisibleText)])
    setContextActions([])

    const channel = dcRef.current
    if (!channel || channel.readyState !== "open") {
      setMessages((prev) => [...prev, makeMessage("assistant", "Tap the round button first, then I’ll guide this by voice and chat."),])
      return
    }

    channel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
      }),
    )
    channel.send(JSON.stringify({ type: "response.create" }))
  }

  function handleUserTranscript(text: string) {
    const cleaned = text.trim()
    if (!cleaned) return
    setMessages((prev) => [...prev, makeMessage("user", cleaned)])

    const updated = inferProfileUpdate(cleaned, profile)
    if (updated) {
      setProfile(updated)
      setLatestWeightInput(updated.currentWeightKg.toString())
      setStats((prev) => ({ ...prev, currentWeightKg: updated.currentWeightKg }))
      setContextActions([
        { id: "confirm-targets", label: "Confirm targets", prompt: "Targets look good. Confirm and continue." },
        { id: "adjust-targets", label: "Adjust targets", prompt: "I want to adjust my targets before continuing." },
      ])
    }

    const textLower = cleaned.toLowerCase()
    if (textLower.includes("swap") || textLower.includes("change meal") || textLower.includes("replace")) {
      setContextActions([
        { id: "swap-works", label: "That works", prompt: "That swap works for me. Keep it." },
        { id: "swap-another", label: "Try another option", prompt: "Give me another swap option with grams." },
      ])
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
        const intro = visitorName
          ? `Welcome back ${visitorName}. Continue coaching in ${coachingStyle} style and confirm my current targets.`
          : "Introduce yourself as Coach George and start conversational onboarding one question at a time."
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
    const planText = formatMealPlan(profile)
    setMessages((prev) => [...prev, makeMessage("assistant", planText)])
    setContextActions([
      { id: "plan-good", label: "Looks good", prompt: "Looks good. Lock this in for today." },
      { id: "plan-change", label: "Change something", prompt: "Change something in this plan and keep grams exact." },
    ])

    sendTextToCoach(
      `Build my nutrition plan using my stored profile and structured foods/recipes. Output as Meal 1, Meal 2, Meal 3... with exact gram amounts and macros per meal. Meals per day: ${profile.mealsPerDay}.`,
      "Build My Plan",
    )
  }

  function updateWeight() {
    const value = Number(latestWeightInput)
    if (!Number.isFinite(value) || value < 35 || value > 350) {
      setError("Please enter a valid weight in kg.")
      return
    }

    setError(null)
    setProfile((prev) => ({ ...prev, currentWeightKg: value }))
    setStats((prev) => ({ ...prev, currentWeightKg: value }))

    setContextActions([
      { id: "rebuild-plan", label: "Rebuild plan", prompt: "Rebuild my plan with this new weight now." },
      { id: "keep-plan", label: "Keep current plan", prompt: "Keep the current plan for now and review tomorrow." },
    ])

    sendTextToCoach(
      `My weight is now ${value}kg. Update my targets and confirm naturally in voice and chat.`,
      `Update Weight to ${value}kg`,
    )
  }

  function resetGoalsAndStats() {
    setProfile(DEFAULT_PROFILE)
    setCoachingStyle("balanced")
    setStats({ currentWeightKg: DEFAULT_PROFILE.currentWeightKg, dayStreak: 1 })
    setLatestWeightInput(DEFAULT_PROFILE.currentWeightKg.toString())
    setContextActions([])
    window.localStorage.removeItem(SESSION_KEY)
    setMessages([makeMessage("assistant", "I’ve reset your goals and stats. Let’s restart onboarding together.")])

    sendTextToCoach(
      "I reset goals and stats. Start onboarding again conversationally by voice and transcript, one question at a time.",
      "Reset Goals & Stats",
    )
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
          <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Total Calories</p><p className="text-xl font-semibold">{targets.calories}</p></div>
          <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Current Weight</p><p className="text-xl font-semibold">{stats.currentWeightKg}kg</p></div>
          <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Day Streak</p><p className="inline-flex items-center gap-1 text-xl font-semibold"><Flame className="h-4 w-4 text-orange-300" />{stats.dayStreak}</p></div>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Protein</p><p className="text-lg font-semibold">{targets.protein}g</p></div>
          <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Carbs</p><p className="text-lg font-semibold">{targets.carbs}g</p></div>
          <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Fats</p><p className="text-lg font-semibold">{targets.fat}g</p></div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <button onClick={buildMyPlan} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-medium text-[#d5e3ff]">Build My Plan</button>
          <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
            <input
              value={latestWeightInput}
              onChange={(e) => setLatestWeightInput(e.target.value)}
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
            {messages.map((message) => {
              const isUser = message.role === "user"
              return (
                <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 ${isUser ? "bg-[#365fa5] text-white" : "border border-white/10 bg-[#121f35] text-[#dce8ff]"}`}>
                    {message.content}
                  </div>
                </div>
              )
            })}
            {contextActions.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {contextActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => sendTextToCoach(action.prompt, action.label)}
                    className="rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-[#dce8ff]"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-[#ff8892]">{error}</p> : null}
      </div>
    </section>
  )
}
