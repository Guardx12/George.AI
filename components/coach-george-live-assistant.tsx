"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Activity,
  BarChart3,
  ChevronRight,
  Dumbbell,
  Flame,
  Loader2,
  PhoneOff,
  Salad,
  UtensilsCrossed,
} from "lucide-react"

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

type CoachProfile = {
  country: Country
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goal: Goal
}

type CoachStats = {
  caloriesTarget: number
  proteinTarget: number
  caloriesUsed: number
  proteinUsed: number
  mealsToday: number
  streak: number
  lastActiveDate: string | null
}

type QuickActionKey = "log_meal" | "off_track" | "what_eat" | "workout"

const STORAGE_KEY = "coach-george-v3-messages"
const PROFILE_KEY = "coach-george-profile-v1"
const STATS_KEY = "coach-george-stats-v5"

const DEFAULT_STATS: CoachStats = {
  caloriesTarget: 2200,
  proteinTarget: 180,
  caloriesUsed: 0,
  proteinUsed: 0,
  mealsToday: 0,
  streak: 0,
  lastActiveDate: null,
}

const INITIAL_MESSAGES: LiveMessage[] = [
  { id: "intro", role: "system", content: "Tap and talk. I’ll guide you from there." },
]

const QUICK_ACTIONS: Array<{ key: QuickActionKey; label: string; icon: any }> = [
  { key: "log_meal", label: "Log meal", icon: UtensilsCrossed },
  { key: "off_track", label: "Went off track", icon: Flame },
  { key: "what_eat", label: "What should I eat?", icon: Salad },
  { key: "workout", label: "Give me a workout", icon: Dumbbell },
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
  return messages.slice(-24)
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayIso() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function markUsage(stats: CoachStats): CoachStats {
  const today = todayIso()
  if (stats.lastActiveDate === today) return stats
  if (stats.lastActiveDate === yesterdayIso()) {
    return { ...stats, streak: stats.streak + 1, lastActiveDate: today }
  }
  return { ...stats, streak: 1, lastActiveDate: today }
}

function caloriesLeft(stats: CoachStats) {
  return Math.max(0, stats.caloriesTarget - stats.caloriesUsed)
}

function proteinLeft(stats: CoachStats) {
  return Math.max(0, stats.proteinTarget - stats.proteinUsed)
}

function profileContext(profile: CoachProfile | null, stats: CoachStats) {
  if (!profile) {
    return `This is a first-time user with no saved profile yet. Start by onboarding them conversationally. Ask for goal, sex, age, height, weight, activity level, and country. Do it naturally, one step at a time. Once collected, explain that you will set calories and protein targets. Do not act like a website assistant.`
  }

  return `Saved profile:
- country: ${profile.country}
- sex: ${profile.sex}
- age: ${profile.age}
- height: ${profile.heightCm} cm
- weight: ${profile.weightKg} kg
- activity: ${profile.activityLevel}
- goal: ${profile.goal}
- calorie target: ${stats.caloriesTarget}
- protein target: ${stats.proteinTarget}
- calories left right now: ${caloriesLeft(stats)}
- protein left right now: ${proteinLeft(stats)}
- meals logged today: ${stats.mealsToday}
- streak: ${stats.streak}
Use this context automatically. Do not ask for it again unless the user says it changed.`
}

function buildFirstResponseEvent(profile: CoachProfile | null, stats: CoachStats) {
  return {
    type: "response.create",
    response: {
      instructions: `${profileContext(profile, stats)}\n\nIntroduce yourself as Coach George in warm, direct, natural English. Keep it short. If this is a first-time user, say you'll get them set up properly first and begin the conversational onboarding flow. If they already have a saved profile, greet them like a returning user and ask what they want help with right now. Do not mention websites, businesses, customers, visitors, or being a digital member of staff.`,
    },
  }
}

function buildQuickPrompt(actionKey: QuickActionKey, profile: CoachProfile | null, stats: CoachStats) {
  const context = profileContext(profile, stats)
  switch (actionKey) {
    case "log_meal":
      return `${context}\nThe user tapped Log meal. Start meal logging mode. Ask what they had before estimating anything. If details are vague, ask one short follow-up for portion or size. Then estimate calories and protein consistently and say what is left.`
    case "off_track":
      return `${context}\nThe user tapped Went off track. Reset them calmly but firmly. Ask what actually happened. Do not shame them. Once you know enough, tell them the next best move for today.`
    case "what_eat":
      return `${context}\nThe user tapped What should I eat. You must manage the day intelligently. Consider how many meals are likely left. Never use all remaining calories in one meal unless it is clearly the last meal of the day. Give specific portion sizes, approximate calories, and protein for the next meal.`
    case "workout":
      return `${context}\nThe user tapped Give me a workout. Ask only what you need, like home or gym and time available, then give a simple structured workout.`
  }
}

function buildCoachGuidance(profile: CoachProfile | null, stats: CoachStats) {
  if (!profile) return "First time here? Tap to talk and George will set everything up with you."
  const cals = caloriesLeft(stats)
  const protein = proteinLeft(stats)
  if (stats.mealsToday === 0) return `You’re set for ${stats.caloriesTarget} kcal and ${stats.proteinTarget}g protein today. Start by logging your first meal.`
  if (stats.mealsToday === 1) return `Good start. You’ve got ${cals} kcal and ${protein}g protein left. Keep the next meal controlled.`
  return `You’ve got ${cals} kcal and ${protein}g protein left. Keep the rest of the day tight.`
}

export function CoachGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [statusText, setStatusText] = useState("Tap to talk")
  const [isModelSpeaking, setIsModelSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<CoachStats>(DEFAULT_STATS)
  const [profile, setProfile] = useState<CoachProfile | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const queuedPromptRef = useRef<string | null>(null)

  const latestAssistantMessage = useMemo(() => {
    const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant")
    if (latestAssistant) return latestAssistant.content
    return buildCoachGuidance(profile, stats)
  }, [messages, profile, stats])

  const canStart = connectionState !== "connecting"

  useEffect(() => {
    try {
      const rawMessages = window.localStorage.getItem(STORAGE_KEY)
      if (rawMessages) {
        const parsed = JSON.parse(rawMessages)
        if (Array.isArray(parsed?.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages)
        }
      }
    } catch {}

    try {
      const rawStats = window.localStorage.getItem(STATS_KEY)
      if (rawStats) {
        const parsed = JSON.parse(rawStats)
        if (parsed && typeof parsed === "object") {
          setStats({ ...DEFAULT_STATS, ...parsed })
        }
      }
    } catch {}

    try {
      const rawProfile = window.localStorage.getItem(PROFILE_KEY)
      if (rawProfile) {
        const parsed = JSON.parse(rawProfile)
        if (parsed && typeof parsed === "object") setProfile(parsed)
      }
    } catch {}
  }, [])

  useEffect(() => {
    return () => {
      void cleanupConversation()
    }
  }, [])

  useEffect(() => {
    try {
      const trimmed = trimMessagesForStorage(messages)
      if (trimmed.length <= 1) window.localStorage.removeItem(STORAGE_KEY)
      else window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: trimmed }))
    } catch {}
  }, [messages])

  useEffect(() => {
    try {
      window.localStorage.setItem(STATS_KEY, JSON.stringify(stats))
    } catch {}
  }, [stats])

  useEffect(() => {
    try {
      if (profile) window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
    } catch {}
  }, [profile])

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
    setIsModelSpeaking(false)
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
  }

  function sendTextPrompt(prompt: string) {
    const dc = dcRef.current
    if (!dc || dc.readyState !== "open") return
    addUserTranscript(prompt)
    dc.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      }),
    )
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
        setStatusText("Listening")
        break
      case "input_audio_buffer.speech_stopped":
        setStatusText("Thinking")
        break
      case "response.created":
        setIsModelSpeaking(true)
        setStatusText("George is replying")
        break
      case "response.output_audio.delta":
        setIsModelSpeaking(true)
        setStatusText("George is replying")
        break
      case "response.output_audio.done":
        setIsModelSpeaking(false)
        setStatusText("Listening")
        break
      case "response.output_audio_transcript.delta":
        appendOrUpdateAssistantPartial(typeof event.delta === "string" ? event.delta : "")
        break
      case "response.output_audio_transcript.done":
        appendOrUpdateAssistantPartial(typeof event.transcript === "string" ? event.transcript : "", true)
        break
      case "conversation.item.input_audio_transcription.completed":
        addUserTranscript(typeof event.transcript === "string" ? event.transcript : "")
        setStats((prev) => markUsage(prev))
        break
      case "error": {
        const message = event?.error?.message || "George hit a voice error."
        setError(message)
        setStatusText("Connection problem")
        break
      }
      default:
        break
    }
  }

  async function startConversation() {
    if (!canStart) return
    await cleanupConversation()
    setConnectionState("connecting")
    setError(null)
    setStatusText("Connecting")
    try {
      const tokenResponse = await fetch("/api/george-session", { method: "GET", cache: "no-store" })
      const tokenData = await tokenResponse.json().catch(() => null)
      if (!tokenResponse.ok) throw new Error(typeof tokenData?.error === "string" ? tokenData.error : "Could not create a secure live session.")
      const ephemeralKey = tokenData?.value ?? tokenData?.client_secret?.value
      if (typeof ephemeralKey !== "string" || !ephemeralKey) throw new Error("Live voice token was missing.")

      const pc = new RTCPeerConnection()
      pcRef.current = pc
      const audio = document.createElement("audio")
      audio.autoplay = true
      audio.playsInline = true
      audioRef.current = audio
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0]
        void audio.play().catch(() => {})
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      const dc = pc.createDataChannel("oai-events")
      dcRef.current = dc
      dc.addEventListener("open", () => {
        setConnectionState("connected")
        setStatusText("Listening")
        setStats((prev) => markUsage(prev))
        window.setTimeout(() => {
          dc.send(JSON.stringify(buildFirstResponseEvent(profile, stats)))
          if (queuedPromptRef.current) {
            const prompt = queuedPromptRef.current
            queuedPromptRef.current = null
            window.setTimeout(() => sendTextPrompt(prompt), 300)
          }
        }, 120)
      })
      dc.addEventListener("message", (event) => {
        try {
          handleRealtimeEvent(JSON.parse(event.data))
        } catch {}
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${ephemeralKey}`, "Content-Type": "application/sdp" },
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
      setStatusText("Could not connect")
      setError(err instanceof Error ? err.message : "Could not connect George right now.")
    }
  }

  async function stopConversation() {
    await cleanupConversation()
    setConnectionState("idle")
    setStatusText("Tap to talk")
    setError(null)
  }

  function handleQuickAction(actionKey: QuickActionKey) {
    setStats((prev) => {
      let next = markUsage(prev)
      if (actionKey === "log_meal") next = { ...next, mealsToday: next.mealsToday + 1 }
      return next
    })
    const prompt = buildQuickPrompt(actionKey, profile, stats)
    if (connectionState === "connected") {
      sendTextPrompt(prompt)
      return
    }
    queuedPromptRef.current = prompt
    void startConversation()
  }

  const statusTone =
    connectionState === "connected"
      ? "text-emerald-300"
      : connectionState === "connecting"
      ? "text-cyan-200"
      : connectionState === "error"
      ? "text-rose-300"
      : "text-slate-400"

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020305] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(18,206,191,0.12),transparent_28%),radial-gradient(circle_at_50%_38%,rgba(14,165,233,0.10),transparent_32%),linear-gradient(180deg,#020305_0%,#04070d_38%,#020305_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:100%_18px,18px_100%] opacity-[0.06]" />
        <div className="absolute left-1/2 top-24 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 pb-10 pt-8 sm:px-8">
        <div className="mb-5 flex items-center justify-center">
          <div className="text-center">
            <div className="text-3xl font-semibold tracking-[0.22em] text-white sm:text-4xl">GEORGE</div>
            <div className={`mt-2 text-[11px] uppercase tracking-[0.34em] ${statusTone}`}>{statusText}</div>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center">
          <button
            type="button"
            onClick={connectionState === "connected" ? stopConversation : startConversation}
            disabled={connectionState === "connecting"}
            className={`group relative mx-auto flex h-[17rem] w-[17rem] items-center justify-center rounded-full transition duration-300 sm:h-[20rem] sm:w-[20rem] ${
              connectionState === "connecting" ? "cursor-wait" : "hover:scale-[1.01]"
            }`}
            aria-label={connectionState === "connected" ? "Stop talking to George" : "Tap to talk to George"}
          >
            <span className={`absolute inset-[-5%] rounded-full border border-cyan-300/18 ${connectionState === "connected" ? "animate-[pulse_3s_ease-in-out_infinite]" : ""}`} />
            <span className={`absolute inset-[-1%] rounded-full border border-amber-300/12 ${connectionState === "connected" ? "animate-[pulse_2.2s_ease-in-out_infinite]" : ""}`} />
            <span className="absolute inset-[3%] rounded-full border border-white/8 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_0_120px_rgba(34,211,238,0.10)]" />
            <span className="absolute inset-[10%] rounded-full bg-[conic-gradient(from_180deg,rgba(6,182,212,0.05),rgba(34,211,238,0.20),rgba(251,191,36,0.16),rgba(34,211,238,0.12),rgba(6,182,212,0.05))]" />
            <span className="absolute inset-[14%] rounded-full bg-[repeating-conic-gradient(from_0deg,rgba(255,255,255,0.08)_0deg,rgba(255,255,255,0.08)_2deg,transparent_2deg,transparent_18deg)] opacity-20" />
            <span className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.15),rgba(255,255,255,0.02)_18%,rgba(34,211,238,0.22)_45%,rgba(2,6,23,0.98)_75%)] shadow-[0_0_120px_rgba(34,211,238,0.16)]" />

            <span className="relative z-10 flex h-[58%] w-[58%] flex-col items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.16),rgba(255,255,255,0.03)_20%,rgba(56,189,248,0.12)_42%,rgba(2,6,23,0.98)_78%)] shadow-[0_0_0_8px_rgba(255,255,255,0.02),0_0_80px_rgba(16,185,129,0.10)]">
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur">
                {connectionState === "connecting" ? (
                  <Loader2 className="h-7 w-7 animate-spin text-white" />
                ) : connectionState === "connected" ? (
                  <Activity className="h-7 w-7 text-emerald-200" />
                ) : (
                  <BarChart3 className="h-7 w-7 text-white" />
                )}
              </span>
              <span className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">George</span>
              <span className="mt-1 text-sm text-slate-300">Tap to talk</span>
            </span>
          </button>

          {error ? <p className="mt-4 text-sm font-medium text-rose-300">{error}</p> : null}

          <div className="mt-8 grid w-full max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Calories left", value: String(caloriesLeft(stats)) },
              { label: "Protein left", value: `${proteinLeft(stats)}g` },
              { label: "Meals today", value: String(stats.mealsToday) },
              { label: "Day streak", value: `${stats.streak}` },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[1rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(4,8,14,0.94))] px-4 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{stat.label}</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid w-full max-w-4xl gap-3 sm:grid-cols-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => handleQuickAction(action.key)}
                  className="group flex items-center gap-3 rounded-[1rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(3,7,12,0.96))] px-4 py-4 text-left text-white transition hover:border-cyan-300/25 hover:shadow-[0_0_40px_rgba(34,211,238,0.06)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex flex-1 items-center justify-between gap-2">
                    <span className="text-lg font-medium tracking-tight">{action.label}</span>
                    <ChevronRight className="h-4 w-4 text-slate-500 transition group-hover:text-white" />
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-4 w-full max-w-4xl rounded-[1.2rem] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(8,145,178,0.12),rgba(3,9,16,0.88))] px-5 py-5 text-left backdrop-blur">
            <div className="text-[10px] uppercase tracking-[0.26em] text-cyan-100/75">Latest from George</div>
            <p className="mt-2 text-xl leading-8 text-white">{latestAssistantMessage}</p>
          </div>

          {messages.length > 1 ? (
            <div className="mt-4 w-full max-w-4xl rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4 text-left backdrop-blur">
              <div className="mb-3 text-[10px] uppercase tracking-[0.24em] text-slate-500">Conversation</div>
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {messages.slice(-8).map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-[1rem] px-4 py-3 text-sm leading-7 sm:text-[15px] ${
                      message.role === "user"
                        ? "ml-auto max-w-[88%] bg-[linear-gradient(135deg,#7dd3fc,#2dd4bf)] text-slate-950"
                        : message.role === "assistant"
                        ? "mr-auto max-w-[88%] border border-white/10 bg-[#081220] text-white"
                        : "mr-auto max-w-[88%] border border-cyan-300/15 bg-cyan-300/10 text-cyan-50"
                    }`}
                  >
                    {message.content}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {connectionState === "connected" ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={stopConversation}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-95"
              >
                <PhoneOff className="h-4 w-4" /> End conversation
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
