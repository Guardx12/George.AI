"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, ChevronLeft, Loader2, MapPin, Mic, PhoneOff, Ticket, Trees, Volume2, Compass } from "lucide-react"

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
      "Hi — I’m George for Fishers Farm Park. Ask me about visiting, attractions, food, events, stays, accessibility, or where to book tickets.",
  },
]

const FIRST_RESPONSE_EVENT = {
  type: "response.create",
  response: {
    instructions:
      "Briefly introduce yourself as George for Fishers Farm Park, then warmly ask what the visitor would like help with today.",
  },
}

function makeMessage(role: LiveMessage["role"], content: string): LiveMessage {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${role}-${Date.now()}-${Math.random()}`,
    role,
    content,
  }
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

export function FishersLiveAssistant() {
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
      const tokenResponse = await fetch("/api/fishers-session", { method: "GET", cache: "no-store" })
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
    <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-[30px] border border-[#7ca44d]/30 bg-[linear-gradient(180deg,rgba(255,253,244,0.96)_0%,rgba(248,241,210,0.96)_100%)] shadow-[0_24px_80px_rgba(39,73,30,0.16)]">
          <div className="border-b border-[#7ca44d]/20 bg-[linear-gradient(90deg,#f6c64b_0%,#f4df85_48%,#f8ebba_100%)] px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#2d5a27] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
                <Volume2 className="h-4 w-4" /> Fishers voice guide
              </span>
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#2d5a27]">English only</span>
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#2d5a27]">Reads approved live pages</span>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-[#26461f] sm:text-4xl"> at Fishers Farm Park</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#3d4f2a] sm:text-lg">
              George answers questions about visiting, attractions, food, events, stays, accessibility, and the next step for tickets or booking.
            </p>
          </div>

          <div className="px-6 py-6 sm:px-8">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={startConversation}
                disabled={!canStart}
                className="inline-flex items-center gap-2 rounded-full bg-[#2d5a27] px-5 py-3 text-sm font-bold text-white shadow-[0_16px_32px_rgba(45,90,39,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {connectionState === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                {connectionState === "connected" ? "George is live" : connectionState === "connecting" ? "Connecting…" : "Start talking to George"}
              </button>
              <button
                type="button"
                onClick={stopConversation}
                disabled={connectionState !== "connected" && connectionState !== "connecting"}
                className="inline-flex items-center gap-2 rounded-full border border-[#d8711f]/30 bg-white px-5 py-3 text-sm font-bold text-[#9b4b09] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PhoneOff className="h-4 w-4" /> Stop
              </button>
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#49612f] shadow-sm">
                {connectionState === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                {statusText}
              </div>
            </div>

            {error ? <p className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p> : null}

            <div ref={scrollRef} className="max-h-[420px] space-y-3 overflow-y-auto rounded-[26px] border border-[#d7d8bc] bg-white/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:p-5">
              {messages.map((message) => {
                const isGeorge = message.role !== "user"
                return (
                  <div key={message.id} className={`flex ${isGeorge ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[88%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-sm sm:text-[15px] ${
                        isGeorge ? "bg-[#f8f2c9] text-[#32421f]" : "bg-[#2d5a27] text-white"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                )
              })}
              {isModelSpeaking ? (
                <div className="flex justify-start">
                  <div className="rounded-[22px] bg-[#f8f2c9] px-4 py-3 text-sm text-[#32421f] shadow-sm">George is speaking…</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="overflow-hidden rounded-[30px] border border-[#7ca44d]/25 bg-white shadow-[0_24px_80px_rgba(39,73,30,0.1)]">
            <div className="border-b border-[#e7ddb8] bg-[linear-gradient(90deg,#f6c64b_0%,#f4df85_48%,#f8ebba_100%)] px-6 py-5">
              <h2 className="text-xl font-black text-[#26461f]">Quick visitor buttons</h2>
              <p className="mt-2 text-sm leading-6 text-[#53643d]">
                George should answer first, then guide visitors to the right next step using the buttons below.
              </p>
            </div>
            <div className="p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <a href="https://fishersfarmpark.visihost.co.uk/" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f6c64b] px-4 py-3 text-sm font-extrabold text-[#5b3c00] shadow-[0_14px_28px_rgba(246,198,75,0.28)] transition hover:-translate-y-0.5">
                  <Ticket className="h-4 w-4" /> Buy Tickets
                </a>
                <a href="https://www.fishersfarmpark.co.uk/plan-your-visit" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#d8d0a8] bg-[#fffaf0] px-4 py-3 text-sm font-extrabold text-[#26461f] transition hover:-translate-y-0.5">
                  <Compass className="h-4 w-4" /> Plan Your Visit
                </a>
                <a href="https://www.fishersfarmpark.co.uk/events" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#d8d0a8] bg-[#fffaf0] px-4 py-3 text-sm font-extrabold text-[#26461f] transition hover:-translate-y-0.5">
                  <CalendarDays className="h-4 w-4" /> What&apos;s On
                </a>
                <a href="https://www.fishersfarmpark.co.uk/attractions" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#d8d0a8] bg-[#fffaf0] px-4 py-3 text-sm font-extrabold text-[#26461f] transition hover:-translate-y-0.5">
                  <Trees className="h-4 w-4" /> Things To Do
                </a>
                <a href="https://www.fishersfarmpark.co.uk/holiday-cottages" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2d5a27] px-4 py-3 text-sm font-extrabold text-white shadow-[0_14px_28px_rgba(45,90,39,0.2)] transition hover:-translate-y-0.5 sm:col-span-2">
                  <Trees className="h-4 w-4" /> Stay With Us
                </a>
              </div>
              <a href="https://www.fishersfarmpark.co.uk/" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full px-1 py-1 text-sm font-bold text-[#49612f] transition hover:text-[#26461f]">
                <ChevronLeft className="h-4 w-4" /> Back to Fishers Farm Park
              </a>
            </div>
          </div>

          <div className="rounded-[30px] border border-[#7ca44d]/25 bg-[linear-gradient(180deg,#fffef9_0%,#f7f1d3_100%)] p-6 shadow-[0_24px_80px_rgba(39,73,30,0.1)]">
            <h2 className="text-xl font-black text-[#26461f]">How this version works</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#495b34]">
              <li>• George only answers .</li>
              <li>• George reads approved Fishers pages when a new session starts.</li>
              <li>• George should answer from the latest live site content, not made-up guesses.</li>
              <li>• For buying and booking, George should point visitors to the buttons below.</li>
            </ul>
            <div className="mt-5 rounded-2xl bg-white/80 px-4 py-4 text-sm font-medium text-[#3f512c] shadow-sm">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-[#2d5a27]" />
                <p>Fishers Farm Park, Newpound Lane, Wisborough Green, West Sussex, RH14 0EG</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
