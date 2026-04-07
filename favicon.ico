"use client"

import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  CalendarDays,
  ChevronLeft,
  CircleHelp,
  Loader2,
  MapPin,
  Mic,
  Phone,
  PhoneOff,
  Sparkles,
  Ticket,
  Trees,
  UtensilsCrossed,
  Volume2,
} from "lucide-react"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "system",
    content:
      "Hi — I’m George for Tulleys Farm. Ask me about events, tickets, the tea room, escape rooms, FAQs, or planning your visit.",
  },
]

const FIRST_RESPONSE_EVENT = {
  type: "response.create",
  response: {
    instructions:
      "Briefly introduce yourself as George for Tulleys Farm, then warmly ask what the visitor would like help with today.",
  },
}

const QUICK_LINKS = [
  {
    label: "Tulip Fest",
    href: "https://www.tulipfarm.co.uk/",
    icon: Trees,
    tone: "gold" as const,
  },
  {
    label: "Shocktober Fest",
    href: "https://www.shocktoberfest.co.uk/",
    icon: Sparkles,
    tone: "dark" as const,
  },
  {
    label: "Pumpkin Festival",
    href: "https://www.pumpkinfarm.co.uk/",
    icon: Ticket,
    tone: "gold" as const,
  },
  {
    label: "Pumpkin Nights",
    href: "https://www.pumpkinnights.co.uk/",
    icon: CalendarDays,
    tone: "gold" as const,
  },
  {
    label: "Christmas Experience",
    href: "https://www.tulleyschristmas.co.uk/",
    icon: Sparkles,
    tone: "dark" as const,
  },
  {
    label: "Light Festival",
    href: "https://www.christmaslightshow.co.uk/",
    icon: CalendarDays,
    tone: "dark" as const,
  },
  {
    label: "Escape Rooms",
    href: "https://tulleysescape.com/",
    icon: Ticket,
    tone: "cream" as const,
  },
  {
    label: "Tea Room",
    href: "https://www.tulleysfarm.com/tea-room",
    icon: UtensilsCrossed,
    tone: "cream" as const,
  },
  {
    label: "FAQs",
    href: "https://www.tulleysfarm.com/faqs",
    icon: CircleHelp,
    tone: "cream" as const,
  },
  {
    label: "Contact & Find Us",
    href: "https://www.tulleysfarm.com/contact-us",
    icon: Phone,
    tone: "cream" as const,
  },
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

export function TulleysLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [statusText, setStatusText] = useState("Ready when you are")
  const [isModelSpeaking, setIsModelSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages])

  const canStart = useMemo(() => connectionState === "idle" || connectionState === "error", [connectionState])

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
    setMessages(INITIAL_MESSAGES)

    try {
      const tokenResponse = await fetch("/api/tulleys-session", { method: "GET", cache: "no-store" })
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
        window.setTimeout(() => dc.send(JSON.stringify(FIRST_RESPONSE_EVENT)), 150)
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
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      })

      const answerText = await response.text()
      if (!response.ok) {
        let message = "Could not connect George."
        try {
          const parsed = JSON.parse(answerText)
          if (typeof parsed?.error?.message === "string") message = parsed.error.message
        } catch {
          if (answerText.includes("<html") || answerText.includes("<!DOCTYPE html")) {
            message = "The live voice service timed out while connecting. Please try again."
          } else if (answerText.trim()) {
            message = answerText.trim()
          }
        }
        throw new Error(message)
      }

      await pc.setRemoteDescription({ type: "answer", sdp: answerText })
    } catch (err) {
      await cleanupConversation()
      setConnectionState("error")
      setStatusText("Could not connect George")
      setError(err instanceof Error ? err.message : "Could not connect George")
    }
  }

  async function stopConversation() {
    await cleanupConversation()
    setError(null)
    setConnectionState("idle")
    setStatusText("Ready when you are")
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pb-20">
      <div className="grid gap-6 lg:grid-cols-[1.16fr_0.84fr]">
        <div className="overflow-hidden rounded-[34px] border border-[#dfb362]/30 bg-[linear-gradient(180deg,rgba(28,16,11,0.96)_0%,rgba(69,33,16,0.94)_58%,rgba(143,73,29,0.93)_100%)] shadow-[0_24px_90px_rgba(20,10,6,0.35)]">
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,214,102,0.34),rgba(255,255,255,0)_45%),linear-gradient(90deg,rgba(255,179,71,0.15)_0%,rgba(255,255,255,0.02)_100%)] px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#f8d27a]/30 bg-[#f8d27a]/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#ffe9b0]">
                <Volume2 className="h-4 w-4" /> Tulleys live voice
              </span>
              <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-semibold text-[#ffe9b0]">English only</span>
              <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-semibold text-[#ffe9b0]">Reads live website pages</span>
            </div>

            <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-4">
                  <div className="rounded-[22px] border border-white/10 bg-white/95 px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
                    <Image src="/tulleys-logo.svg" alt="Tulleys Farm" width={170} height={70} className="h-12 w-auto sm:h-14" priority />
                  </div>
                </div>
                <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">Meet George at Tulleys Farm</h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-[#f5e7d1] sm:text-lg">
                  George answers live visitor questions using the latest Tulleys website content, then points people to the right event, booking page, FAQ, or contact route.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={startConversation}
                disabled={!canStart}
                className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#f3c869_0%,#ffdf8d_100%)] px-5 py-3 text-sm font-black text-[#4d250d] shadow-[0_18px_34px_rgba(255,198,92,0.3)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {connectionState === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                {connectionState === "connected" ? "George is live" : connectionState === "connecting" ? "Connecting…" : "Start talking to George"}
              </button>
              <button
                type="button"
                onClick={stopConversation}
                disabled={connectionState !== "connected" && connectionState !== "connecting"}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PhoneOff className="h-4 w-4" /> Stop
              </button>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-[#ffe9b0] shadow-sm backdrop-blur">
                {connectionState === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                {statusText}
              </div>
            </div>

            {error ? <p className="mb-5 rounded-2xl border border-red-300/40 bg-red-500/12 px-4 py-3 text-sm font-medium text-red-100">{error}</p> : null}

            <div ref={scrollRef} className="max-h-[430px] space-y-3 overflow-y-auto rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,249,238,0.96)_0%,rgba(255,243,222,0.94)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:p-5">
              {messages.map((message) => {
                const isGeorge = message.role !== "user"
                return (
                  <div key={message.id} className={`flex ${isGeorge ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[88%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-sm sm:text-[15px] ${
                        isGeorge ? "bg-[#fff1d8] text-[#4b2b12]" : "bg-[#7a3d1d] text-white"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                )
              })}
              {isModelSpeaking ? (
                <div className="flex justify-start">
                  <div className="rounded-[22px] bg-[#fff1d8] px-4 py-3 text-sm text-[#4b2b12] shadow-sm">George is speaking…</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="overflow-hidden rounded-[32px] border border-[#dfb362]/25 bg-[linear-gradient(180deg,#fff7ea_0%,#fff2de_100%)] shadow-[0_24px_80px_rgba(48,24,12,0.14)]">
            <div className="border-b border-[#edd4a8] bg-[linear-gradient(90deg,#f6c15d_0%,#ffe1a0_52%,#fff0cb_100%)] px-6 py-5">
              <h2 className="text-xl font-black text-[#4b2b12]">Quick visitor buttons</h2>
              <p className="mt-2 text-sm leading-6 text-[#74411e]">George should answer first, then guide visitors to the right Tulleys page or event using the buttons below.</p>
            </div>
            <div className="p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {QUICK_LINKS.map((link) => {
                  const Icon = link.icon
                  const className =
                    link.tone === "gold"
                      ? "bg-[linear-gradient(135deg,#f3c869_0%,#ffdf8d_100%)] text-[#5b310f] shadow-[0_14px_28px_rgba(243,200,105,0.28)]"
                      : link.tone === "dark"
                        ? "bg-[linear-gradient(135deg,#4a2410_0%,#7b3d1b_100%)] text-white shadow-[0_14px_28px_rgba(74,36,16,0.22)]"
                        : "border border-[#e7cfac] bg-[#fffaf1] text-[#4b2b12]"

                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition hover:-translate-y-0.5 ${className}`}
                    >
                      <Icon className="h-4 w-4" /> {link.label}
                    </a>
                  )
                })}
              </div>
              <a href="https://www.tulleysfarm.com/" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full px-1 py-1 text-sm font-bold text-[#74411e] transition hover:text-[#4b2b12]">
                <ChevronLeft className="h-4 w-4" /> Back to Tulleys Farm
              </a>
            </div>
          </div>

          <div className="rounded-[32px] border border-[#dfb362]/25 bg-[linear-gradient(180deg,#fffdfa_0%,#fff0d8_100%)] p-6 shadow-[0_24px_80px_rgba(48,24,12,0.14)]">
            <h2 className="text-xl font-black text-[#4b2b12]">How this version works</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#74411e]">
              <li>• George only answers in English.</li>
              <li>• George reads approved Tulleys pages and linked event sites when a new session starts.</li>
              <li>• George should answer from the latest live site content, not made-up guesses.</li>
              <li>• For bookings, tickets, event details, or planning, George should direct visitors to the matching button below.</li>
            </ul>
            <div className="mt-5 rounded-2xl border border-[#edd4a8] bg-white/80 px-4 py-4 text-sm font-medium text-[#5d3416] shadow-sm">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-[#7a3d1d]" />
                <p>Tulleys Farm, Turners Hill, Crawley, West Sussex, RH10 4PE</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
