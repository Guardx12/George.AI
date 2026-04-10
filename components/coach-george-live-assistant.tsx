"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Activity,
  Dumbbell,
  Flame,
  Loader2,
  Mic,
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

type CoachStats = {
  caloriesLeft: number
  proteinLeft: number
  mealsToday: number
  streak: number
  lastActiveDate: string | null
}

const STORAGE_KEY = "coach-george-v1"
const STATS_KEY = "coach-george-stats-v3"
const DEFAULT_STATS: CoachStats = {
  caloriesLeft: 1240,
  proteinLeft: 86,
  mealsToday: 0,
  streak: 0,
  lastActiveDate: null,
}

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "system",
    content: "Tap and talk. I’ll guide you from there.",
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
        "Introduce yourself as Coach George in warm, direct, natural English. Keep it short. Say you help with food, workouts, accountability, and getting back on track when life gets busy. Do not mention websites, businesses, customers, visitors, leads, or being a digital member of staff. Ask one simple question about what they want help with right now. Sound like a real coach, not an assistant.",
    },
  }
}

export function CoachGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [statusText, setStatusText] = useState("Ready when you are")
  const [isModelSpeaking, setIsModelSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<CoachStats>(DEFAULT_STATS)

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

  const statusTone =
    connectionState === "connected"
      ? "text-emerald-300"
      : connectionState === "connecting"
        ? "text-cyan-200"
        : connectionState === "error"
          ? "text-rose-300"
          : "text-slate-400"

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04070b] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.14),transparent_28%),radial-gradient(circle_at_50%_35%,rgba(34,211,238,0.10),transparent_34%),linear-gradient(180deg,#04070b_0%,#06101a_42%,#04070b_100%)]" />
        <div className="absolute left-1/2 top-24 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[-8rem] h-[24rem] w-[24rem] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-8rem] h-[24rem] w-[24rem] rounded-full bg-teal-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 pb-10 pt-5 sm:px-8 sm:pb-12 sm:pt-7">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-lg font-semibold text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur">
              G
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight text-white">Coach George</div>
              <div className="text-xs text-slate-500">Live fitness coach</div>
            </div>
          </div>
          <div className={`text-xs uppercase tracking-[0.22em] ${statusTone}`}>{statusText}</div>
        </div>

        <div className="mt-8 flex flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-3xl text-center">
            <button
              type="button"
              onClick={connectionState === "connected" ? stopConversation : startConversation}
              disabled={connectionState === "connecting"}
              className={`group relative mx-auto flex h-[18.5rem] w-[18.5rem] items-center justify-center rounded-full sm:h-[22rem] sm:w-[22rem] ${
                connectionState === "connecting" ? "cursor-wait" : "hover:scale-[1.01]"
              } transition duration-300`}
              aria-label={connectionState === "connected" ? "Stop talking to George" : "Start talking to George"}
            >
              <span className={`absolute inset-[-8%] rounded-full border border-emerald-300/10 ${connectionState === "connected" ? "animate-[pulse_2.6s_ease-in-out_infinite]" : ""}`} />
              <span className={`absolute inset-[-2%] rounded-full border border-cyan-300/12 ${connectionState === "connected" ? "animate-[pulse_3.2s_ease-in-out_infinite]" : ""}`} />
              <span className="absolute inset-[8%] rounded-full border border-white/6" />
              <span className="absolute inset-[14%] rounded-full bg-[conic-gradient(from_180deg,rgba(16,185,129,0.05),rgba(34,211,238,0.18),rgba(16,185,129,0.08),rgba(34,211,238,0.04),rgba(16,185,129,0.05))] blur-[1px]" />
              <span className="absolute inset-[16%] rounded-full bg-[repeating-conic-gradient(from_0deg,rgba(255,255,255,0.06)_0deg,rgba(255,255,255,0.06)_2deg,transparent_2deg,transparent_16deg)] opacity-40" />
              <span className="absolute inset-[20%] rounded-full bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.22),rgba(103,232,249,0.12)_18%,rgba(16,185,129,0.16)_42%,rgba(2,6,23,0.95)_78%)] shadow-[0_0_100px_rgba(45,212,191,0.20)]" />
              <span className="absolute left-[6%] top-[22%] rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-slate-300 backdrop-blur sm:text-xs">Progress</span>
              <span className="absolute right-[6%] top-[34%] rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-slate-300 backdrop-blur sm:text-xs">Food</span>
              <span className="absolute bottom-[22%] left-[6%] rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-slate-300 backdrop-blur sm:text-xs">Accountability</span>
              <span className="absolute bottom-[22%] right-[6%] rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-slate-300 backdrop-blur sm:text-xs">Workouts</span>

              <span className="relative z-10 flex h-[56%] w-[56%] flex-col items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.18),rgba(255,255,255,0.04)_22%,rgba(255,255,255,0)_30%),radial-gradient(circle_at_50%_60%,rgba(45,212,191,0.18),rgba(8,145,178,0.18),rgba(2,6,23,0.96))] shadow-[0_0_0_10px_rgba(255,255,255,0.02),0_0_110px_rgba(20,184,166,0.16)]">
                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur">
                  {connectionState === "connecting" ? (
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  ) : connectionState === "connected" ? (
                    <Activity className="h-8 w-8 text-emerald-200" />
                  ) : (
                    <Mic className="h-8 w-8 text-white" />
                  )}
                </span>
                <span className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">George</span>
                <span className={`mt-2 text-sm ${statusTone}`}>{connectionState === "connected" ? (isModelSpeaking ? "George is talking" : "George is live") : statusText}</span>
              </span>
            </button>

            <div className="mt-6">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Tap and talk</div>
              <p className="mx-auto mt-2 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
                Tell George what’s going on. He’ll guide you from there.
              </p>
              {error ? <p className="mt-3 text-sm font-medium text-rose-300">{error}</p> : null}
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Calories left", value: String(stats.caloriesLeft) },
                { label: "Protein left", value: `${stats.proteinLeft}g` },
                { label: "Meals today", value: String(stats.mealsToday) },
                { label: "Streak", value: `${stats.streak}` },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-left backdrop-blur sm:px-5 sm:py-5">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 sm:text-[11px]">{stat.label}</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{stat.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.key}
                    type="button"
                    onClick={() => handleQuickAction(action.key, action.prompt)}
                    className="flex items-center gap-3 rounded-[1.3rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-left text-white transition hover:border-emerald-300/25 hover:bg-white/[0.07]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
                      <Icon className="h-5 w-5 text-cyan-200" />
                    </span>
                    <span className="text-lg font-medium tracking-tight">{action.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 rounded-[1.6rem] border border-emerald-300/12 bg-[linear-gradient(180deg,rgba(13,148,136,0.14),rgba(6,18,31,0.82))] px-5 py-5 text-left backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.24em] text-emerald-100/75 sm:text-[11px]">Latest from George</div>
              <p className="mt-2 text-lg leading-8 text-white">{latestAssistantMessage}</p>
            </div>

            {messages.length > 1 ? (
              <div className="mt-4 rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4 text-left backdrop-blur">
                <div className="mb-3 text-[10px] uppercase tracking-[0.24em] text-slate-500 sm:text-[11px]">Conversation</div>
                <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                  {messages.slice(-8).map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-[1.2rem] px-4 py-3 text-sm leading-7 sm:text-[15px] ${
                        message.role === "user"
                          ? "ml-auto max-w-[88%] bg-cyan-400 text-slate-950"
                          : message.role === "assistant"
                            ? "mr-auto max-w-[88%] border border-white/10 bg-[#0a1625] text-white"
                            : "mr-auto max-w-[88%] border border-emerald-300/15 bg-emerald-300/10 text-emerald-50"
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
    </div>
  )
}
