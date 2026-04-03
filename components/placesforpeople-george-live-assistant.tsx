"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Loader2,
  MapPinned,
  PhoneOff,
  RotateCcw,
  Sparkles,
  Waves,
  BadgeHelp,
  Users,
  Clock3,
} from "lucide-react"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

const STORAGE_KEY = "placesforpeople-george-session-v2"

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "system",
    content:
      "Hi — I'm George for Steyning Leisure Centre. I can help with memberships, swimming, classes, facilities, opening times, getting around the centre, and guided gym sessions. If you want a workout, I'll work out whether you're a beginner, intermediate or advanced, then guide you through it step by step. Tap the button and speak to me whenever you're ready.",
  },
]

const QUICK_LINKS = [
  { label: "Join now", href: "https://placesleisure.gladstonego.cloud/Pages/BookingsPage?centerId=1066", icon: Sparkles },
  { label: "View timetable", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/timetable", icon: CalendarDays },
  { label: "Fitness & Health", href: "https://www.placesleisure.org/activities/fitness-and-health", icon: Dumbbell },
  { label: "Swimming & Lessons", href: "https://www.placesleisure.org/activities/swimming", icon: Waves },
  { label: "Centre information", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex", icon: MapPinned },
  { label: "Contact Steyning", href: "https://www.placesleisure.org/contact-us", icon: Users },
  { label: "Opening times", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex#centre-info", icon: Clock3 },
  { label: "FAQs", href: "https://www.placesleisure.org/faqs", icon: BadgeHelp },
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

function buildFirstResponseEvent(visitorName: string | null, hasStoredSession: boolean, lastUserMessage: string | null) {
  const instructions = hasStoredSession
    ? `Introduce yourself as George for Steyning Leisure Centre in warm, natural British English. This visitor has an ongoing conversation with you on this device, so welcome them back briefly and continue naturally instead of restarting. ${visitorName ? `Their name is ${visitorName}. Use it lightly.` : ""} ${lastUserMessage ? `The last thing they said was: ${lastUserMessage}` : ""} Ask one short helpful question about what they want help with next.`
    : "Introduce yourself as George for Steyning Leisure Centre in warm, natural British English. Keep it short, confident, welcoming, and practical. Make it clear you can help with the gym, swimming, classes, memberships, opening times, facilities, directions around the centre, and guided workout flows. Mention that if they want a workout you can quickly work out whether they are a beginner, intermediate or advanced and guide them through the session step by step. Ask one short question about what they want help with first."

  return {
    type: "response.create",
    response: { instructions },
  }
}

export function PlacesForPeopleGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [isModelSpeaking, setIsModelSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasStoredSession, setHasStoredSession] = useState(false)
  const [visitorName, setVisitorName] = useState<string | null>(null)
  const [showConversation, setShowConversation] = useState(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const canStart = useMemo(() => connectionState === "idle" || connectionState === "error", [connectionState])
  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant")?.content ?? INITIAL_MESSAGES[0].content,
    [messages],
  )
  const latestUserMessage = useMemo(() => [...messages].reverse().find((message) => message.role === "user")?.content ?? null, [messages])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, connectionState, showConversation])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const stored = JSON.parse(raw) as StoredSession
      if (Array.isArray(stored?.messages) && stored.messages.length > 1) {
        setMessages(stored.messages)
        setHasStoredSession(true)
        setVisitorName(stored.visitorName || detectVisitorName(stored.messages))
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

  function clearSavedSession() {
    void cleanupConversation()
    setMessages(INITIAL_MESSAGES)
    setVisitorName(null)
    setHasStoredSession(false)
    setError(null)
    setConnectionState("idle")
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {}
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

  function handleRealtimeEvent(event: any) {
    const type = event?.type
    if (!type) return

    switch (type) {
      case "response.output_audio.delta":
      case "response.created":
        setIsModelSpeaking(true)
        break
      case "response.output_audio.done":
        setIsModelSpeaking(false)
        break
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

    await cleanupConversation()
    setConnectionState("connecting")
    setError(null)
    setMessages((prev) => (hasStoredSession && prev.length > 1 ? prev : INITIAL_MESSAGES))

    try {
      const tokenResponse = await fetch("/api/placesforpeople-session", {
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
        const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? null
        const event = buildFirstResponseEvent(visitorName, hasStoredSession && messages.length > 1, lastUserMessage)
        window.setTimeout(() => {
          dataChannel.send(JSON.stringify(event))
        }, 150)
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
    await cleanupConversation()
    setError(null)
    setConnectionState("idle")
  }

  return (
    <section className="rounded-[32px] border border-[#d6e3de] bg-white shadow-[0_28px_80px_rgba(10,56,52,0.10)]">
      <div className="grid gap-8 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
        <div>
          <div className="inline-flex items-center rounded-full bg-[#e8f2ef] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#235a54]">
            Live with George
          </div>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-[#163632] sm:text-4xl">Talk to George about the centre</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#50625f]">
            George can help visitors with memberships, classes, swimming, gym questions, opening times, facilities,
            accessibility, and simple workout guidance that matches what they want to do.
          </p>

          <div className="mt-8 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={connectionState === "connected" ? stopConversation : startConversation}
              disabled={connectionState === "connecting"}
              className={`relative flex h-[220px] w-[220px] items-center justify-center rounded-full transition duration-300 ${
                connectionState === "connecting" ? "cursor-wait" : "hover:scale-[1.02]"
              } ${connectionState === "connected" || connectionState === "connecting" ? "animate-[pulse_2s_ease-in-out_infinite]" : "animate-[pulse_4s_ease-in-out_infinite]"}`}
              style={{
                background: "radial-gradient(circle at 30% 25%, #7fe0cc 0%, #22a08c 30%, #126d63 64%, #0c4d46 100%)",
                boxShadow:
                  connectionState === "connected" || connectionState === "connecting"
                    ? "0 0 0 10px rgba(18,109,99,0.10), 0 28px 60px rgba(12,77,70,0.32), inset 0 3px 18px rgba(255,255,255,0.32), inset 0 -14px 28px rgba(7,52,47,0.35)"
                    : "0 24px 54px rgba(12,77,70,0.24), inset 0 3px 18px rgba(255,255,255,0.28), inset 0 -14px 28px rgba(7,52,47,0.34)",
              }}
            >
              <span className="pointer-events-none absolute inset-[10px] rounded-full border border-white/20" />
              <span className="pointer-events-none absolute left-[12%] top-[12%] h-[20%] w-[48%] rounded-full bg-white/28 blur-[10px]" />
              <div className="relative z-10 flex h-[78%] w-[78%] items-center justify-center rounded-full bg-[linear-gradient(180deg,#f6fffc_0%,#d4f3eb_100%)] text-center shadow-[inset_0_4px_12px_rgba(255,255,255,0.8),0_14px_30px_rgba(0,0,0,0.12)]">
                <div>
                  <div className="text-[20px] font-black uppercase tracking-[0.22em] text-[#0d554d]">George</div>
                  <div className="mt-2 px-4 text-sm font-medium leading-6 text-[#2d5d57]">
                    {connectionState === "connected" ? "Tap to end" : connectionState === "connecting" ? "Connecting…" : "Tap to speak"}
                  </div>
                </div>
              </div>
            </button>

            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#126d63]">
                {connectionState === "connected"
                  ? isModelSpeaking
                    ? "George is talking"
                    : "George is live"
                  : connectionState === "connecting"
                    ? "Connecting George"
                    : hasStoredSession
                      ? "Ready to carry on"
                      : "Ready when you are"}
              </p>
              <p className="mt-3 text-base leading-7 text-[#24423f] sm:text-lg">{latestAssistantMessage}</p>
              {latestUserMessage ? <p className="mt-2 text-sm text-[#60716e]">You: {latestUserMessage}</p> : null}
              {error ? <p className="mt-3 text-sm font-medium text-[#b42318]">{error}</p> : null}

              <div className="mt-5 flex flex-wrap gap-3">
                {connectionState === "connected" ? (
                  <button
                    type="button"
                    onClick={stopConversation}
                    className="inline-flex items-center gap-2 rounded-full bg-[#0f5f56] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105"
                  >
                    <PhoneOff className="h-4 w-4" /> End conversation
                  </button>
                ) : hasStoredSession ? (
                  <button
                    type="button"
                    onClick={clearSavedSession}
                    className="inline-flex items-center gap-2 rounded-full border border-[#d6e3de] bg-white px-5 py-3 text-sm font-semibold text-[#355552] transition hover:bg-[#f7fbfa]"
                  >
                    <RotateCcw className="h-4 w-4" /> Start fresh
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setShowConversation((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full border border-[#d6e3de] bg-white px-5 py-3 text-sm font-semibold text-[#355552] transition hover:bg-[#f7fbfa]"
                >
                  {showConversation ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showConversation ? "Hide conversation" : "View conversation"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#dbe8e3] bg-[#f6fbf9] p-5">
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#126d63]">Helpful buttons</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon
              return (
                <a
                  key={link.label}
                  href={link.href}
                  className="flex items-center justify-between gap-3 rounded-[20px] bg-[#0f5f56] px-4 py-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,95,86,0.16)] transition hover:-translate-y-0.5 hover:brightness-105"
                >
                  <span>{link.label}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12">
                    <Icon className="h-4 w-4" />
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      </div>

      {showConversation ? (
        <div className="border-t border-[#d6e3de] bg-[#fbfefd] px-6 py-6 lg:px-8 lg:py-8">
          <div ref={scrollRef} className="mx-auto max-h-[420px] w-full max-w-4xl overflow-y-auto">
            <div className="flex flex-col gap-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[92%] whitespace-pre-wrap rounded-[24px] px-5 py-4 text-[15px] leading-7 shadow-sm sm:max-w-[84%] sm:text-[16px] ${
                      message.role === "user"
                        ? "rounded-br-md bg-[#0f5f56] text-white"
                        : message.role === "assistant"
                          ? "rounded-bl-md border border-[#dde9e5] bg-white text-[#163632]"
                          : "rounded-bl-md border border-[#dde9e5] bg-[#f6fbf9] text-[#50625f]"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {connectionState === "connecting" && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-3 rounded-[24px] rounded-bl-md border border-[#dde9e5] bg-white px-5 py-4 text-[#24423f] shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> George is joining the conversation…
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
