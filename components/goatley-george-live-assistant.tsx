"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Mic, PhoneOff, Radio, Volume2 } from "lucide-react"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

type LeadFormState = {
  customerType: string
  title: string
  firstName: string
  lastName: string
  email: string
  phone: string
  street: string
  town: string
  county: string
  postcode: string
  additionalInformation: string
  interestedIn: string
  message: string
}

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "system",
    content:
      "Hi — I’m George, the trained digital member of staff for R & D Goatley. Ask me about windows, doors, conservatories, prices, product options, or booking the next step.",
  },
]

const FIRST_RESPONSE_EVENT = {
  type: "response.create",
  response: {
    instructions:
      "Briefly introduce yourself as George for R & D Goatley, then ask in a warm natural way how you can help with their windows, doors, conservatory, glazing, or installation enquiry today.",
  },
}

const TITLE_OPTIONS = ["None", "Mr", "Mrs", "Mr.", "Mrs.", "Miss", "MS", "MX", "Doctor", "Mr and Mr", "Miss and Miss"]
const INTEREST_OPTIONS = [
  "Windows and Doors",
  "PVC Windows",
  "Aluminium Windows",
  "Vertical Sliding Windows",
  "Composite Doors",
  "Resi Doors",
  "Patio Doors",
  "Aluminium Patio Doors",
  "Aluminium Bifolds",
  "Fascia and Soffits",
  "Conservatory",
  "Glass Units",
  "Service Call",
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

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function buildTranscript(messages: LiveMessage[]) {
  return messages
    .filter((message) => message.role === "assistant" || message.role === "user")
    .map((message) => `${message.role === "assistant" ? "George" : "Visitor"}: ${normalizeWhitespace(message.content)}`)
    .join("\n\n")
}

function extractLeadDetailsFromTranscript(transcript: string) {
  const emailMatch = transcript.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const phoneMatch = transcript.match(/(?:\+?44\s?7\d{3}|0\d{4}|0\d{3}|0\d{2})[\s\d]{6,12}/)

  let firstName = ""
  let lastName = ""
  const namePatterns = [
    /my name is\s+([A-Za-z][A-Za-z' -]{1,40})/i,
    /i am\s+([A-Za-z][A-Za-z' -]{1,40})/i,
    /i'm\s+([A-Za-z][A-Za-z' -]{1,40})/i,
  ]

  for (const pattern of namePatterns) {
    const match = transcript.match(pattern)
    if (match?.[1]) {
      const parts = normalizeWhitespace(match[1]).split(" ")
      firstName = parts[0] || ""
      lastName = parts.slice(1).join(" ")
      break
    }
  }

  return {
    firstName,
    lastName,
    email: emailMatch ? normalizeWhitespace(emailMatch[0]) : "",
    phone: phoneMatch ? normalizeWhitespace(phoneMatch[0]) : "",
  }
}

export function GoatleyGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [statusText, setStatusText] = useState("Ready when you are")
  const [isModelSpeaking, setIsModelSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leadForm, setLeadForm] = useState<LeadFormState>({
    customerType: "Personal",
    title: "None",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    street: "",
    town: "",
    county: "",
    postcode: "",
    additionalInformation: "",
    interestedIn: "",
    message: "",
  })

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const conversationSessionIdRef = useRef("")

  useEffect(() => {
    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `george-${Date.now()}-${Math.random()}`
    conversationSessionIdRef.current = sessionId
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })

    const transcript = buildTranscript(messages)
    const details = extractLeadDetailsFromTranscript(transcript)

    setLeadForm((prev) => ({
      ...prev,
      firstName: details.firstName || prev.firstName,
      lastName: details.lastName || prev.lastName,
      email: details.email || prev.email,
      phone: details.phone || prev.phone,
      message: prev.message || (transcript ? "George conversation enquiry from R & D Goatley page." : ""),
    }))
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
      const tokenResponse = await fetch("/api/george-session", { method: "GET", cache: "no-store" })
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
    <section className="mx-auto w-full max-w-7xl px-4 pb-14 pt-8 text-[#f3efe3] sm:px-6 lg:px-8">
      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[30px] border border-[#5c5230] bg-[linear-gradient(135deg,#121212_0%,#1f1b14_55%,#2f2615_100%)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[#d6bb68]">Meet George</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-[#f5e5ad] sm:text-5xl">
              Your trained digital member of staff for R &amp; D Goatley.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[#f1ead6] sm:text-lg">
              George can speak with visitors out loud, answer common questions, explain products, guide people through the next step, and help turn more enquiries into booked appointments for windows, doors, conservatories, glazing, and service calls.
            </p>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.25em] text-[#d6bb68] sm:text-base">
              Windows • Doors • Conservatories • Quotes • Service Calls
            </p>
          </div>

          <div className="rounded-[30px] border border-[#524826] bg-[#1a1a1a] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            <h2 className="text-2xl font-semibold text-[#f2d675]">Contact R &amp; D Goatley</h2>
            <p className="mt-4 text-base leading-8 text-[#efe8d3]">
              Please feel free to contact us to discuss anything either via our phone, e mail or the contact form below, we are happy to help. Please note, we cannot offer estimates via e mail, please call us and we can book you in for a visit.
            </p>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-[#3f3a2b] bg-[#111111] p-5 text-sm leading-7 text-[#efe8d3]">
                <p>
                  Unit 3 William Street Trading Estate
                  <br />
                  William Street
                  <br />
                  Portslade
                  <br />
                  Brighton
                  <br />
                  East Sussex
                  <br />
                  BN41 1PZ
                </p>
              </div>
              <div className="rounded-2xl border border-[#3f3a2b] bg-[#111111] p-5 text-sm leading-7 text-[#efe8d3]">
                <p><a href="tel:01273411177" className="text-[#f2d675] transition hover:text-white">01273 411177</a></p>
                <p className="mt-3"><a href="mailto:info@windowsinsussex.co.uk" className="text-[#f2d675] transition hover:text-white">info@windowsinsussex.co.uk</a></p>
                <p className="mt-3">Our office is open Monday to Friday from 9am to 5pm and we are open Saturdays from 9am to 1pm.</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[30px] border border-[#524826] bg-[#1b1b1b] shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            <div className="flex items-center gap-3 border-b border-[#3f3a2b] bg-[linear-gradient(180deg,#222016,#171717)] px-5 py-4 sm:px-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f1d882,#b69137)] text-lg font-semibold text-[#181818] shadow-[0_10px_24px_rgba(182,145,55,0.35)]">
                G
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-[#f4ead1] sm:text-lg">George</p>
                <p className="text-sm text-[#c9bea2]">R &amp; D Goatley digital staff member</p>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium sm:text-sm ${
                  connectionState === "connected"
                    ? "bg-[#243322] text-[#b9ef9e]"
                    : connectionState === "connecting"
                      ? "bg-[#46361a] text-[#f5d98f]"
                      : connectionState === "error"
                        ? "bg-[#4a1f1f] text-[#f5b0b0]"
                        : "bg-[#242424] text-[#d5cdb8]"
                }`}
              >
                {connectionState === "connected" ? <Volume2 className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
                <span>{isModelSpeaking ? "George is talking" : statusText}</span>
              </span>
            </div>

            <div ref={scrollRef} className="max-h-[560px] overflow-y-auto bg-[radial-gradient(circle_at_top,#262111_0%,#161616_55%,#121212_100%)] px-4 py-6 sm:px-6 sm:py-8">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[92%] whitespace-pre-wrap rounded-[24px] px-5 py-4 text-[15px] leading-7 shadow-sm sm:max-w-[86%] sm:text-[16px] ${
                        message.role === "user"
                          ? "rounded-br-md bg-[#c9a84f] text-[#171717]"
                          : message.role === "assistant"
                            ? "rounded-bl-md border border-[#4f4627] bg-[#f8f1dd] text-[#241f12]"
                            : "rounded-bl-md border border-[#4f4627] bg-[#2c2414] text-[#f3e7bc]"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {connectionState === "connecting" && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-3 rounded-[24px] rounded-bl-md border border-[#4f4627] bg-[#f8f1dd] px-5 py-4 text-[#241f12] shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> George is joining the call…
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#3f3a2b] bg-[#161616] px-4 py-4 sm:px-6">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-[#d4ccb8]">
                  {connectionState === "connected"
                    ? "You’re in a live conversation. Just speak naturally and George should reply automatically."
                    : "Start the live conversation and George will greet you, listen, and reply automatically without push-to-talk."}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={startConversation}
                    disabled={!canStart}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#c9a84f] px-5 py-3 text-sm font-semibold text-[#171717] transition hover:bg-[#e0be62] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Mic className="h-4 w-4" />
                    {connectionState === "connected" ? "Live conversation on" : "Start live conversation"}
                  </button>
                  {connectionState === "connected" && (
                    <button
                      type="button"
                      onClick={stopConversation}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#5b5235] bg-transparent px-5 py-3 text-sm font-semibold text-[#f4ead1] transition hover:bg-[#232323]"
                    >
                      <PhoneOff className="h-4 w-4" /> End conversation
                    </button>
                  )}
                </div>
              </div>
              {error ? <p className="mx-auto mt-3 w-full max-w-4xl text-sm text-[#f2b0b0]">{error}</p> : null}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="rounded-[30px] border border-[#524826] bg-[#171717] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#d6bb68]">Committed To Quality</p>
            <h3 className="mt-3 text-3xl font-bold text-[#f2d675]">10 YEAR GUARANTEE</h3>
            <p className="mt-4 text-base leading-8 text-[#efe8d3]">
              R &amp; D Goatley offers a full 10 year guarantee on all our installations, services and profile (5 years on glass and moving parts). All installations are insurance backed when FENSA certificates are issued.
            </p>
            <h4 className="mt-8 text-2xl font-semibold text-[#f2d675]">Our Payment Policy</h4>
            <p className="mt-4 text-base leading-8 text-[#efe8d3]">
              At R &amp; D Goatley, we take great pride in our workmanship and quality. That’s why we don’t require any deposits on contracts under £30,000—full payment is only due upon completion of your project. For contracts over £30,000 (including VAT), a 10% deposit is required.
            </p>
          </div>

          <div className="rounded-[30px] border border-[#524826] bg-[#f5f0de] p-6 text-[#1d1b16] shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <h2 className="text-2xl font-semibold text-[#1d1b16]">Customer Enquiry Form</h2>
            <p className="mt-3 text-sm leading-6 text-[#4b4638]">
              George stays exactly as he is operationally. This form simply matches the R &amp; D Goatley enquiry fields and keeps the same endpoint underneath.
            </p>

            <form action="https://formspree.io/f/mrbypyzv" method="POST" className="mt-6 space-y-5">
              <input type="hidden" name="source" value="R & D Goatley George page" />
              <input type="hidden" name="page" value={typeof window !== "undefined" ? window.location.href : "https://guardxnetwork.com/rd-goatley-george"} />
              <input type="hidden" name="submissionMode" value="manual_submit" />
              <input type="hidden" name="sessionId" value={conversationSessionIdRef.current} />
              <input type="hidden" name="submittedAt" value={new Date().toISOString()} />
              <input type="hidden" name="transcript" value={transcript} />
              <input type="hidden" name="_subject" value="New R & D Goatley George enquiry" />
              <input type="hidden" name="_replyto" value={leadForm.email} />

              <div>
                <p className="text-sm font-semibold text-[#1d1b16]">Customer</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {(["Personal", "Business"] as const).map((option) => (
                    <label key={option} className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-medium transition ${leadForm.customerType === option ? "border-[#1d1b16] bg-[#1d1b16] text-[#f5f0de]" : "border-[#bfa55c] bg-white text-[#1d1b16] hover:border-[#1d1b16]"}`}>
                      <input
                        type="radio"
                        name="customerType"
                        value={option}
                        checked={leadForm.customerType === option}
                        onChange={(event) => setLeadForm((prev) => ({ ...prev, customerType: event.target.value }))}
                        className="sr-only"
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Title*</label>
                  <select name="title" value={leadForm.title} onChange={(event) => setLeadForm((prev) => ({ ...prev, title: event.target.value }))} className="w-full rounded-xl border border-[#b9ab82] bg-white px-4 py-3 outline-none focus:border-[#1d1b16]">
                    {TITLE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div />
                <div>
                  <label className="mb-2 block text-sm font-medium">First Name</label>
                  <input name="firstName" value={leadForm.firstName} onChange={(event) => setLeadForm((prev) => ({ ...prev, firstName: event.target.value }))} placeholder="Type here..." className="w-full rounded-xl border border-[#b9ab82] bg-white px-4 py-3 outline-none focus:border-[#1d1b16]" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Last Name*</label>
                  <input name="lastName" value={leadForm.lastName} onChange={(event) => setLeadForm((prev) => ({ ...prev, lastName: event.target.value }))} placeholder="Type here..." required className="w-full rounded-xl border border-[#b9ab82] bg-white px-4 py-3 outline-none focus:border-[#1d1b16]" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Email*</label>
                  <input type="email" name="email" value={leadForm.email} onChange={(event) => setLeadForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Type here..." required className="w-full rounded-xl border border-[#b9ab82] bg-white px-4 py-3 outline-none focus:border-[#1d1b16]" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Phone*</label>
                  <input name="phone" value={leadForm.phone} onChange={(event) => setLeadForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Type here..." required className="w-full rounded-xl border border-[#b9ab82] bg-white px-4 py-3 outline-none focus:border-[#1d1b16]" />
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-[#1d1b16]">Address</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-medium">Building Name &amp; Street*</label>
                    <input name="street" value={leadForm.street} onChange={(event) => setLeadForm((prev) => ({ ...prev, street: event.target.value }))} placeholder="Type here..." className="w-full rounded-xl border border-[#b9ab82] bg-white px-4 py-3 outline-none focus:border-[#1d1b16]" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Town</label>
                    <input name="town" value={leadForm.town} onChange={(event) => setLeadForm((prev) => ({ ...prev, town: event.target.value }))} placeholder="Type here..." className="w-full rounded-xl border border-[#b9ab82] bg-white px-4 py-3 outline-none focus:border-[#1d1b16]" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">County</label>
                    <input name="county" value={leadForm.county} onChange={(event) => setLeadForm((prev) => ({ ...prev, county: event.target.value }))} placeholder="Type here..." className="w-full rounded-xl border border-[#b9ab82] bg-white px-4 py-3 outline-none focus:border-[#1d1b16]" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Post Code</label>
                    <input name="postcode" value={leadForm.postcode} onChange={(event) => setLeadForm((prev) => ({ ...prev, postcode: event.target.value }))} placeholder="Type here..." className="w-full rounded-xl border border-[#b9ab82] bg-white px-4 py-3 outline-none focus:border-[#1d1b16]" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Interested In</label>
                    <select name="interestedIn" value={leadForm.interestedIn} onChange={(event) => setLeadForm((prev) => ({ ...prev, interestedIn: event.target.value }))} className="w-full rounded-xl border border-[#b9ab82] bg-white px-4 py-3 outline-none focus:border-[#1d1b16]">
                      <option value="">Select Interest</option>
                      {INTEREST_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Additional Information</label>
                <input name="additionalInformation" value={leadForm.additionalInformation} onChange={(event) => setLeadForm((prev) => ({ ...prev, additionalInformation: event.target.value }))} className="w-full rounded-xl border border-[#b9ab82] bg-white px-4 py-3 outline-none focus:border-[#1d1b16]" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Your Message</label>
                <textarea name="message" value={leadForm.message} onChange={(event) => setLeadForm((prev) => ({ ...prev, message: event.target.value }))} placeholder="Message*" rows={6} className="w-full rounded-xl border border-[#b9ab82] bg-white px-4 py-3 outline-none focus:border-[#1d1b16]" />
              </div>

              <div className="flex justify-start">
                <button type="submit" className="rounded-full bg-[#1d1b16] px-6 py-3 text-sm font-semibold text-[#f5f0de] transition hover:bg-[#000000]">
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
