"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Mic, PhoneOff, Radio, Sparkles, Volume2 } from "lucide-react"

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
      "Hi — I’m George, the friendly digital member of staff for Fishers Farm Park. Ask me about visiting, attractions, animals, food, events, stays, accessibility, or the best next step for tickets and bookings.",
  },
]

const FIRST_RESPONSE_EVENT = {
  type: "response.create",
  response: {
    instructions:
      "Briefly introduce yourself as George for Fishers Farm Park, then ask in a warm, upbeat way what the visitor would like help with today.",
  },
}

const CTA_LINKS = [
  { label: "Buy tickets", href: "https://fishersfarmpark.visihost.co.uk/", highlight: true },
  { label: "Annual Pass", href: "https://www.fishersfarmpark.co.uk/" },
  { label: "Plan your visit", href: "https://www.fishersfarmpark.co.uk/plan-your-visit" },
  { label: "What’s on", href: "https://www.fishersfarmpark.co.uk/events" },
  { label: "Short breaks", href: "https://www.fishersfarmpark.co.uk/holiday-cottages" },
]

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

function buildTranscript(messages: LiveMessage[]) {
  return messages
    .filter((message) => message.role === "assistant" || message.role === "user")
    .map((message) => `${message.role === "assistant" ? "George" : "Visitor"}: ${normalizeWhitespace(message.content)}`)
    .join("\n\n")
}

export function FishersGeorgeLiveAssistant() {
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
  const transcript = useMemo(() => buildTranscript(messages), [messages])

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
    <section className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 text-[#23401a] sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-[34px] border border-[#88c366]/45 bg-[linear-gradient(145deg,rgba(255,255,255,0.98)_0%,rgba(246,255,236,0.98)_52%,rgba(255,248,219,0.98)_100%)] p-7 shadow-[0_30px_70px_rgba(58,104,29,0.16)] sm:p-9">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#8fc95d]/35 bg-[#edf9de] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.3em] text-[#538a28]">
            <Sparkles className="h-4 w-4" /> Live park assistant
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-[#356f27] sm:text-5xl">Meet George at Fishers</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#466233] sm:text-lg">
            George reads approved Fishers Farm Park pages live, answers in English only, and helps visitors find the right information quickly.
            When someone is ready to buy tickets, book a stay, or plan their visit, George points them to the right button below.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {CTA_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className={
                  link.highlight
                    ? "rounded-full bg-[#f3b22a] px-5 py-3 text-sm font-black text-[#324112] shadow-[0_16px_34px_rgba(243,178,42,0.28)] transition hover:-translate-y-0.5"
                    : "rounded-full border border-[#8ac15f]/40 bg-white px-5 py-3 text-sm font-bold text-[#477227] shadow-[0_12px_24px_rgba(59,90,26,0.08)] transition hover:border-[#5ea43a] hover:bg-[#f8fff2]"
                }
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-[#8ac15f]/35 bg-white/90 p-4 shadow-sm">
              <div className="text-xs font-black uppercase tracking-[0.25em] text-[#6a9f3e]">Source of truth</div>
              <p className="mt-2 text-sm leading-6 text-[#4d603f]">Approved Fishers pages only. No made-up answers.</p>
            </div>
            <div className="rounded-[24px] border border-[#8ac15f]/35 bg-white/90 p-4 shadow-sm">
              <div className="text-xs font-black uppercase tracking-[0.25em] text-[#6a9f3e]">Language</div>
              <p className="mt-2 text-sm leading-6 text-[#4d603f]">Friendly English only, with clear family-focused replies.</p>
            </div>
            <div className="rounded-[24px] border border-[#8ac15f]/35 bg-white/90 p-4 shadow-sm">
              <div className="text-xs font-black uppercase tracking-[0.25em] text-[#6a9f3e]">Live updates</div>
              <p className="mt-2 text-sm leading-6 text-[#4d603f]">Fresh page content is pulled when a new voice session starts.</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[34px] border border-[#88c366]/45 bg-[#2f5f21] p-5 text-white shadow-[0_30px_70px_rgba(29,60,15,0.25)] sm:p-6">
          <div className="flex items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-white/8 px-4 py-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-[#dbeeb4]">Voice status</div>
              <div className="mt-1 text-lg font-semibold text-white">{statusText}</div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-[#eff8d0]">
              <Radio className={`h-4 w-4 ${connectionState === "connected" ? "animate-pulse text-[#ffd465]" : "text-[#dbeeb4]"}`} />
              {connectionState === "connected" ? "Live" : connectionState}
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={startConversation}
              disabled={!canStart}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#f3b22a] px-5 py-3 text-sm font-black text-[#324112] transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connectionState === "connecting" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
              {connectionState === "connecting" ? "Connecting…" : "Start voice chat"}
            </button>
            <button
              type="button"
              onClick={stopConversation}
              disabled={connectionState === "idle"}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
            >
              <PhoneOff className="h-5 w-5" /> End
            </button>
          </div>

          <div className="mt-4 rounded-[26px] border border-white/10 bg-[#224518] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#e9f6cb]">
              <Volume2 className={`h-4 w-4 ${isModelSpeaking ? "animate-pulse text-[#ffd465]" : "text-[#dbeeb4]"}`} />
              George speaks out loud by default
            </div>
            <p className="mt-2 text-sm leading-6 text-[#dcebb9]">
              Ask about visiting, events, attractions, animals, food, accessibility, annual passes, or short breaks.
            </p>
          </div>

          <div ref={scrollRef} className="mt-4 max-h-[420px] space-y-3 overflow-y-auto rounded-[26px] border border-white/10 bg-[#1d3b15] p-4">
            {messages
              .filter((message) => message.role !== "system")
              .map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "assistant"
                      ? "max-w-[92%] rounded-[22px] rounded-tl-md bg-[#f4f9ea] px-4 py-3 text-sm leading-6 text-[#315021]"
                      : "ml-auto max-w-[92%] rounded-[22px] rounded-tr-md bg-[#f3b22a] px-4 py-3 text-sm font-medium leading-6 text-[#324112]"
                  }
                >
                  {message.content}
                </div>
              ))}
          </div>

          {error ? <p className="mt-4 text-sm font-medium text-[#ffd7d7]">{error}</p> : null}
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border border-[#88c366]/35 bg-white/90 p-5 shadow-[0_18px_45px_rgba(58,104,29,0.08)]">
        <div className="text-xs font-black uppercase tracking-[0.28em] text-[#6a9f3e]">Live transcript</div>
        <textarea
          readOnly
          value={transcript}
          className="mt-3 min-h-[160px] w-full resize-none rounded-[22px] border border-[#cfe6b8] bg-[#fbfff6] px-4 py-3 text-sm leading-6 text-[#355027] outline-none"
        />
      </div>
    </section>
  )
}
