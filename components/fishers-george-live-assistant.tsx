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
  Radio,
  Sparkles,
  Ticket,
  Trees,
  UtensilsCrossed,
  BadgeHelp,
  PawPrint,
  Volume2,
  RotateCcw,
} from "lucide-react"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

const STORAGE_KEY = "fishers-george-session-v1"

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "system",
    content:
      "Hello — I’m George, your guide for Fishers Farm Park. I can help whether you’re planning your visit or already here, from tickets and what to expect to directions, animals, food, interesting facts, and what to do next.",
  },
]

const QUICK_LINKS = [
  { label: "Buy Tickets", href: "https://fishersfarmpark.visihost.co.uk/", icon: Ticket },
  { label: "Annual Pass", href: "https://www.fishersfarmpark.co.uk/annual-pass", icon: Ticket },
  { label: "Plan Your Visit", href: "https://www.fishersfarmpark.co.uk/plan-your-visit", icon: MapPinned },
  { label: "What’s On", href: "https://www.fishersfarmpark.co.uk/events", icon: CalendarDays },
  { label: "Attractions", href: "https://www.fishersfarmpark.co.uk/attractions", icon: Sparkles },
  { label: "Animals", href: "https://www.fishersfarmpark.co.uk/animals", icon: PawPrint },
  { label: "Food & Drink", href: "https://www.fishersfarmpark.co.uk/food", icon: UtensilsCrossed },
  { label: "Holiday Cottages", href: "https://www.fishersfarmpark.co.uk/holiday-cottages", icon: BedDouble },
  { label: "Luxury Pods", href: "https://www.fishersfarmpark.co.uk/holiday-pods", icon: Trees },
  { label: "FAQs", href: "https://www.fishersfarmpark.co.uk/faq", icon: BadgeHelp },
  { label: "Back to Fishers Farm Park", href: "https://www.fishersfarmpark.co.uk/", icon: ArrowLeft },
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
    ? `Introduce yourself as George for Fishers Farm Park in warm, natural British English only. Keep it short, cheerful, and family-friendly. This visitor already has an ongoing conversation with you on this device. Do not restart from scratch and do not ask again whether they are planning their visit or already here unless you truly need to. ${visitorName ? `Their name is ${visitorName}. Use it lightly and warmly.` : ""} ${lastUserMessage ? `The last thing they said before returning was: ${lastUserMessage}` : ""} Briefly welcome them back, pick up naturally, and ask one short forward-moving question such as what they can see now, where they are now, or what they want help with next.`
    : "Introduce yourself as George for Fishers Farm Park in warm, natural British English only. Keep it short, cheerful, and family-friendly. Briefly say you can help whether someone is planning their visit or already at the park. Then ask this exact question naturally: Are you planning your visit, or are you already here at Fishers Farm? Once they reply, ask for their name naturally early in the conversation if they have not already given it. Do not ask lots of questions at once. Never ask whether they are a child or an adult. If they mention family or children, ask about that naturally afterwards. If they are planning, guide them towards the most relevant buttons on the page. If they are already here, guide them around the park, suggest what to do next, offer interesting animal facts when relevant, and mention food or drink naturally where it fits. Use names lightly and warmly, not in every reply."

  return {
    type: "response.create",
    response: { instructions },
  }
}

export function FishersGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [statusText, setStatusText] = useState("Ready when you are")
  const [isModelSpeaking, setIsModelSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasStoredSession, setHasStoredSession] = useState(false)
  const [visitorName, setVisitorName] = useState<string | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const canStart = useMemo(() => connectionState === "idle" || connectionState === "error", [connectionState])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, connectionState])

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
      const tokenResponse = await fetch("/api/fishers-session", {
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
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="rounded-[36px] border border-[#d9c3aa] bg-[#fffaf2] shadow-[0_24px_80px_rgba(78,42,18,0.10)] overflow-hidden">
        <div className="border-b border-[#eadcc8] bg-[#fff4e8] px-5 py-8 sm:px-8 sm:py-10 text-center">
          <img src="/fishers-logo.svg" alt="Fishers Farm Adventure Park" className="mx-auto h-auto w-full max-w-[320px]" />
          <h1 className="mt-6 text-4xl font-black tracking-tight text-[#4e2a12] sm:text-5xl">
            Meet George
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-[#6d3b11] sm:text-lg">
            George helps before you arrive and while you’re here — from tickets and planning your day to finding your
            way around, discovering animals, learning interesting facts, and always knowing what to do next.
          </p>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-6 text-[#7a573b] sm:text-base">
            Ask George about the animals as you go — he’ll share interesting facts and help you get more out of your
            visit.
          </p>
          <div className="mx-auto mt-5 max-w-3xl rounded-[28px] border border-[#efd5b8] bg-white/75 px-5 py-4 text-left shadow-sm sm:px-6">
            <div>
              <p className="text-base font-semibold text-[#4e2a12] sm:text-lg">Planning your visit or already inside the park? George adapts to both.</p>
              <p className="mt-2 text-sm leading-6 text-[#7a573b]">Before you arrive, George can guide you to tickets, opening times, attractions, animals, food, events, and stays. Once you are here, tell George what you can see and he will help guide you around the park, suggest what is nearby, share animal facts, and help you decide what to do next.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="border-b border-[#eadcc8] bg-[#fffdf9] lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-center gap-3 border-b border-[#f0e5d7] bg-[#fff6ed] px-4 py-4 sm:px-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#b11f24] text-lg font-black text-white shadow-[0_10px_30px_rgba(177,31,36,0.25)]">
                G
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-lg font-bold text-[#4e2a12]">George</p>
                <p className="text-sm text-[#7a573b]">Your Fishers Farm Park guide</p>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold sm:text-sm ${
                  connectionState === "connected"
                    ? "border-[#e7b5b7] bg-[#fff0f1] text-[#8f1c20]"
                    : connectionState === "connecting"
                      ? "border-[#efd8bb] bg-[#fff7ef] text-[#8c5a1d]"
                      : connectionState === "error"
                        ? "border-[#efc0c2] bg-[#fff1f2] text-[#ab1e23]"
                        : "border-[#eadcc8] bg-white text-[#6f543e]"
                }`}
              >
                {connectionState === "connected" ? <Volume2 className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
                <span>{isModelSpeaking ? "George is talking" : statusText}</span>
              </span>
            </div>

            <div ref={scrollRef} className="max-h-[560px] overflow-y-auto bg-[#fffdf9] px-4 py-6 sm:px-6 sm:py-8">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[92%] whitespace-pre-wrap rounded-[24px] px-5 py-4 text-[15px] leading-7 shadow-sm sm:max-w-[86%] sm:text-[16px] ${
                        message.role === "user"
                          ? "rounded-br-md bg-[#b11f24] text-white"
                          : message.role === "assistant"
                            ? "rounded-bl-md border border-[#efe2d3] bg-[#fff4e8] text-[#4e2a12]"
                            : "rounded-bl-md border border-[#efe2d3] bg-white text-[#6f543e]"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {connectionState === "connecting" && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-3 rounded-[24px] rounded-bl-md border border-[#efe2d3] bg-[#fff4e8] px-5 py-4 text-[#6d3b11] shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> George is joining the conversation…
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#f0e5d7] bg-[#fff6ed] px-4 py-5 sm:px-6">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-[#6f543e]">
                  {connectionState === "connected"
                    ? "You’re live with George now. He’ll keep the conversation going naturally, remember the flow on this device, and carry on guiding from where you left off."
                    : hasStoredSession
                      ? `Pick up where you left off${visitorName ? `, ${visitorName}` : ""}. George will carry on naturally instead of starting from scratch.`
                      : "Start the live conversation and George will greet you, ask whether you’re planning or already here, then guide you from there."}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={startConversation}
                    disabled={!canStart}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#b11f24] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(177,31,36,0.26)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Mic className="h-4 w-4" />
                    {connectionState === "connected"
                      ? "Live conversation on"
                      : hasStoredSession
                        ? "Continue with George"
                        : "Start live conversation"}
                  </button>
                  {connectionState === "connected" ? (
                    <button
                      type="button"
                      onClick={stopConversation}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#8f1c20] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105"
                    >
                      <PhoneOff className="h-4 w-4" /> End conversation
                    </button>
                  ) : hasStoredSession ? (
                    <button
                      type="button"
                      onClick={clearSavedSession}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d7c2aa] bg-white px-5 py-3 text-sm font-semibold text-[#6f543e] transition hover:bg-[#fffaf4]"
                    >
                      <RotateCcw className="h-4 w-4" /> Start fresh
                    </button>
                  ) : null}
                </div>
              </div>
              {error ? <p className="mx-auto mt-3 w-full max-w-4xl text-sm text-[#ab1e23]">{error}</p> : null}
            </div>
          </div>

          <aside className="bg-[#fff4e8] px-5 py-6 sm:px-6 lg:px-7 lg:py-8">
            <div className="rounded-[28px] border border-[#eadcc8] bg-white/70 p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#b11f24]">Ask George about</p>
              <div className="mt-4 grid gap-3">
                {[
                  "Tickets, booking and planning your visit",
                  "Directions around the park and what to do next",
                  "Animals, attractions and family-friendly facts",
                  "Food, drink, events and short breaks",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-[#efe2d3] bg-[#fffaf4] px-4 py-3 text-sm text-[#5d3719]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <div className="border-t border-[#eadcc8] bg-[#fffaf2] px-5 py-6 sm:px-8 sm:py-8">
          <h2 className="text-2xl font-bold tracking-tight text-[#4e2a12]">Helpful buttons</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon
              return (
                <a
                  key={link.label}
                  href={link.href}
                  className="group flex items-center justify-between gap-3 rounded-[22px] bg-[#b11f24] px-4 py-4 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(177,31,36,0.18)] transition hover:-translate-y-0.5 hover:brightness-105"
                >
                  <span>{link.label}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/14">
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
