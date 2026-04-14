"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Dumbbell, Loader2, MessageSquareText, Mic, RotateCcw, Scale } from "lucide-react"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

type DailyIntake = {
  date: string
  calories: number
  protein: number
  meals: string[]
}

type CoachProfile = {
  onboardingComplete: boolean
  currentWeight: number | null
  calorieTarget: number | null
  proteinTarget: number | null
  dailyLoggedIntake: DailyIntake
  dayStreak: number
  lastActiveDate: string | null
  dislikes: string[]
  allergies: string[]
  preferences: string[]
}

type PendingCoachPrompt = {
  visibleMessage: string
  prompt: string
}

const STORAGE_KEY = "coach-george-session-v1"
const PROFILE_STORAGE_KEY = "coach-george-profile-v1"

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "system",
    content: "Hi — I'm George, your coach. Tap to talk whenever you're ready.",
  },
]

type StoredSession = {
  messages: LiveMessage[]
  visitorName: string | null
  updatedAt: number
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
  return messages.slice(-24)
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function estimateTargetsForWeight(weightKg: number) {
  const calorieTarget = Math.round(weightKg * 30)
  const proteinTarget = Math.round(weightKg * 2)
  return { calorieTarget, proteinTarget }
}

function ensureDailyIntakeForToday(profile: CoachProfile): CoachProfile {
  const today = todayKey()
  if (profile.dailyLoggedIntake.date === today) return profile

  return {
    ...profile,
    dailyLoggedIntake: {
      date: today,
      calories: 0,
      protein: 0,
      meals: [],
    },
  }
}

function bumpStreak(profile: CoachProfile): CoachProfile {
  const today = todayKey()
  if (profile.lastActiveDate === today) return ensureDailyIntakeForToday(profile)

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)

  const nextStreak = profile.lastActiveDate === yesterdayKey ? profile.dayStreak + 1 : 1

  return ensureDailyIntakeForToday({
    ...profile,
    dayStreak: nextStreak,
    lastActiveDate: today,
  })
}

function createDefaultProfile(): CoachProfile {
  return {
    onboardingComplete: false,
    currentWeight: null,
    calorieTarget: null,
    proteinTarget: null,
    dailyLoggedIntake: {
      date: todayKey(),
      calories: 0,
      protein: 0,
      meals: [],
    },
    dayStreak: 1,
    lastActiveDate: todayKey(),
    dislikes: [],
    allergies: [],
    preferences: [],
  }
}

function detectVisitorName(messages: LiveMessage[]) {
  for (let i = 1; i < messages.length; i += 1) {
    const prev = messages[i - 1]
    const current = messages[i]
    if (prev.role === "assistant" && /what['’]s your name|what is your name/i.test(prev.content) && current.role === "user") {
      const cleaned = current.content
        .replace(/^(it'?s|its|i am|i'm|im|my name is|name'?s|this is)\s+/i, "")
        .replace(/[^A-Za-z' -]/g, " ")
        .trim()
      const first = cleaned.split(/\s+/).find(Boolean)
      if (first && first.length >= 2) {
        return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
      }
    }
  }
  return null
}

function extractMealLogFromText(text: string) {
  const caloriesMatch = text.match(/(\d{2,4})\s*(kcal|calories|cal)/i)
  const proteinMatch = text.match(/(\d{1,3}(?:\.\d+)?)\s*g\s*(protein)?/i)

  if (!caloriesMatch || !proteinMatch) return null

  const calories = Number(caloriesMatch[1])
  const protein = Number(proteinMatch[1])
  if (Number.isNaN(calories) || Number.isNaN(protein)) return null

  return {
    calories,
    protein,
    label: text.length > 80 ? `${text.slice(0, 77)}...` : text,
  }
}

function buildFirstResponseEvent(visitorName: string | null, hasStoredSession: boolean, lastUserMessage: string | null) {
  const instructions = hasStoredSession
    ? `Introduce yourself as George in warm, natural British English. This visitor has an ongoing conversation with you on this device, so welcome them back briefly and continue naturally instead of restarting. ${visitorName ? `Their name is ${visitorName}. Use it lightly.` : ""} ${lastUserMessage ? `The last thing they said was: ${lastUserMessage}` : ""} Keep it short and helpful. Ask one short question about what they want help with next.`
    : "Introduce yourself as George in warm, natural British English. Keep it short, welcoming and practical. Ask one short question about what they want help with first."

  return {
    type: "response.create",
    response: { instructions },
  }
}

export function CoachGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [hasStoredSession, setHasStoredSession] = useState(false)
  const [visitorName, setVisitorName] = useState<string | null>(null)
  const [profile, setProfile] = useState<CoachProfile>(createDefaultProfile())

  const sessionStartedAtRef = useRef<number | null>(null)
  const usageLoggedRef = useRef(false)
  const pendingPromptRef = useRef<PendingCoachPrompt | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)

  const canStart = useMemo(() => connectionState === "idle" || connectionState === "error", [connectionState])

  const caloriesLeft = Math.max(0, (profile.calorieTarget || 0) - profile.dailyLoggedIntake.calories)
  const proteinLeft = Math.max(0, (profile.proteinTarget || 0) - profile.dailyLoggedIntake.protein)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const stored = JSON.parse(raw) as StoredSession
        if (Array.isArray(stored?.messages) && stored.messages.length > 1) {
          setMessages(stored.messages)
          setHasStoredSession(true)
          setVisitorName(stored.visitorName || detectVisitorName(stored.messages))
        }
      }

      const rawProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY)
      if (rawProfile) {
        const storedProfile = JSON.parse(rawProfile) as CoachProfile
        setProfile(bumpStreak(ensureDailyIntakeForToday(storedProfile)))
      } else {
        setProfile(bumpStreak(createDefaultProfile()))
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      const trimmed = trimMessagesForStorage(messages)
      const detectedName = visitorName || detectVisitorName(trimmed)
      if (detectedName && detectedName !== visitorName) setVisitorName(detectedName)
      if (trimmed.length <= 1) {
        window.localStorage.removeItem(STORAGE_KEY)
        setHasStoredSession(false)
        return
      }
      const payload: StoredSession = {
        messages: trimmed,
        visitorName: detectedName,
        updatedAt: Date.now(),
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      setHasStoredSession(true)
    } catch {}
  }, [messages, visitorName])

  useEffect(() => {
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
    } catch {}
  }, [profile])

  useEffect(() => {
    return () => {
      void cleanupConversation(false)
    }
  }, [])

  useEffect(() => {
    if (!chatScrollRef.current) return
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [messages])

  async function logUsageIfNeeded() {
    if (usageLoggedRef.current || sessionStartedAtRef.current === null) return
    usageLoggedRef.current = true
  }

  async function cleanupConversation(logUsage = true) {
    if (logUsage) {
      await logUsageIfNeeded()
    }

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
    sessionStartedAtRef.current = null
  }

  function sendPromptToGeorge(visibleMessage: string, prompt: string) {
    const channel = dcRef.current
    if (!channel || channel.readyState !== "open") return false

    setMessages((prev) => [...prev, makeMessage("user", visibleMessage)])

    channel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      }),
    )

    channel.send(
      JSON.stringify({
        type: "response.create",
        response: { instructions: "Reply as Coach George. Be concise, practical, and action-focused." },
      }),
    )

    return true
  }

  async function triggerCoachAction(action: PendingCoachPrompt) {
    if (connectionState === "connected") {
      if (sendPromptToGeorge(action.visibleMessage, action.prompt)) return
    }

    pendingPromptRef.current = action
    if (connectionState === "idle" || connectionState === "error") {
      await startConversation()
    }
  }

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

  function addUserTranscript(text: string) {
    const cleaned = text.trim()
    if (!cleaned) return

    setMessages((prev) => [...prev, makeMessage("user", cleaned)])

    const meal = extractMealLogFromText(cleaned)
    if (meal) {
      setProfile((existing) => {
        const next = ensureDailyIntakeForToday(existing)
        return {
          ...next,
          dailyLoggedIntake: {
            ...next.dailyLoggedIntake,
            calories: next.dailyLoggedIntake.calories + meal.calories,
            protein: next.dailyLoggedIntake.protein + meal.protein,
            meals: [...next.dailyLoggedIntake.meals, meal.label],
          },
        }
      })
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
        addUserTranscript(typeof event.transcript === "string" ? event.transcript : "")
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
      case "error": {
        const message = event?.error?.message || "George hit a voice error."
        if (connectionState === "connected") {
          setError(message)
        } else {
          void cleanupConversation()
          setConnectionState("error")
          setError(message)
        }
        break
      }
      default:
        break
    }
  }

  async function startConversation() {
    if (!canStart) return

    await cleanupConversation(false)
    setConnectionState("connecting")
    setError(null)
    usageLoggedRef.current = false
    sessionStartedAtRef.current = null
    setMessages((prev) => (hasStoredSession && prev.length > 1 ? prev : INITIAL_MESSAGES))

    try {
      const tokenResponse = await fetch("/api/george-session", {
        method: "GET",
        cache: "no-store",
      })

      const tokenData = await tokenResponse.json().catch(() => null)
      if (!tokenResponse.ok) {
        throw new Error(typeof tokenData?.error === "string" ? tokenData.error : "Could not create a secure live session.")
      }

      const ephemeralKey = tokenData?.value
      if (typeof ephemeralKey !== "string" || !ephemeralKey) throw new Error("Live voice token was missing.")

      const pc = new RTCPeerConnection()
      pcRef.current = pc

      const remoteAudio = document.createElement("audio")
      remoteAudio.autoplay = true
      ;(remoteAudio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true
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
        sessionStartedAtRef.current = Date.now()
        const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? null
        const event = buildFirstResponseEvent(visitorName, hasStoredSession && messages.length > 1, lastUserMessage)
        window.setTimeout(() => {
          dataChannel.send(JSON.stringify(event))
        }, 150)

        window.setTimeout(() => {
          if (!pendingPromptRef.current) return
          const pending = pendingPromptRef.current
          if (sendPromptToGeorge(pending.visibleMessage, pending.prompt)) {
            pendingPromptRef.current = null
          }
        }, 650)
      })

      dataChannel.addEventListener("message", (event) => {
        try {
          handleRealtimeEvent(JSON.parse(event.data))
        } catch {}
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      })

      const answer = await sdpResponse.text()
      if (!sdpResponse.ok) {
        let message = "Could not connect George."
        try {
          const parsed = JSON.parse(answer)
          if (typeof parsed?.error?.message === "string") message = parsed.error.message
        } catch {
          if (answer.trim()) message = answer.trim()
        }
        throw new Error(message)
      }

      await pc.setRemoteDescription({ type: "answer", sdp: answer })
      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") {
          setConnectionState("error")
        }
      })
    } catch (err) {
      await cleanupConversation()
      setConnectionState("error")
      setError(err instanceof Error ? err.message : "Could not connect George right now.")
    }
  }

  async function stopConversation() {
    await cleanupConversation(true)
    setError(null)
    setConnectionState("idle")
  }

  async function handleBuildMyPlan() {
    setProfile((existing) => bumpStreak(existing))

    const missing = []
    if (!profile.currentWeight) missing.push("current weight")
    if (!profile.calorieTarget) missing.push("calorie target")
    if (!profile.proteinTarget) missing.push("protein target")

    const profileSummary = `
Profile snapshot:
- onboardingComplete: ${profile.onboardingComplete}
- currentWeightKg: ${profile.currentWeight ?? "unknown"}
- calorieTarget: ${profile.calorieTarget ?? "unknown"}
- proteinTarget: ${profile.proteinTarget ?? "unknown"}
- dislikes: ${profile.dislikes.join(", ") || "none"}
- allergies: ${profile.allergies.join(", ") || "none"}
- preferences: ${profile.preferences.join(", ") || "none"}
- dailyCaloriesConsumed: ${profile.dailyLoggedIntake.calories}
- dailyProteinConsumed: ${profile.dailyLoggedIntake.protein}
- mealsToday: ${profile.dailyLoggedIntake.meals.length}
    `.trim()

    const prompt = missing.length
      ? `Start a plan-building flow. First complete missing onboarding fields (${missing.join(", ")}) one by one. After missing onboarding is completed, build a food plan using the structured recipe and food databases, with calories/protein targets, allergies, dislikes, and preferences. ${profileSummary}`
      : `Build my plan now using the structured recipe and food databases. Use calorie and protein targets, dislikes, allergies, preferences, and current intake to produce a practical meal plan for today. ${profileSummary}`

    await triggerCoachAction({
      visibleMessage: "Build My Plan",
      prompt,
    })
  }

  async function handleUpdateWeight() {
    const raw = window.prompt("Enter your new current weight in kg:")
    if (!raw) return

    const value = Number(raw)
    if (!Number.isFinite(value) || value <= 0) {
      window.alert("Please enter a valid weight in kg.")
      return
    }

    const roundedWeight = Math.round(value * 10) / 10
    const updatedTargets = estimateTargetsForWeight(roundedWeight)

    setProfile((existing) => ({
      ...bumpStreak(existing),
      onboardingComplete: true,
      currentWeight: roundedWeight,
      calorieTarget: updatedTargets.calorieTarget,
      proteinTarget: updatedTargets.proteinTarget,
    }))

    await triggerCoachAction({
      visibleMessage: `Update Weight: ${roundedWeight} kg`,
      prompt: `My current weight is now ${roundedWeight} kg. Update my targets if needed, then coach me on what to do next this week. Also remind me to weigh every 7 days, first thing in the morning, after the toilet, before eating or drinking.`,
    })
  }

  async function handleResetGoalsStats() {
    const proceed = window.confirm("Reset Goals / Stats? This action cannot be undone.")
    if (!proceed) return

    const resetFull = window.confirm("Press OK for FULL reset (goals/profile/onboarding). Press Cancel for DAILY STATS reset only.")

    if (resetFull) {
      const fresh = createDefaultProfile()
      setProfile(bumpStreak(fresh))
      await triggerCoachAction({
        visibleMessage: "Reset Full Goals/Profile",
        prompt: "I reset my full goals/profile/onboarding. Start onboarding again from the beginning, one question at a time.",
      })
      return
    }

    setProfile((existing) => ({
      ...bumpStreak(existing),
      dailyLoggedIntake: {
        date: todayKey(),
        calories: 0,
        protein: 0,
        meals: [],
      },
    }))

    await triggerCoachAction({
      visibleMessage: "Reset Daily Stats",
      prompt: "I reset daily stats only. Keep my goals/profile, and ask me what I have eaten today so we can restart tracking.",
    })
  }

  return (
    <section className="bg-[#050910] px-3 py-4 text-white sm:px-4 sm:py-6">
      <div className="mx-auto w-full max-w-[460px] rounded-[30px] border border-white/10 bg-gradient-to-b from-[#101a2e] to-[#0a1220] p-3 shadow-[0_0_80px_rgba(93,123,255,0.12)] sm:p-4">
        <div className="rounded-3xl border border-white/10 bg-[#0a1120]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <button
            type="button"
            onClick={connectionState === "connected" ? stopConversation : startConversation}
            disabled={connectionState === "connecting"}
            aria-label={connectionState === "connected" ? "End conversation with George" : "Tap to talk"}
            className={`group relative mx-auto flex h-[166px] w-[166px] items-center justify-center rounded-full transition duration-300 ${
              connectionState === "connecting" ? "cursor-wait" : "hover:scale-[1.015]"
            } ${connectionState === "connected" || connectionState === "connecting" ? "animate-[pulse_2.2s_ease-in-out_infinite]" : ""}`}
            style={{
              background: "radial-gradient(circle at 32% 26%, #284775 0%, #1a2e52 52%, #0d1a33 100%)",
              boxShadow:
                connectionState === "connected" || connectionState === "connecting"
                  ? "0 0 0 6px rgba(93,123,255,0.2), 0 0 0 16px rgba(93,123,255,0.08), 0 22px 44px rgba(0,0,0,0.45), inset 0 8px 18px rgba(255,255,255,0.12), inset 0 -8px 18px rgba(0,0,0,0.25)"
                  : "0 0 0 6px rgba(93,123,255,0.28), 0 20px 40px rgba(0,0,0,0.4), inset 0 8px 18px rgba(255,255,255,0.12), inset 0 -8px 18px rgba(0,0,0,0.25)",
            }}
          >
            <span className="absolute inset-[12px] rounded-full border border-white/15" />
            <span className="absolute inset-x-[23%] top-[12%] h-6 rounded-full bg-white/10 blur-md" />
            <div className="relative z-10 flex items-center justify-center text-white">
              {connectionState === "connecting" ? <Loader2 className="h-10 w-10 animate-spin" /> : <Mic className="h-10 w-10" />}
            </div>
          </button>
          <p className="mt-4 text-center text-lg font-semibold tracking-wide text-white">Tap to Talk</p>
        </div>

        <div className="mt-3 rounded-3xl border border-white/10 bg-[#0c1424] p-3 sm:p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9fb4dc]">Daily Stats</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-[#8ea5cc]">Calories Left</p>
              <p className="mt-1 text-xl font-semibold">{profile.calorieTarget ? caloriesLeft : "—"}</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-[#8ea5cc]">Protein Left</p>
              <p className="mt-1 text-xl font-semibold">{profile.proteinTarget ? `${proteinLeft}g` : "—"}</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-[#8ea5cc]">Current Weight</p>
              <p className="mt-1 text-xl font-semibold">{profile.currentWeight ? `${profile.currentWeight} kg` : "—"}</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-[#8ea5cc]">Meals Today</p>
              <p className="mt-1 text-xl font-semibold">{profile.dailyLoggedIntake.meals.length}</p>
            </div>
            <div className="col-span-2 rounded-2xl bg-white/5 p-3">
              <p className="text-[#8ea5cc]">Day Streak</p>
              <p className="mt-1 text-xl font-semibold">{profile.dayStreak} days</p>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-3xl border border-white/10 bg-[#0b1322] p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#9fb4dc]">Actions</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => void handleBuildMyPlan()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-[#d5e3ff] transition hover:bg-white/10"
            >
              <Dumbbell className="h-4 w-4" />
              Build My Plan
            </button>
            <button
              type="button"
              onClick={() => void handleUpdateWeight()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-[#d5e3ff] transition hover:bg-white/10"
            >
              <Scale className="h-4 w-4" />
              Update Weight
            </button>
            <button
              type="button"
              onClick={() => void handleResetGoalsStats()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-[#d5e3ff] transition hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Goals / Stats
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-3xl border border-white/10 bg-[#0a1222] p-3">
          <div className="mb-3 flex items-center gap-2 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1b2a44] text-[#9cb7e4]">
              <MessageSquareText className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9fb4dc]">Chat</p>
          </div>
          <div ref={chatScrollRef} className="h-[380px] space-y-3 overflow-y-auto rounded-2xl bg-white/[0.03] p-3">
            {messages
              .filter((message) => message.role !== "system")
              .map((message) => {
                const isUser = message.role === "user"
                return (
                  <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-6 ${
                        isUser ? "bg-[#365fa5] text-white" : "border border-white/10 bg-[#121f35] text-[#dce8ff]"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                )
              })}
            {messages.filter((message) => message.role !== "system").length === 0 ? (
              <p className="px-1 py-2 text-sm text-[#93a6ca]">Your conversation will appear here.</p>
            ) : null}
          </div>
        </div>

        {error ? <p className="mt-3 text-center text-sm font-medium text-[#ff8892]">{error}</p> : null}
      </div>
    </section>
  )
}
