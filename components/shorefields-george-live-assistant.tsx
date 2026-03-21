"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Loader2,
  MapPinned,
  Mic,
  PhoneOff,
  Sparkles,
  Ticket,
  Trees,
  UtensilsCrossed,
  BadgeHelp,
  PawPrint,
  Volume2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

const STORAGE_KEY = "shorefields-george-session-v1"

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "system",
    content:
      "Hello — I'm George, your Shorefield mascot and digital guide. I can help whether you're planning your stay or already here, and I can guide you around the park, point you towards facilities, entertainment, food, family fun and nearby walks — would you like help with that now?",
  },
]

const QUICK_LINKS = [
  { label: "Book Shorefield", href: "https://www.shorefield.co.uk/holidays/locations/shorefield-country-park", icon: Ticket },
  { label: "Park Map", href: "https://fls-9ed90804-04fe-49f0-b869-7d2f9e0d49c2.laravel.cloud/files/park-maps/shorefield-country-park-map-2026_dl.pdf", icon: MapPinned },
  { label: "Plan Your Stay", href: "https://www.shorefield.co.uk/holidays/locations/shorefield-country-park", icon: MapPinned },
  { label: "What’s On", href: "https://www.shorefield.co.uk/holidays/entertainment-and-activities/on-park-entertainment/whats-on-shorefield", icon: CalendarDays },
  { label: "Entertainment & Activities", href: "https://www.shorefield.co.uk/holidays/entertainment-and-activities/on-park-entertainment/whats-on-shorefield", icon: Sparkles },
  { label: "Health & Fitness", href: "https://www.shorefield.co.uk/health-fitness/shorefield-health-fitness-club", icon: PawPrint },
  { label: "Food & Drink", href: "https://www.shorefield.co.uk/holidays/locations/shorefield-country-park", icon: UtensilsCrossed },
  { label: "Accommodation", href: "https://www.shorefield.co.uk/holidays/locations/shorefield-country-park", icon: BedDouble },
  { label: "Nearby Attractions", href: "https://www.shorefield.co.uk/holidays/locations/shorefield-country-park", icon: Trees },
  { label: "FAQs", href: "https://www.shorefield.co.uk/frequently-asked-questions", icon: BadgeHelp },
  { label: "Back to Shorefield", href: "https://www.shorefield.co.uk/holidays/locations/shorefield-country-park", icon: ArrowLeft },
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
        .replace(/^(it'?s|its|i am|i'm|im|my name is|name'?s|this is|es)\s+/i, "")
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
    ? `Introduce yourself as George, Shorefield's mascot and digital guide, in warm, natural British English only. Keep it short, cheerful, upbeat, and family-friendly. This visitor already has an ongoing conversation with you on this device. Do not restart from scratch and do not ask again whether they are planning their stay or already here unless you truly need to. ${visitorName ? `Their name is ${visitorName}. Use it lightly and warmly.` : ""} ${lastUserMessage ? `The last thing they said before returning was: ${lastUserMessage}` : ""} Briefly welcome them back in a brighter, happier tone, pick up naturally, and ask one short forward-moving question such as what they can see now, where they are now, or what they want help with next. If it fits naturally, remind them you can help with families, facilities, wayfinding, kids mode and what to do next.`
    : "Introduce yourself as George, Shorefield's mascot and digital guide, in warm, natural British English only. Keep it short, cheerful, upbeat, and family-friendly. Briefly say you can help whether someone is planning their stay or already at the park. Then ask this exact question naturally: Are you planning your stay, or are you already here at Shorefield Country Park? Do not ask lots of questions at once. If they are planning, guide them towards the most relevant buttons on the page. If they are already here, guide them around the park, suggest what to do next, mention food or drink naturally where it fits, and offer a kid-friendly mode if children are involved. Use names lightly and warmly, not in every reply."

  return {
    type: "response.create",
    response: { instructions },
  }
}

export function ShorefieldsGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [statusText, setStatusText] = useState("Ready when you are")
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
        setStatusText("Ready to carry on")
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
    setStatusText("Ready when you are")
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
      case "session.created":
      case "session.updated":
        setStatusText("Live conversation on")
        break
      case "input_audio_buffer.speech_started":
        setStatusText("Listening…")
        break
      case "input_audio_buffer.speech_stopped":
        setStatusText("Thinking…")
        break
      case "response.created":
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
          setStatusText("There was a connection problem")
        } else {
          void cleanupConversation()
          setConnectionState("error")
          setStatusText("Could not connect George")
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
    setStatusText("Connecting George…")
    setMessages((prev) => (hasStoredSession && prev.length > 1 ? prev : INITIAL_MESSAGES))

    try {
      const tokenResponse = await fetch("/api/shorefields-session", {
        method: "GET",
        cache: "no-store",
      })

      const tokenData = await tokenResponse.json().catch(() => null)
      if (!tokenResponse.ok) {
        throw new Error(
          typeof tokenData?.error === "string" ? tokenData.error : "Could not create a secure live session.",
        )
      }

      const ephemeralKey = tokenData?.value
      if (typeof ephemeralKey !== "string" || !ephemeralKey) {
        throw new Error("Live voice token was missing.")
      }

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
        setStatusText("Live conversation on")
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
          if (typeof parsed?.error?.message === "string") {
            message = parsed.error.message
          }
        } catch {
          if (answer.includes("<html") || answer.includes("<!DOCTYPE html")) {
            message = "The live voice service timed out while connecting. Please try again."
          } else if (answer.trim()) {
            message = answer.trim()
          }
        }

        throw new Error(message)
      }

      await pc.setRemoteDescription({ type: "answer", sdp: answer })

      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") {
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
    setError(null)
    setConnectionState("idle")
    setStatusText(hasStoredSession ? "Ready to carry on" : "Ready when you are")
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="overflow-hidden rounded-[36px] border border-[#d8e9e7] bg-white shadow-[0_24px_80px_rgba(23,52,77,0.10)]">
        <div className="px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="mx-auto inline-flex rounded-full border border-[#d7ece8] bg-[#f4fbfa] px-6 py-3 text-sm font-semibold uppercase tracking-[0.24em] text-[#2a6a6b] shadow-sm">Shorefield Country Park</div>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-[#17344d] sm:text-5xl">Meet George</h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-[#4e687c] sm:text-lg">
            George helps before you arrive and while you&apos;re here, from planning your stay to finding your way around the park, discovering facilities, food, entertainment, nearby walks, and always knowing what to do next.
          </p>

          <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center">
            <button
              type="button"
              onClick={connectionState === "connected" ? stopConversation : startConversation}
              disabled={connectionState === "connecting"}
              aria-label={connectionState === "connected" ? "Stop talking to George" : "Start talking to George"}
              className={`group relative flex h-[250px] w-[250px] items-center justify-center rounded-full transition duration-300 ease-out sm:h-[300px] sm:w-[300px] ${
                connectionState === "connecting" ? "cursor-wait" : "hover:scale-[1.02]"
              } ${
                connectionState === "connected" || connectionState === "connecting"
                  ? "animate-[pulse_2s_ease-in-out_infinite]"
                  : "animate-[pulse_4s_ease-in-out_infinite]"
              }`}
              style={{
                background:
                  "radial-gradient(circle at 30% 22%, #a7ebe2 0%, #5fcfc0 24%, #1d8fa0 58%, #17344d 100%)",
                boxShadow:
                  connectionState === "connected" || connectionState === "connecting"
                    ? "0 0 0 10px rgba(95,207,192,0.14), 0 28px 60px rgba(23,52,77,0.26), inset 0 3px 18px rgba(255,255,255,0.34), inset 0 -14px 28px rgba(14,67,79,0.35)"
                    : "0 24px 54px rgba(23,52,77,0.18), inset 0 3px 18px rgba(255,255,255,0.28), inset 0 -14px 28px rgba(14,67,79,0.34)",
              }}
            >
              <span className="pointer-events-none absolute inset-[8px] rounded-full border border-white/20" />
              <span className="pointer-events-none absolute left-[12%] top-[10%] h-[22%] w-[52%] rounded-full bg-white/30 blur-[10px]" />
              <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0)_45%,rgba(255,255,255,0.13)_75%,rgba(255,255,255,0.24)_100%)]" />
              <img
                src="/george-preview.png"
                alt="George the Shorefield Country Park mascot and guide"
                className={`relative z-10 h-[80%] w-[80%] rounded-full object-cover drop-shadow-[0_18px_30px_rgba(0,0,0,0.22)] transition ${
                  connectionState === "connected" || connectionState === "connecting" ? "scale-[1.02]" : "scale-100"
                }`}
              />
              <span className="sr-only">{connectionState === "connected" ? "George is live" : "Start talking to George"}</span>
            </button>

            <div className="mt-6 min-h-[84px] max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#2a6a6b]">
                {connectionState === "connected"
                  ? isModelSpeaking
                    ? "George is talking"
                    : "George is live"
                  : connectionState === "connecting"
                    ? "Connecting George"
                    : hasStoredSession
                      ? "Ready to carry on"
                      : "Tap the circle to speak to George"}
              </p>
              <p className="mt-3 text-base leading-7 text-[#3f5d72] sm:text-lg">{latestAssistantMessage}</p>
              {latestUserMessage ? <p className="mt-2 text-sm text-[#6c8797]">You: {latestUserMessage}</p> : null}
              {error ? <p className="mt-3 text-sm font-medium text-[#196678]">{error}</p> : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
              {connectionState === "connected" ? (
                <button
                  type="button"
                  onClick={stopConversation}
                  className="inline-flex items-center gap-2 rounded-full bg-[#17344d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1c4766]"
                >
                  <PhoneOff className="h-4 w-4" /> End conversation
                </button>
              ) : hasStoredSession ? (
                <button
                  type="button"
                  onClick={clearSavedSession}
                  className="inline-flex items-center gap-2 rounded-full border border-[#d7ece8] bg-white px-5 py-3 text-sm font-semibold text-[#36566b] transition hover:bg-[#f4fbfa]"
                >
                  <RotateCcw className="h-4 w-4" /> Start fresh
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setShowConversation((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-[#d7ece8] bg-white px-5 py-3 text-sm font-semibold text-[#36566b] transition hover:bg-[#f4fbfa]"
              >
                {showConversation ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showConversation ? "Hide conversation" : "View conversation"}
              </button>
            </div>
          </div>
        </div>

        {showConversation ? (
          <div className="border-t border-[#d8e9e7] bg-[#f9fcfc] px-4 py-6 sm:px-6 sm:py-8">
            <div ref={scrollRef} className="mx-auto max-h-[420px] w-full max-w-3xl overflow-y-auto">
              <div className="flex flex-col gap-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[92%] whitespace-pre-wrap rounded-[24px] px-5 py-4 text-[15px] leading-7 shadow-sm sm:max-w-[86%] sm:text-[16px] ${
                        message.role === "user"
                          ? "rounded-br-md bg-[#17344d] text-white"
                          : message.role === "assistant"
                            ? "rounded-bl-md border border-[#dfeeed] bg-[#f4fbfa] text-[#17344d]"
                            : "rounded-bl-md border border-[#dfeeed] bg-white text-[#4e687c]"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {connectionState === "connecting" && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-3 rounded-[24px] rounded-bl-md border border-[#dfeeed] bg-[#f4fbfa] px-5 py-4 text-[#2a6a6b] shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> George is joining the conversation…
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="border-t border-[#d8e9e7] bg-[#f4fbfa] px-5 py-6 sm:px-8 sm:py-8">
          <h2 className="text-2xl font-bold tracking-tight text-[#17344d]">Helpful buttons</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon
              return (
                <a
                  key={link.label}
                  href={link.href}
                  className="group flex items-center justify-between gap-3 rounded-[22px] bg-[#17344d] px-4 py-4 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(23,52,77,0.18)] transition hover:-translate-y-0.5 hover:bg-[#1c4766]"
                >
                  <span>{link.label}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#63d1c4]/18">
                    <Icon className="h-4 w-4" />
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
