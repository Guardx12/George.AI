"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  BedDouble,
  CalendarDays,
  Loader2,
  MapPinned,
  Ticket,
  RotateCcw,
  Search,
} from "lucide-react"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

const STORAGE_KEY = "shorefields-george-session-v5"

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "system",
    content:
      "Hello — I'm George, your Shorefield mascot and holiday guide. I can help whether you're planning your stay, already on park, looking for food or facilities, figuring out what to do next, or keeping the kids entertained safely.",
  },
]

const QUICK_LINKS = [
  { label: "Book Shorefield", href: "https://www.shorefield.co.uk/holidays/locations/shorefield-country-park", icon: Ticket },
  { label: "Park Map", href: "https://fls-9ed90804-04fe-49f0-b869-7d2f9e0d49c2.laravel.cloud/files/park-maps/shorefield-country-park-map-2026_dl.pdf", icon: MapPinned },
  { label: "What’s On", href: "https://www.shorefield.co.uk/holidays/entertainment-and-activities/whats-on-shorefield", icon: CalendarDays },
  { label: "Accommodation", href: "https://www.shorefield.co.uk/holidays/locations/shorefield-country-park", icon: BedDouble },
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
    ? `Introduce yourself as George, Shorefield's mascot and digital guide, in warm, natural British English only. Keep it short, cheerful, upbeat, family-friendly, and grounded in the Shorefield site. This visitor already has an ongoing conversation with you on this device. Do not restart from scratch and do not repeat your full intro. Do not ask again whether they are planning or already here unless you genuinely need to clarify it. ${visitorName ? `Their name is ${visitorName}. Use it lightly and warmly.` : ""} ${lastUserMessage ? `The last thing they said before returning was: ${lastUserMessage}` : ""} Briefly welcome them back, pick up naturally from where they left off, and ask one short forward-moving question based on context. If they seem to be on park, keep it practical and quick. If they seem to be planning, keep it helpful and guiding. If children are involved, you can mention that you can keep things fun or play a quick safe game, but only if it fits naturally.`
    : "Introduce yourself as George, Shorefield's mascot and digital guide, in warm, natural British English only. Keep it short, cheerful, upbeat, and family-friendly. Briefly explain that you can help whether someone is planning their stay, already on park, looking for food or facilities, wanting to know what to do next, or trying to keep the kids entertained. If the user has already made their situation clear, do not ask again. Otherwise ask this exact question naturally: Are you planning your stay, already here at Shorefield, or settling in for your visit? Ask only one useful question. If they are planning or pre-arrival, guide them towards the most relevant buttons on the page. If they are already here, keep the tone quicker and more practical, use landmarks rather than pretending you have live GPS, and help with things like where to go next, food, family activities, comfort breaks, and safe kid-friendly ideas. If children are involved, you may naturally mention that you can play a quick safe game or keep things more fun for them. Never make anything up. Use names lightly and warmly, not in every reply."

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
    setShowConversation(true)
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
    <div className="shorefield-theme min-h-screen bg-[#f7f7f3] text-[#111]">
      <div className="border-b border-black/10 bg-[#e9eaeb] text-[#111]">
        <div className="mx-auto flex max-w-[1400px] items-center gap-8 px-5 py-4 text-[18px]">
          <a href="https://www.shorefield.co.uk/holidays" className="font-medium border-b-2 border-black pb-4 -mb-4">Holidays</a>
          <a href="https://www.shorefield.co.uk/ownership" className="text-black/55 hover:text-black transition">Ownership</a>
          <a href="https://www.shorefield.co.uk/company" className="text-black/55 hover:text-black transition">Company</a>
          <div className="ml-auto flex items-center gap-6 text-[17px]">
            <a href="https://www.shorefield.co.uk/search" className="inline-flex items-center gap-2 hover:text-black/70 transition"><Search className="h-5 w-5" /> Search</a>
            <span className="h-7 w-px bg-black/15" />
            <a href="tel:01590648333">Call us on <span className="font-semibold text-[#0b86cf]">01590 648333</span></a>
          </div>
        </div>
      </div>

      <div className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center gap-10 px-5 py-8">
          <a href="https://www.shorefield.co.uk/holidays/locations/shorefield-country-park">
            <img src="/shorefield-holidays-logo_v3.svg" alt="Shorefield Holidays" className="h-16 w-auto" />
          </a>
          <nav className="hidden flex-1 items-center justify-center gap-14 text-[19px] lg:flex">
            <a href="https://www.shorefield.co.uk/holidays" className="hover:text-black/65 transition">Our Holidays</a>
            <a href="https://www.shorefield.co.uk/holidays/locations" className="hover:text-black/65 transition">Our Parks</a>
            <a href="https://www.shorefield.co.uk/holidays/special-offers" className="hover:text-black/65 transition">Special Offers</a>
            <a href="https://www.shorefield.co.uk/holidays/inspire-me" className="hover:text-black/65 transition">Inspire Me</a>
            <a href="https://www.shorefield.co.uk/holidays/entertainment-and-activities" className="hover:text-black/65 transition">Entertainment & Activities</a>
          </nav>
          <a href="https://www.shorefield.co.uk/login" className="rounded-full bg-[#f2f2f2] px-8 py-4 text-[18px] font-medium transition hover:bg-[#e9e9e9]">Sign In</a>
        </div>
      </div>

      <section className="relative min-h-[720px] overflow-hidden border-b border-black/10 bg-black">
        <img src="/shorefield-hero-top.png" alt="Shorefield Country Park" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/35" />
        <div className="relative z-10 mx-auto flex min-h-[720px] max-w-[1400px] flex-col items-center justify-center px-6 py-16 text-center text-white">
          <div className="animate-shorefield-fade-up max-w-6xl">
            <h1 className="shorefield-serif text-[48px] leading-[0.95] sm:text-[80px] lg:text-[108px]">
              Shorefield <span className="shorefield-script font-normal">Country Park</span>
            </h1>
            <p className="shorefield-serif mt-6 text-[28px] sm:text-[42px]">Your New Forest Holiday Park</p>

            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={connectionState === "connected" ? stopConversation : startConversation}
                disabled={connectionState === "connecting"}
                className="shorefield-george-cta group inline-flex max-w-[760px] items-center gap-4 rounded-full bg-[#f5bf22] px-7 py-5 text-left text-black shadow-[0_22px_60px_rgba(245,191,34,0.38)] transition disabled:opacity-70"
                aria-label="Talk to George"
              >
                <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white/35 p-1 backdrop-blur-sm">
                  <img src="/holiday-george-sun.svg" alt="Holiday George" className="h-14 w-14 rounded-full object-contain" />
                </span>
                <span>
                  <span className="block text-[12px] font-bold uppercase tracking-[0.24em] text-black/60">Holiday George</span>
                  <span className="shorefield-serif block text-[34px] leading-none">{connectionState === "connecting" ? "Connecting George" : "Talk to George"}</span>
                  <span className="mt-1 block text-[15px] text-black/75">Ask about your stay, finding your way, food and drink, family fun, comfort stops, or what to do next.</span>
                </span>
              </button>
            </div>

            <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-black/20 px-5 py-3 text-[15px] backdrop-blur-md">
              {connectionState === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className={`h-2.5 w-2.5 rounded-full ${connectionState === "connected" ? "bg-[#8ef06b]" : "bg-white/80"}`} />}
              <span>{error ? "George is having trouble connecting" : statusText}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 mx-auto -mt-10 max-w-[980px] px-4 pb-10 sm:px-6 lg:px-8">
        <div className="rounded-[34px] border border-black/8 bg-white/95 p-6 shadow-[0_25px_80px_rgba(16,24,40,0.08)] sm:p-8">
          <div className="flex flex-wrap justify-center gap-3 text-left">
            {QUICK_LINKS.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="shorefield-george-mini inline-flex items-center gap-2 rounded-full bg-[#eef3f5] px-4 py-3 text-[15px] font-medium text-[#1b1b1b] shadow-[0_14px_35px_rgba(0,0,0,0.08)] transition hover:bg-white"
              >
                <Icon className="h-4 w-4" />
                {label}
              </a>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {[
              "We're already here — what should we do next?",
              "Where's the pool or main complex?",
              "We've got kids — where should we start?",
              "Can we play a quick game?",
            ].map((item) => (
              <div key={item} className="rounded-full border border-black/8 bg-[#f7f7f3] px-4 py-2.5 text-[14px] text-black/70 shadow-sm">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-center">
            <button
              type="button"
              onClick={() => setShowConversation((value) => !value)}
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-[14px] font-medium text-black/70 transition hover:bg-[#f7f7f3]"
            >
              {showConversation ? "Hide conversation" : hasStoredSession ? "View conversation" : "Show conversation"}
            </button>
            {(hasStoredSession || messages.length > 1) ? (
              <button
                type="button"
                onClick={clearSavedSession}
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#f7f7f3] px-5 py-3 text-[14px] font-medium text-black/65 transition hover:bg-[#efefe8]"
              >
                <RotateCcw className="h-4 w-4" /> Start fresh
              </button>
            ) : null}
            <div className="inline-flex items-center gap-3 rounded-full bg-[#f7f7f3] px-4 py-3 text-[14px] text-black/65">
              {connectionState === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className={`h-2.5 w-2.5 rounded-full ${connectionState === "connected" ? "bg-[#8ef06b]" : "bg-[#d3b147]"}`} />}
              <span>{error ? "George is having trouble connecting" : statusText}</span>
            </div>
          </div>

          {showConversation ? (
            <div className="mt-6 animate-shorefield-fade-up rounded-[28px] border border-black/8 bg-[#fbfbf8] p-4 sm:p-6">
              <div ref={scrollRef} className="max-h-[420px] overflow-y-auto pr-2">
                <div className="flex flex-col gap-4">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[92%] whitespace-pre-wrap rounded-[24px] px-5 py-4 text-[15px] leading-7 shadow-sm transition sm:max-w-[86%] sm:text-[16px] ${
                          message.role === "user"
                            ? "rounded-br-md bg-[#143d59] text-white"
                            : message.role === "assistant"
                              ? "rounded-bl-md border border-[#ece6cf] bg-[#fffbea] text-[#2c2c2c]"
                              : "rounded-bl-md border border-black/8 bg-white text-black/70"
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}

                  {connectionState === "connecting" && (
                    <div className="flex justify-start">
                      <div className="inline-flex items-center gap-3 rounded-[24px] rounded-bl-md border border-[#ece6cf] bg-[#fffbea] px-5 py-4 text-[#7a6922] shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin" /> George is joining the conversation…
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-4 text-center text-[14px] text-[#b42318]">{error}</p> : null}
        </div>
      </section>
    </div>
  )
}
