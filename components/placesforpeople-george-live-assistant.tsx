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
  { label: "Join now", href: "https://www.placesleisure.org/membership/", icon: CalendarDays },
  { label: "View timetable", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/timetable", icon: CalendarDays },
  { label: "Fitness & Health", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/fitness-health/", icon: Dumbbell },
  { label: "Swimming & Lessons", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/swimming-lessons/", icon: Waves },
  { label: "Centre information", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex", icon: MapPinned },
  { label: "Contact Steyning", href: "https://www.placesleisure.org/contact-us", icon: Users },
  { label: "Steyning opening times", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex#centre-info", icon: Clock3 },
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
    <section className="overflow-hidden rounded-[10px] border border-[#dddddd] bg-[#efefef] shadow-sm">
      <div className="px-4 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-[980px] text-center">
          <div className="text-[20px] font-semibold tracking-tight text-[#394553]">George</div>
          <h2 className="mt-2 text-[40px] font-black tracking-tight text-[#394553] sm:text-[56px]">Tap to speak</h2>
          <p className="mx-auto mt-4 max-w-[780px] text-[22px] leading-[1.8] text-[#394553] sm:text-[24px]">
            George can help with memberships, the live timetable, swimming, classes, centre information, and guided workouts.
          </p>

          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={connectionState === "connected" ? stopConversation : startConversation}
              disabled={connectionState === "connecting"}
              className={`relative flex h-[260px] w-[260px] items-center justify-center rounded-full border-[8px] border-[#1d2329] transition duration-300 ${
                connectionState === "connecting" ? "cursor-wait" : "hover:scale-[1.02]"
              } ${connectionState === "connected" || connectionState === "connecting" ? "animate-[pulse_2s_ease-in-out_infinite]" : ""}`}
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, #37b6ff 0%, #1498f8 34%, #0f2031 68%, #0a141c 100%)",
                boxShadow:
                  connectionState === "connected" || connectionState === "connecting"
                    ? "0 0 0 8px rgba(255,255,255,0.25), 0 0 0 18px rgba(57,69,83,0.18), 0 26px 40px rgba(0,0,0,0.28), inset 0 6px 18px rgba(255,255,255,0.12)"
                    : "0 0 0 8px rgba(255,255,255,0.22), 0 24px 38px rgba(0,0,0,0.24), inset 0 6px 18px rgba(255,255,255,0.1)",
              }}
            >
              <span className="absolute inset-[20px] rounded-full border border-[#5ed0ff]/40" />
              <span className="absolute left-[18%] top-[18%] h-5 w-5 rounded-full bg-[#31c7ff] shadow-[0_0_10px_rgba(49,199,255,0.9)]" />
              <span className="absolute right-[21%] top-[26%] h-3 w-3 rounded-full bg-[#31c7ff] shadow-[0_0_10px_rgba(49,199,255,0.9)]" />
              <span className="absolute left-[22%] bottom-[26%] h-3 w-3 rounded-full bg-[#31c7ff] shadow-[0_0_10px_rgba(49,199,255,0.9)]" />
              <span className="absolute right-[24%] bottom-[22%] h-5 w-5 rounded-full bg-[#31c7ff] shadow-[0_0_10px_rgba(49,199,255,0.9)]" />
              <div className="relative z-10 flex h-[80%] w-[80%] items-center justify-center rounded-full border-[6px] border-[#1d2329] bg-[#0d1a24] shadow-[inset_0_0_30px_rgba(49,199,255,0.18)]">
                <div>
                  <div className="text-[28px] font-black uppercase tracking-[0.22em] text-[#31c7ff]">George</div>
                  <div className="mt-3 px-4 text-[18px] font-semibold leading-7 text-white">
                    {connectionState === "connected" ? "Tap to end" : connectionState === "connecting" ? "Connecting…" : "Tap to speak"}
                  </div>
                </div>
              </div>
            </button>
          </div>

          <div className="mx-auto mt-8 max-w-[820px] rounded-[10px] bg-[#e6e6e6] px-5 py-5 text-left sm:px-6">
            <p className="text-[14px] font-bold uppercase tracking-[0.16em] text-[#394553]">
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
            <p className="mt-3 text-[18px] leading-8 text-[#394553]">{latestAssistantMessage}</p>
            {latestUserMessage ? <p className="mt-2 text-[15px] text-[#5f6770]">You: {latestUserMessage}</p> : null}
            {error ? <p className="mt-3 text-sm font-medium text-[#b42318]">{error}</p> : null}

            <div className="mt-5 flex flex-wrap gap-3">
              {connectionState === "connected" ? (
                <button
                  type="button"
                  onClick={stopConversation}
                  className="inline-flex items-center gap-2 rounded-full bg-[#f47c00] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105"
                >
                  <PhoneOff className="h-4 w-4" /> End conversation
                </button>
              ) : hasStoredSession ? (
                <button
                  type="button"
                  onClick={clearSavedSession}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-[#394553] bg-white px-5 py-3 text-sm font-semibold text-[#394553] transition hover:bg-[#394553] hover:text-white"
                >
                  <RotateCcw className="h-4 w-4" /> Start fresh
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setShowConversation((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border-2 border-[#394553] bg-white px-5 py-3 text-sm font-semibold text-[#394553] transition hover:bg-[#394553] hover:text-white"
              >
                {showConversation ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showConversation ? "Hide conversation" : "View conversation"}
              </button>
            </div>
          </div>

          <div className="mt-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {QUICK_LINKS.map((link) => {
                const Icon = link.icon
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    className="flex items-center justify-between gap-3 rounded-full border-2 border-[#394553] bg-white px-5 py-4 text-left text-[16px] font-semibold text-[#394553] transition hover:bg-[#394553] hover:text-white"
                  >
                    <span>{link.label}</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f47c00] text-white">
                      <Icon className="h-4 w-4" />
                    </span>
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {showConversation ? (
        <div className="border-t border-[#d7d7d7] bg-[#f8f8f8] px-5 py-6 sm:px-8 lg:px-10">
          <div ref={scrollRef} className="mx-auto max-h-[420px] w-full max-w-4xl overflow-y-auto">
            <div className="flex flex-col gap-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[92%] whitespace-pre-wrap rounded-[24px] px-5 py-4 text-[15px] leading-7 shadow-sm sm:max-w-[84%] sm:text-[16px] ${
                      message.role === "user"
                        ? "rounded-br-md bg-[#394553] text-white"
                        : message.role === "assistant"
                          ? "rounded-bl-md border border-[#dde3de] bg-white text-[#394553]"
                          : "rounded-bl-md border border-[#dde3de] bg-[#f1f1f1] text-[#5a6672]"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {connectionState === "connecting" && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-3 rounded-[24px] rounded-bl-md border border-[#dde3de] bg-white px-5 py-4 text-[#394553] shadow-sm">
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
