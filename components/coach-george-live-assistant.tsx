"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronDown,
  ChevronUp,
  Flame,
  Loader2,
  Mic,
  PhoneOff,
  Salad,
  UtensilsCrossed,
  Dumbbell,
  Activity,
  Droplets,
} from "lucide-react"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

type CoachStats = {
  caloriesLeft: number
  proteinLeft: number
  mealsToday: number
  streak: number
  waterToday: number
  lastActiveDate: string | null
}

const STORAGE_KEY = "coach-george-v1"
const STATS_KEY = "coach-george-stats-v2"
const DEFAULT_STATS: CoachStats = {
  caloriesLeft: 1240,
  proteinLeft: 86,
  mealsToday: 0,
  streak: 0,
  waterToday: 0,
  lastActiveDate: null,
}

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "system",
    content:
      "Hi — I'm Coach George. Tap the circle and talk to me. I’ll help with food, workouts, accountability, and getting you back on track fast.",
  },
]

const QUICK_ACTIONS = [
  { key: "log_meal", label: "Log meal", icon: UtensilsCrossed, prompt: "Let's log a meal. What have you had so far today?" },
  { key: "off_track", label: "I went off track", icon: Flame, prompt: "I've gone off track today. Help me reset and get back on track now." },
  { key: "what_eat", label: "What should I eat?", icon: Salad, prompt: "Help me decide what to eat next based on staying on track today." },
  { key: "workout", label: "Give me a workout", icon: Dumbbell, prompt: "Give me a simple workout based on my time and energy today." },
] as const

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

function buildFirstResponseEvent() {
  return {
    type: "response.create",
    response: {
      instructions:
        "Introduce yourself as Coach George in warm, direct, natural English. Keep it short. Say you are their fitness coach for food, workouts, accountability, and getting back on track when life gets busy. Do not mention websites, businesses, customers, visitors, leads, or being a digital member of staff. Then ask one simple question about what they want help with right now.",
    },
  }
}

export function CoachGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [statusText, setStatusText] = useState("Ready when you are")
  const [isModelSpeaking, setIsModelSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConversation, setShowConversation] = useState(false)
  const [stats, setStats] = useState<CoachStats>(DEFAULT_STATS)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const queuedPromptRef = useRef<string | null>(null)

  const latestAssistantMessage = useMemo(() => {
    const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant")
    if (latestAssistant) return latestAssistant.content
    return "Tap and talk. I’ll guide you from there."
  }, [messages])

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
  }, [])

  useEffect(() => {
    return () => {
      void cleanupConversation()
    }
  }, [])

  useEffect(() => {
    if (!showConversation || !scrollRef.current) return
    const node = scrollRef.current
    node.scrollTop = node.scrollHeight
  }, [messages, showConversation])

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
        setStatusText("Listening…")
        break
      case "input_audio_buffer.speech_stopped":
        setStatusText("Thinking…")
        break
      case "response.created":
        setIsModelSpeaking(true)
        setStatusText("George is replying…")
        break
      case "response.output_audio.delta":
        setIsModelSpeaking(true)
        setStatusText("George is replying…")
        break
      case "response.output_audio.done":
        setIsModelSpeaking(false)
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
        setStats((prev) => markUsage(prev))
        break
      case "error": {
        const message = event?.error?.message || "George hit a voice error."
        setError(message)
        setStatusText("There was a connection problem")
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
    setStatusText("Connecting George…")
    try {
      const tokenResponse = await fetch("/api/george-session", { method: "GET", cache: "no-store" })
      const tokenData = await tokenResponse.json().catch(() => null)
      if (!tokenResponse.ok) throw new Error(typeof tokenData?.error === "string" ? tokenData.error : "Could not create a secure live session.")
      const ephemeralKey = tokenData?.value
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
        setStatusText("Listening…")
        setStats((prev) => markUsage(prev))
        window.setTimeout(() => {
          dc.send(JSON.stringify(buildFirstResponseEvent()))
          if (queuedPromptRef.current) {
            const prompt = queuedPromptRef.current
            queuedPromptRef.current = null
            window.setTimeout(() => sendTextPrompt(prompt), 350)
          }
        }, 150)
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

  function handleQuickAction(actionKey: string, prompt: string) {
    setStats((prev) => {
      let next = markUsage(prev)
      if (actionKey === "log_meal") next = { ...next, mealsToday: next.mealsToday + 1 }
      return next
    })
    if (connectionState === "connected") {
      sendTextPrompt(prompt)
      return
    }
    queuedPromptRef.current = prompt
    void startConversation()
  }

  const statusTone = connectionState === "connected" ? "text-emerald-200" : connectionState === "connecting" ? "text-cyan-100" : "text-slate-300"

  return (
    <div className="w-full">
      <div className="rounded-[2.2rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6">
        <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(7,19,31,0.98),rgba(8,20,36,0.98))] p-5 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-100">
                <Activity className="h-3.5 w-3.5" /> Live coach mode
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Talk to Coach George</h2>
              <p className="mt-3 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                Food, workouts, accountability, and getting you back on track — without overthinking it.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Calories left", value: String(stats.caloriesLeft) },
                  { label: "Protein left", value: `${stats.proteinLeft}g` },
                  { label: "Meals today", value: String(stats.mealsToday) },
                  { label: "Streak", value: `${stats.streak} day${stats.streak === 1 ? "" : "s"}` },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{stat.label}</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon
                  return (
                    <button
                      key={action.key}
                      type="button"
                      onClick={() => handleQuickAction(action.key, action.prompt)}
                      className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm text-slate-100 transition hover:border-cyan-300/30 hover:bg-white/[0.08]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Icon className="h-4 w-4 text-cyan-200" />
                        {action.label}
                      </span>
                      <span className="text-xs uppercase tracking-[0.16em] text-slate-500">Start</span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-5 rounded-3xl border border-cyan-400/15 bg-cyan-400/10 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/75">Latest from George</div>
                <p className="mt-2 text-base leading-7 text-cyan-50">{latestAssistantMessage}</p>
                {error ? <p className="mt-3 text-sm font-medium text-rose-300">{error}</p> : null}
              </div>
            </div>

            <div className="order-1 flex justify-center lg:order-2">
              <div className="relative flex h-[25rem] w-[25rem] items-center justify-center sm:h-[28rem] sm:w-[28rem]">
                <div className="absolute inset-[4%] rounded-full border border-emerald-300/8 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.04),transparent_65%)]" />
                <div className={`absolute inset-[1%] rounded-full border border-cyan-300/12 ${connectionState === "connected" ? "animate-[pulse_2.6s_ease-in-out_infinite]" : ""}`} />
                <div className="absolute inset-[6%] rounded-full border border-white/6" />
                <div className="absolute inset-[10%] rounded-full border border-cyan-200/10" />
                <div className="absolute inset-[14%] rounded-full bg-[conic-gradient(from_210deg,rgba(34,211,238,0.1),rgba(16,185,129,0.18),rgba(56,189,248,0.08),rgba(34,211,238,0.1))] blur-[2px]" />
                <div className="absolute inset-[11%] rounded-full bg-[repeating-conic-gradient(from_0deg,rgba(255,255,255,0.07)_0deg,rgba(255,255,255,0.07)_2deg,transparent_2deg,transparent_14deg)] opacity-35" />
                <div className="absolute inset-[16%] rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(125,211,252,0.36),rgba(6,182,212,0.18)_38%,rgba(5,150,105,0.18)_64%,rgba(2,6,23,0.94)_78%)] shadow-[0_0_120px_rgba(34,211,238,0.16)]" />
                <div className="absolute inset-[18%] rounded-full border border-white/8" />

                <div className="absolute left-[7%] top-[22%] rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-300 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur">
                  Progress
                </div>
                <div className="absolute right-[5%] top-[34%] rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-300 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur">
                  Food
                </div>
                <div className="absolute bottom-[22%] left-[9%] rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-300 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur">
                  Accountability
                </div>
                <div className="absolute bottom-[18%] right-[9%] rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-300 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur">
                  Workouts
                </div>

                <button
                  type="button"
                  onClick={connectionState === "connected" ? stopConversation : startConversation}
                  disabled={connectionState === "connecting"}
                  className={`group relative z-10 flex h-[58%] w-[58%] items-center justify-center rounded-full transition duration-300 ${
                    connectionState === "connecting" ? "cursor-wait" : "hover:scale-[1.015]"
                  }`}
                  aria-label={connectionState === "connected" ? "Stop talking to George" : "Start talking to George"}
                >
                  <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.2),rgba(255,255,255,0.02)_30%,rgba(255,255,255,0)_45%)]" />
                  <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_55%,rgba(125,211,252,0.22),rgba(14,116,144,0.18),rgba(2,6,23,0.94))] shadow-[0_0_0_10px_rgba(255,255,255,0.02),0_0_90px_rgba(34,211,238,0.16)]" />
                  <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,rgba(34,211,238,0)_0deg,rgba(34,211,238,0.16)_50deg,rgba(16,185,129,0.12)_120deg,rgba(34,211,238,0)_180deg,rgba(34,211,238,0.12)_300deg,rgba(34,211,238,0)_360deg)] opacity-90" />
                  <span className={`absolute inset-[-3%] rounded-full border border-cyan-300/18 ${connectionState === "connected" ? "animate-[pulse_2s_ease-in-out_infinite]" : ""}`} />
                  <div className="relative z-10 flex flex-col items-center gap-3 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                      {connectionState === "connecting" ? (
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                      ) : connectionState === "connected" ? (
                        <Activity className="h-8 w-8 text-emerald-200" />
                      ) : (
                        <Mic className="h-8 w-8 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="text-3xl font-semibold text-white">George</div>
                      <div className={`mt-1 text-sm ${statusTone}`}>
                        {connectionState === "connected" ? (isModelSpeaking ? "George is talking" : "George is live") : statusText}
                      </div>
                    </div>
                  </div>
                </button>

                <div className="absolute bottom-[7%] left-1/2 -translate-x-1/2 text-center">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Tap and talk</div>
                  <div className="mt-1 text-sm text-slate-300">Tell George what’s going on. He’ll guide you from there.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowConversation((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
              >
                {showConversation ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showConversation ? "Hide conversation" : "View conversation"}
              </button>
              <button
                type="button"
                onClick={() => setStats((prev) => ({ ...markUsage(prev), waterToday: prev.waterToday + 1 }))}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
              >
                <Droplets className="h-4 w-4 text-cyan-200" /> Track water later
              </button>
            </div>
            {connectionState === "connected" ? (
              <button
                type="button"
                onClick={stopConversation}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-95"
              >
                <PhoneOff className="h-4 w-4" /> End conversation
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {showConversation ? (
        <div className="mt-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:p-6">
          <div ref={scrollRef} className="max-h-[420px] overflow-y-auto">
            <div className="flex flex-col gap-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[92%] whitespace-pre-wrap rounded-[24px] px-5 py-4 text-[15px] leading-7 sm:max-w-[86%] sm:text-[16px] ${
                      message.role === "user"
                        ? "rounded-br-md bg-cyan-500 text-slate-950"
                        : message.role === "assistant"
                          ? "rounded-bl-md border border-white/10 bg-[#0b1c30] text-white"
                          : "rounded-bl-md border border-cyan-400/20 bg-cyan-400/10 text-cyan-50"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
