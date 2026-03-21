"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Loader2,
  MapPinned,
  PhoneOff,
  Sparkles,
  Ticket,
  Trees,
  UtensilsCrossed,
  BadgeHelp,
  Dumbbell,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

const STORAGE_KEY = "shorefields-george-session-v3"

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "system",
    content:
      "Hello — I’m George, your Shorefield holiday guide. I can help before you arrive and while you're here, from planning your stay to finding your way around the park, discovering facilities, family fun, food, entertainment, nearby walks and what to do next.",
  },
]

const QUICK_LINKS = [
  { label: "Book Shorefield", href: "https://www.shorefield.co.uk/holidays/locations/shorefield-country-park", icon: Ticket },
  { label: "Park Map", href: "https://fls-9ed90804-04fe-49f0-b869-7d2f9e0d49c2.laravel.cloud/files/park-maps/shorefield-country-park-map-2026_dl.pdf", icon: MapPinned },
  { label: "What’s On", href: "https://www.shorefield.co.uk/holidays/entertainment-and-activities/on-park-entertainment/whats-on-shorefield", icon: CalendarDays },
  { label: "Entertainment", href: "https://www.shorefield.co.uk/holidays/entertainment-and-activities/on-park-entertainment/whats-on-shorefield", icon: Sparkles },
  { label: "Health & Fitness", href: "https://www.shorefield.co.uk/health-fitness/shorefield-health-fitness-club", icon: Dumbbell },
  { label: "Plan Your Stay", href: "https://www.shorefield.co.uk/holidays/locations/shorefield-country-park", icon: Ticket },
  { label: "Food & Drink", href: "https://www.shorefield.co.uk/holidays/locations/shorefield-country-park", icon: UtensilsCrossed },
  { label: "Accommodation", href: "https://www.shorefield.co.uk/holidays/locations/shorefield-country-park", icon: BedDouble },
  { label: "Nearby Attractions", href: "https://www.shorefield.co.uk/holidays/locations/shorefield-country-park", icon: Trees },
  { label: "FAQs", href: "https://www.shorefield.co.uk/frequently-asked-questions", icon: BadgeHelp },
  { label: "Park FAQs", href: "https://www.shorefield.co.uk/frequently-asked-questions", icon: BadgeHelp },
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
    ? `Introduce yourself as George, Shorefield's mascot and digital guide, in warm, natural British English only. Keep it short, cheerful, upbeat, and family-friendly. This visitor already has an ongoing conversation with you on this device. Do not restart from scratch and do not ask again whether they are planning their stay or already here unless you truly need to. ${visitorName ? `Their name is ${visitorName}. Use it lightly and warmly.` : ""} ${lastUserMessage ? `The last thing they said before returning was: ${lastUserMessage}` : ""} Briefly welcome them back in a bright holiday-park tone, pick up naturally, and ask one short forward-moving question such as what they can see now, where they are now, or what they want help with next. If it fits naturally, remind them you can help with families, facilities, wayfinding, kids mode and what to do next.`
    : "Introduce yourself as George, Shorefield's mascot and digital guide, in warm, natural British English only. Keep it short, cheerful, upbeat, and family-friendly. Briefly say you can help whether someone is planning their stay or already at the park. If the user has already made that clear in what they just said, do not ask again. Otherwise ask this exact question naturally: Are you planning your stay, or are you already here at Shorefield Country Park? Do not ask lots of questions at once. If they are planning, guide them towards the most relevant buttons on the page. If they are already here, guide them around the park using landmarks, suggest what to do next, mention food or drink naturally where it fits, and offer a kid-friendly mode if children are involved. Use names lightly and warmly, not in every reply. Never pretend you have GPS precision. Use the main complex and facilities as landmarks."

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
    <div className="shorefield-theme min-h-screen bg-[#f7f7f3] text-[#111]">
      <div className="border-b border-black/10 bg-[#e9eaeb] text-[#111]">
        <div className="mx-auto flex max-w-[1400px] items-center gap-8 px-5 py-4 text-[18px]">
          <span className="font-medium border-b-2 border-black pb-4 -mb-4">Holidays</span>
          <span className="text-black/55">Ownership</span>
          <span className="text-black/55">Company</span>
          <div className="ml-auto flex items-center gap-6 text-[17px]">
            <span className="inline-flex items-center gap-2"><Search className="h-5 w-5" /> Search</span>
            <span className="h-7 w-px bg-black/15" />
            <span>Call us on <span className="font-semibold text-[#0b86cf]">01590 648333</span></span>
          </div>
        </div>
      </div>

      <div className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center gap-10 px-5 py-8">
          <img src="/shorefield-holidays-logo_v3.svg" alt="Shorefield Holidays" className="h-16 w-auto" />
          <nav className="hidden flex-1 items-center justify-center gap-14 text-[19px] lg:flex">
            <span>Our Holidays</span>
            <span>Our Parks</span>
            <span>Special Offers</span>
            <span>Inspire Me</span>
            <span>Entertainment & Activities</span>
          </nav>
          <button className="rounded-full bg-[#f2f2f2] px-8 py-4 text-[18px] font-medium">Sign In</button>
        </div>
      </div>

      <section className="relative overflow-hidden border-b border-black/10">
        <div
          className="h-[560px] w-full bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.12), rgba(0,0,0,0.18)), url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1800&q=80')",
            backgroundColor: "#d7dfc7",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-white">
          <div className="animate-shorefield-fade-up max-w-5xl">
            <div className="shorefield-serif text-[44px] leading-none sm:text-[66px] lg:text-[88px]">Shorefield <span className="shorefield-script font-normal">George</span></div>
            <p className="shorefield-serif mt-4 text-[24px] sm:text-[34px]">Your Shorefield Country Park guide</p>
            <p className="mx-auto mt-5 max-w-3xl text-[18px] leading-8 text-white/92 sm:text-[20px]">
              Tap George to get help with your stay, find your way around the park, discover family fun, food, entertainment and the best next thing to do.
            </p>
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={connectionState === "connected" ? stopConversation : startConversation}
                disabled={connectionState === "connecting"}
                className="shorefield-george-cta group inline-flex items-center gap-4 rounded-full bg-[#f5bf22] px-7 py-5 text-left text-black shadow-[0_22px_60px_rgba(245,191,34,0.38)] transition disabled:opacity-70"
                aria-label={connectionState === "connected" ? "Talk to George now" : "Talk to George now"}
              >
                <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white/35 p-1 backdrop-blur-sm">
                  <img src="/holiday-george-sun.svg" alt="Holiday George" className="h-14 w-14 rounded-full object-contain" />
                </span>
                <span>
                  <span className="block text-[12px] font-bold uppercase tracking-[0.24em] text-black/60">Holiday George</span>
                  <span className="shorefield-serif block text-[34px] leading-none">{connectionState === "connected" ? "Talk to George" : connectionState === "connecting" ? "Connecting George" : "Talk to George"}</span>
                  <span className="mt-1 block text-[15px] text-black/75">Get instant help with directions, facilities, family fun and what to do next.</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-12 max-w-[1400px] px-4 sm:px-6">
        <div className="rounded-[34px] bg-[#efefef] p-5 shadow-[0_12px_36px_rgba(0,0,0,0.08)] sm:p-6">
          <div className="mb-5 flex gap-8 px-2 text-[18px] text-black/55">
            <span className="border-b-2 border-black pb-3 text-black">Holiday Accommodation</span>
            <span className="pb-3">Touring & Camping Pitches</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr_1fr_1fr]">
            {[
              ["Location", "Shorefield Country Park"],
              ["George knows", "Facilities, food and family fun"],
              ["Mode", "Planning or already here"],
              ["Best at", "Navigation and what to do next"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[24px] border border-black/10 bg-white px-6 py-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
                <div className="text-[15px] text-black/65">{label}</div>
                <div className="shorefield-serif mt-2 text-[22px] text-[#6b6b6b]">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[34px] bg-white px-8 py-10 shadow-[0_18px_50px_rgba(0,0,0,0.06)] sm:px-10">
            <div className="shorefield-display text-[48px] leading-[0.95] text-black sm:text-[72px]">Award Winning <span className="shorefield-script font-normal">Coastal Escapes</span></div>
            <p className="mt-8 max-w-3xl text-[18px] leading-9 text-[#5d5d5d] sm:text-[20px]">
              George helps guests make the most of their stay, whether you are planning ahead or already on park. He can help you find your way around, discover facilities, choose somewhere to eat, find family-friendly things to do and work out what to do next.
            </p>
            <p className="mt-6 max-w-3xl text-[18px] leading-9 text-[#5d5d5d] sm:text-[20px]">
              He uses the Shorefield website and park layout to guide you with landmarks like the main complex, Beachcomber facilities, entertainment areas and accommodation zones, and he can switch into a more playful family-friendly style when children are involved.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {[
                "Where's the pool?",
                "What should we do today?",
                "We've got kids — where should we start?",
                "What's on tonight?",
              ].map((item) => (
                <span key={item} className="rounded-full border border-black/10 bg-[#f7f7f3] px-5 py-3 text-[15px] text-black/75 transition duration-300 hover:border-[#f5bf22] hover:bg-[#fff8da]">{item}</span>
              ))}
            </div>
          </div>

          <div className="rounded-[34px] bg-[#eaf3f6] p-8 shadow-[0_18px_50px_rgba(0,0,0,0.05)] sm:p-10">
            <div className="text-center">
              <div className="shorefield-display text-[46px] leading-[0.95] text-black sm:text-[66px]">Discover our <span className="shorefield-script font-normal">facilities</span></div>
              <p className="mx-auto mt-5 max-w-xl text-[18px] leading-8 text-[#3b3b3b]">George naturally points guests towards the right places across the park and helps make your stay smoother from the moment you arrive.</p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {QUICK_LINKS.slice(0, 8).map((link) => {
                const Icon = link.icon
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    className="group flex items-center justify-between rounded-[22px] bg-white px-5 py-4 text-[16px] text-black shadow-[0_10px_22px_rgba(0,0,0,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_30px_rgba(0,0,0,0.08)]"
                  >
                    <span className="font-medium">{link.label}</span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5bf22]/25 text-[#202020] transition group-hover:bg-[#f5bf22] group-hover:text-black"><Icon className="h-4 w-4" /></span>
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-6">
        <div className="overflow-hidden rounded-[36px] border border-black/8 bg-white shadow-[0_24px_80px_rgba(23,52,77,0.08)]">
          <div className="bg-[linear-gradient(180deg,#fffef8,white)] px-6 py-8 text-center sm:px-10 sm:py-10">
            <div className="mx-auto inline-flex rounded-full border border-[#e8dfaf] bg-[#fff8da] px-6 py-3 text-sm font-semibold uppercase tracking-[0.22em] text-[#86711a] animate-shorefield-fade-up">{statusText}</div>
            <div className="mx-auto mt-6 flex justify-center">
              <button
                type="button"
                onClick={connectionState === "connected" ? stopConversation : startConversation}
                disabled={connectionState === "connecting"}
                className="shorefield-george-mini group inline-flex items-center gap-3 rounded-full bg-[#f5bf22] px-6 py-4 text-left text-black shadow-[0_14px_36px_rgba(245,191,34,0.28)] transition disabled:opacity-70"
              >
                <img src="/holiday-george-sun.svg" alt="Holiday George" className="h-11 w-11 rounded-full object-contain" />
                <span>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-black/55">Holiday George</span>
                  <span className="shorefield-serif block text-[28px] leading-none">{connectionState === "connected" ? "George is listening" : connectionState === "connecting" ? "Joining now" : "Tap to start"}</span>
                </span>
              </button>
            </div>
            <p className="mx-auto mt-6 max-w-4xl text-[18px] leading-8 text-[#4b4b4b] sm:text-[20px]">{latestAssistantMessage}</p>
            {latestUserMessage ? <p className="mt-3 text-[15px] text-black/50">You: {latestUserMessage}</p> : null}
            {error ? <p className="mt-4 text-[15px] font-medium text-[#9a4a3d]">{error}</p> : null}

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              {connectionState === "connected" ? (
                <button type="button" onClick={stopConversation} className="rounded-full bg-[#143d59] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0f3148]">
                  <span className="inline-flex items-center gap-2"><PhoneOff className="h-4 w-4" /> End Conversation</span>
                </button>
              ) : hasStoredSession ? (
                <button type="button" onClick={clearSavedSession} className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-black/75 transition hover:bg-[#f7f7f3]">
                  <span className="inline-flex items-center gap-2"><RotateCcw className="h-4 w-4" /> Start Fresh</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setShowConversation((prev) => !prev)}
                className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-black/75 transition hover:bg-[#f7f7f3]"
              >
                <span className="inline-flex items-center gap-2">{showConversation ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{showConversation ? "Hide Conversation" : "View Conversation"}</span>
              </button>
            </div>
          </div>

          {showConversation ? (
            <div className="border-t border-black/8 bg-[#fbfbf8] px-4 py-6 sm:px-8 sm:py-8 animate-shorefield-fade-up">
              <div ref={scrollRef} className="mx-auto max-h-[420px] w-full max-w-4xl overflow-y-auto">
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
        </div>
      </section>
    </div>
  )
}
