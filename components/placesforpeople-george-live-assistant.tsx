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

const STORAGE_KEY = "placesforpeople-george-session-v3"

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "system",
    content:
      "Hi — I'm George for Steyning Leisure Centre. I can help you find the right membership, check the live timetable, answer centre questions, and walk you through the join process step by step. If you want to join, I’ll tell you which button to click next and what you’ll see on the next page.",
  },
]

const QUICK_LINKS = [
  { label: "Join now", href: "https://www.placesleisure.org/membership/", icon: CalendarDays },
  { label: "View timetable", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/timetable", icon: CalendarDays },
  { label: "Fitness & Health", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/fitness-health/", icon: Dumbbell },
  { label: "Swimming & Lessons", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/swimming-lessons/", icon: Waves },
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
    ? `Introduce yourself as George for Steyning Leisure Centre in warm, natural British English. This visitor has an ongoing conversation with you on this device, so welcome them back briefly and continue naturally instead of restarting. ${visitorName ? `Their name is ${visitorName}. Use it lightly.` : ""} ${lastUserMessage ? `The last thing they said was: ${lastUserMessage}` : ""} Ask one short helpful question about what they want help with next. If they sound like they want to join, quickly move into membership guidance and the exact join steps.`
    : "Introduce yourself as George for Steyning Leisure Centre in warm, natural British English. Keep it short, confident, welcoming, and practical. Make it clear you can help with memberships, the live timetable, swimming, classes, opening times, facilities, and the exact join process. Mention that if they want to join, you can recommend the right option and tell them which button to click next. Ask one short question about what they want help with first."

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
    <section className="overflow-hidden rounded-[28px] border border-[#d7dde3] bg-white shadow-[0_24px_60px_rgba(57,69,83,0.12)]">
      <div className="bg-[linear-gradient(180deg,#ffffff_0%,#f6f8fa_100%)] px-4 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-[980px] text-center">
          <div className="text-[14px] font-bold uppercase tracking-[0.18em] text-[#687381] sm:text-[15px]">Speak to George</div>
          <h2 className="mt-2 text-[34px] font-black tracking-tight text-[#394553] sm:text-[48px] lg:text-[56px]">Tap the button to talk</h2>
          <p className="mx-auto mt-4 max-w-[780px] text-[17px] leading-[1.8] text-[#4f5d6c] sm:text-[20px] lg:text-[22px]">
            George can recommend the right membership, check the live timetable, answer centre questions,
            and guide visitors through joining step by step.
          </p>

          <div className="mt-8 flex justify-center sm:mt-10">
            <button
              type="button"
              onClick={connectionState === "connected" ? stopConversation : startConversation}
              disabled={connectionState === "connecting"}
              className={`group relative flex h-[210px] w-[210px] items-center justify-center rounded-full transition duration-300 sm:h-[236px] sm:w-[236px] lg:h-[260px] lg:w-[260px] ${
                connectionState === "connecting" ? "cursor-wait" : "hover:scale-[1.015]"
              } ${connectionState === "connected" || connectionState === "connecting" ? "animate-[pulse_2.2s_ease-in-out_infinite]" : ""}`}
            >
              <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_28%_24%,rgba(255,255,255,0.95),rgba(255,255,255,0.22)_18%,rgba(244,124,0,0.18)_22%,rgba(65,77,91,0.92)_58%,#394553_100%)] shadow-[0_20px_40px_rgba(57,69,83,0.28),inset_0_10px_24px_rgba(255,255,255,0.28),inset_0_-14px_24px_rgba(0,0,0,0.18)]" />
              <span className="absolute inset-[8px] rounded-full border border-white/35" />
              <span className="absolute inset-[22px] rounded-full border border-white/15" />
              <span className="absolute inset-[26px] rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_34%)]" />
              <div className="relative z-10 flex h-[72%] w-[72%] flex-col items-center justify-center rounded-full border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.03))] px-5 text-center backdrop-blur-[1px]">
                <div className="text-[22px] font-black uppercase tracking-[0.22em] text-white sm:text-[26px]">George</div>
                <div className="mt-3 text-[15px] font-semibold leading-6 text-white/95 sm:text-[17px] sm:leading-7">
                  {connectionState === "connected" ? "Tap to end" : connectionState === "connecting" ? "Connecting…" : "Tap to speak"}
                </div>
                <div className="mt-3 text-[12px] font-medium uppercase tracking-[0.18em] text-white/70 sm:text-[13px]">
                  Live voice assistant
                </div>
              </div>
            </button>
          </div>

          <div className="mx-auto mt-8 max-w-[860px] rounded-[24px] border border-[#e2e7eb] bg-white px-5 py-5 text-left shadow-[0_10px_28px_rgba(57,69,83,0.06)] sm:px-6">
            <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-[#687381] sm:text-[14px]">
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
            <p className="mt-3 text-[16px] leading-7 text-[#394553] sm:text-[18px] sm:leading-8">{latestAssistantMessage}</p>
            {latestUserMessage ? <p className="mt-2 text-[14px] text-[#5f6770] sm:text-[15px]">You: {latestUserMessage}</p> : null}
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

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div className="rounded-[24px] border border-[#e2e7eb] bg-[#f8fafb] p-5 text-left shadow-[0_10px_24px_rgba(57,69,83,0.05)] sm:p-6">
              <div className="text-[13px] font-bold uppercase tracking-[0.18em] text-[#687381] sm:text-[14px]">Join process George should guide</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  "1. Click Join now below",
                  "2. Select Steyning Leisure Centre from the drop-down list",
                  "3. Click Join now on the next page",
                  "4. Choose adult, concession, young adult or PAYG",
                  "5. Pick direct debit, recurring card or pay upfront if available",
                  "6. Continue through the form with the option George recommended",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-[#dfe5ea] bg-white px-4 py-4 text-sm font-semibold leading-6 text-[#394553]">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-[#e2e7eb] bg-[#394553] p-5 text-left text-white shadow-[0_14px_32px_rgba(57,69,83,0.16)] sm:p-6">
              <div className="text-[13px] font-bold uppercase tracking-[0.18em] text-white/70 sm:text-[14px]">Try asking George</div>
              <div className="mt-4 space-y-3">
                {[
                  "I’m 22 and just want to use the gym.",
                  "I only want swimming and I’d rather pay by card.",
                  "I’m a student — do you have concession options?",
                  "What happens after I click Join now?",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-sm leading-6 text-white/95">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {QUICK_LINKS.map((link) => {
                const Icon = link.icon
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left text-[15px] font-semibold transition sm:px-5 sm:text-[16px] ${link.label === "Join now" ? "border-[#f47c00]/30 bg-[#fff6ed] text-[#9e5200] hover:bg-[#fef0df]" : "border-[#dfe5ea] bg-white text-[#394553] hover:border-[#394553] hover:bg-[#394553] hover:text-white"}`}
                  >
                    <span>{link.label}</span>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${link.label === "Join now" ? "bg-[#f47c00] text-white" : "bg-[#f47c00] text-white"}`}>
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
