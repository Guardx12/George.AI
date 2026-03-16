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
  buildingStreet: string
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
      "Hello — I’m George for R & D Goatley. Ask me about windows, doors, conservatories, pergolas, pricing guidance, product options, or booking a visit.",
  },
]

const FIRST_RESPONSE_EVENT = {
  type: "response.create",
  response: {
    instructions:
      "Briefly introduce yourself as George for R & D Goatley, explain that you can help with windows, doors, conservatories, pergolas and booking a visit, then warmly ask what the visitor would like help with today.",
  },
}

const titleOptions = ["None", "Mr", "Mrs", "Miss", "Ms", "Mx", "Doctor", "Mr and Mr", "Miss and Miss"]
const interestOptions = [
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
    /my name is\s+([A-Za-z][A-Za-z' -]{1,50})/i,
    /i am\s+([A-Za-z][A-Za-z' -]{1,50})/i,
    /i'm\s+([A-Za-z][A-Za-z' -]{1,50})/i,
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

function buildLeadSummary(messages: LiveMessage[]) {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => normalizeWhitespace(message.content))
    .filter(Boolean)

  if (!userMessages.length) return "R & D Goatley enquiry from the George page."

  const relevant = userMessages.slice(-4).join(" ")
  return relevant.length > 800 ? `${relevant.slice(0, 797)}...` : relevant
}

export function GoatleyLiveAssistant() {
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
    buildingStreet: "",
    town: "",
    county: "",
    postcode: "",
    additionalInformation: "",
    interestedIn: "Windows and Doors",
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
        : `goatley-${Date.now()}-${Math.random()}`
    conversationSessionIdRef.current = sessionId
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    }

    const transcript = buildTranscript(messages)
    const details = extractLeadDetailsFromTranscript(transcript)
    const summary = buildLeadSummary(messages)

    setLeadForm((prev) => ({
      ...prev,
      firstName: details.firstName || prev.firstName,
      lastName: details.lastName || prev.lastName,
      email: details.email || prev.email,
      phone: details.phone || prev.phone,
      message: prev.message || summary,
    }))
  }, [messages])

  const canStart = useMemo(() => connectionState === "idle" || connectionState === "error", [connectionState])
  const transcript = useMemo(() => buildTranscript(messages), [messages])
  const suggestedSummary = useMemo(() => buildLeadSummary(messages), [messages])

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

    setMessages((prev) =>
      prev.map((message) =>
        message.id === targetId ? { ...message, content: currentAssistantTextRef.current } : message,
      ),
    )

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
    setLeadForm((prev) => ({
      ...prev,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      message: "",
    }))

    try {
      const tokenResponse = await fetch("/api/george-session", { method: "GET", cache: "no-store" })
      const tokenData = await tokenResponse.json().catch(() => null)
      if (!tokenResponse.ok) {
        throw new Error(typeof tokenData?.error === "string" ? tokenData.error : "Could not create a secure live session.")
      }

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
        window.setTimeout(() => {
          dc.send(JSON.stringify(FIRST_RESPONSE_EVENT))
        }, 150)
      })

      dc.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data)
          handleRealtimeEvent(data)
        } catch {
          // ignore parse error for unexpected events
        }
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

  function updateField<K extends keyof LeadFormState>(field: K, value: LeadFormState[K]) {
    setLeadForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <section className="bg-[radial-gradient(circle_at_top,#2b2412_0%,#171717_36%,#111111_100%)] text-[#f7f0d8]">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pt-14">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.38em] text-[#cfab44]">R &amp; D Goatley x George</p>
          <h1 className="mt-4 font-serif text-4xl tracking-wide text-[#f1d06d] sm:text-5xl lg:text-6xl">
            A George page styled for R &amp; D Goatley.
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-[#f4ecd2]/85 sm:text-lg">
            George works exactly as before, but this version is styled to match the premium R &amp; D Goatley look and includes the requested contact form underneath.
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
          <div className="overflow-hidden rounded-[30px] border border-[#5a4b1a] bg-[#f6f1e6] text-[#222222] shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
            <div className="border-b border-[#d6c8a3] bg-[linear-gradient(180deg,#202020_0%,#121212_100%)] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#967628] bg-[radial-gradient(circle_at_top,#f4d777,#ad8430)] font-serif text-lg font-bold text-[#171717]">
                  G
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-2xl tracking-wide text-[#f1d06d]">George</p>
                  <p className="text-sm text-[#f4ecd2]/78">Live digital member of staff for R &amp; D Goatley</p>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold sm:text-sm ${
                    connectionState === "connected"
                      ? "border-[#4f6d49] bg-[#16331f] text-[#d5f5da]"
                      : connectionState === "connecting"
                        ? "border-[#8f6f2a] bg-[#3a2b0d] text-[#f6e2a0]"
                        : connectionState === "error"
                          ? "border-[#6b2c2c] bg-[#3b1616] text-[#ffd7d7]"
                          : "border-[#4f4331] bg-[#231f18] text-[#f4ecd2]"
                  }`}
                >
                  {connectionState === "connected" ? <Volume2 className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
                  <span>{isModelSpeaking ? "George is talking" : statusText}</span>
                </span>
              </div>
            </div>

            <div ref={scrollRef} className="max-h-[34rem] overflow-y-auto bg-[linear-gradient(180deg,#fbf8f0_0%,#f3ecdf_100%)] px-4 py-6 sm:px-6 sm:py-8">
              <div className="mx-auto flex max-w-4xl flex-col gap-5">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[92%] whitespace-pre-wrap rounded-[24px] px-5 py-4 text-[15px] leading-7 shadow-sm sm:max-w-[86%] sm:text-[16px] ${
                        message.role === "user"
                          ? "rounded-br-md bg-[#1f1f1f] text-[#f6e2a0]"
                          : message.role === "assistant"
                            ? "rounded-bl-md border border-[#d6c8a3] bg-white text-[#222222]"
                            : "rounded-bl-md border border-[#d6c8a3] bg-[#f4ecd5] text-[#3e3313]"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {connectionState === "connecting" && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-3 rounded-[24px] rounded-bl-md border border-[#d6c8a3] bg-white px-5 py-4 text-[#5b5138] shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> George is joining the call…
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#d6c8a3] bg-white px-4 py-4 sm:px-6">
              <div className="mx-auto flex max-w-4xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-sm leading-6 text-[#564d3b]">
                  {connectionState === "connected"
                    ? "You’re in a live conversation. Speak naturally and George should reply automatically. He can help explain products, answer questions, and guide the visitor toward an enquiry."
                    : "Start the live conversation and George will greet the visitor and speak out loud automatically."}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={startConversation}
                    disabled={!canStart}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,#d8b24d,#a88227)] px-5 py-3 text-sm font-semibold text-[#141414] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Mic className="h-4 w-4" />
                    {connectionState === "connected" ? "Live conversation on" : "Start live conversation"}
                  </button>
                  {connectionState === "connected" && (
                    <button
                      type="button"
                      onClick={stopConversation}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#cab98f] bg-white px-5 py-3 text-sm font-semibold text-[#2a2416] transition hover:bg-[#faf5e9]"
                    >
                      <PhoneOff className="h-4 w-4" /> End conversation
                    </button>
                  )}
                </div>
              </div>
              {error ? <p className="mx-auto mt-3 max-w-4xl text-sm text-[#9e2f2f]">{error}</p> : null}
            </div>
          </div>

          <div className="rounded-[30px] border border-[#5a4b1a] bg-[linear-gradient(180deg,#1d1d1d_0%,#121212_100%)] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#cfab44]">Contact R &amp; D Goatley</p>
            <h2 className="mt-3 font-serif text-3xl text-[#f1d06d]">Premium quality, trusted service.</h2>
            <p className="mt-4 text-sm leading-7 text-[#f4ecd2]/82">
              Please feel free to contact us to discuss anything either via our phone, email or the contact form below. We are happy to help. Please note, we cannot offer estimates via email, please call us and we can book you in for a visit.
            </p>
            <div className="mt-6 space-y-5 text-sm leading-7 text-[#f4ecd2]/88">
              <div>
                <p>Unit 3 William Street Trading Estate</p>
                <p>William Street</p>
                <p>Portslade</p>
                <p>Brighton</p>
                <p>East Sussex</p>
                <p>BN41 1PZ</p>
              </div>
              <div>
                <p><a href="tel:01273411177" className="transition hover:text-white">01273 411177</a></p>
                <p><a href="mailto:info@windowsinsussex.co.uk" className="transition hover:text-white">info@windowsinsussex.co.uk</a></p>
              </div>
              <p>Our office is open Monday to Friday from 9am to 5pm and we are open Saturdays from 9am to 1pm.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[32px] border border-[#5a4b1a] bg-[#f8f5ee] p-6 text-[#1f1f1f] shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-8">
          <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <h2 className="font-serif text-3xl text-[#2f2613]">Contact R &amp; D Goatley</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5f5746] sm:text-base">
                Ready to send your details? George can help fill some of this from the conversation as you talk. Check everything, make any changes you want, then submit the form yourself.
              </p>

              <form action="https://formspree.io/f/mrbypyzv" method="POST" className="mt-6 space-y-5">
                <input type="hidden" name="source" value="R & D Goatley George page" />
                <input type="hidden" name="page" value={typeof window !== "undefined" ? window.location.href : "https://guardxnetwork.com/rd-goatley-george"} />
                <input type="hidden" name="submissionMode" value="manual_submit" />
                <input type="hidden" name="sessionId" value={conversationSessionIdRef.current} />
                <input type="hidden" name="transcript" value={transcript} />
                <input type="hidden" name="summary" value={suggestedSummary} />
                <input type="hidden" name="_subject" value="New R & D Goatley George enquiry" />
                <input type="hidden" name="_replyto" value={leadForm.email} />

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-[#d9cfb7] bg-white p-1">
                    <div className="grid grid-cols-2 overflow-hidden rounded-[14px] border border-[#ebe2cc]">
                      {(["Personal", "Business"] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => updateField("customerType", option)}
                          className={`px-4 py-3 text-sm font-semibold transition ${leadForm.customerType === option ? "bg-[#1f1f1f] text-[#f6e2a0]" : "bg-white text-[#3a321f] hover:bg-[#f8f3e7]"}`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <select
                    name="title"
                    value={leadForm.title}
                    onChange={(event) => updateField("title", event.target.value)}
                    className="rounded-2xl border border-[#d9cfb7] bg-white px-4 py-3 text-sm text-[#1f1f1f] outline-none focus:border-[#af8a35]"
                  >
                    {titleOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>

                  <input type="hidden" name="customerType" value={leadForm.customerType} />
                  <input
                    type="text"
                    name="firstName"
                    placeholder="First Name"
                    value={leadForm.firstName}
                    onChange={(event) => updateField("firstName", event.target.value)}
                    required
                    className="rounded-2xl border border-[#d9cfb7] bg-white px-4 py-3 text-sm text-[#1f1f1f] outline-none focus:border-[#af8a35]"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <input
                    type="text"
                    name="lastName"
                    placeholder="Last Name"
                    value={leadForm.lastName}
                    onChange={(event) => updateField("lastName", event.target.value)}
                    required
                    className="rounded-2xl border border-[#d9cfb7] bg-white px-4 py-3 text-sm text-[#1f1f1f] outline-none focus:border-[#af8a35]"
                  />
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={leadForm.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    required
                    className="rounded-2xl border border-[#d9cfb7] bg-white px-4 py-3 text-sm text-[#1f1f1f] outline-none focus:border-[#af8a35]"
                  />
                  <input
                    type="text"
                    name="phone"
                    placeholder="Phone"
                    value={leadForm.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                    required
                    className="rounded-2xl border border-[#d9cfb7] bg-white px-4 py-3 text-sm text-[#1f1f1f] outline-none focus:border-[#af8a35]"
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-[#3a321f]">Address</p>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <input
                      type="text"
                      name="buildingStreet"
                      placeholder="Building Name & Street"
                      value={leadForm.buildingStreet}
                      onChange={(event) => updateField("buildingStreet", event.target.value)}
                      required
                      className="rounded-2xl border border-[#d9cfb7] bg-white px-4 py-3 text-sm text-[#1f1f1f] outline-none focus:border-[#af8a35] xl:col-span-2"
                    />
                    <input
                      type="text"
                      name="town"
                      placeholder="Town"
                      value={leadForm.town}
                      onChange={(event) => updateField("town", event.target.value)}
                      className="rounded-2xl border border-[#d9cfb7] bg-white px-4 py-3 text-sm text-[#1f1f1f] outline-none focus:border-[#af8a35]"
                    />
                    <input
                      type="text"
                      name="county"
                      placeholder="County"
                      value={leadForm.county}
                      onChange={(event) => updateField("county", event.target.value)}
                      className="rounded-2xl border border-[#d9cfb7] bg-white px-4 py-3 text-sm text-[#1f1f1f] outline-none focus:border-[#af8a35]"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <input
                    type="text"
                    name="postcode"
                    placeholder="Post Code"
                    value={leadForm.postcode}
                    onChange={(event) => updateField("postcode", event.target.value)}
                    className="rounded-2xl border border-[#d9cfb7] bg-white px-4 py-3 text-sm text-[#1f1f1f] outline-none focus:border-[#af8a35]"
                  />
                  <input
                    type="text"
                    name="additionalInformation"
                    placeholder="Additional Information"
                    value={leadForm.additionalInformation}
                    onChange={(event) => updateField("additionalInformation", event.target.value)}
                    className="rounded-2xl border border-[#d9cfb7] bg-white px-4 py-3 text-sm text-[#1f1f1f] outline-none focus:border-[#af8a35] md:col-span-2"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#3a321f]">Interested In</label>
                  <select
                    name="interestedIn"
                    value={leadForm.interestedIn}
                    onChange={(event) => updateField("interestedIn", event.target.value)}
                    className="w-full rounded-2xl border border-[#d9cfb7] bg-white px-4 py-3 text-sm text-[#1f1f1f] outline-none focus:border-[#af8a35]"
                  >
                    {interestOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#3a321f]">Your Message</label>
                  <textarea
                    name="message"
                    placeholder="Type your message..."
                    value={leadForm.message}
                    onChange={(event) => updateField("message", event.target.value)}
                    rows={6}
                    required
                    className="w-full rounded-[24px] border border-[#d9cfb7] bg-white px-4 py-4 text-sm text-[#1f1f1f] outline-none focus:border-[#af8a35]"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(180deg,#d8b24d,#a88227)] px-7 py-3 text-sm font-semibold text-[#141414] transition hover:brightness-105"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-6 rounded-[28px] border border-[#e0d5bb] bg-[linear-gradient(180deg,#fffdfa_0%,#f4ede1_100%)] p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a88227]">Committed To Quality</p>
                <h3 className="mt-2 font-serif text-3xl text-[#2f2613]">10 YEAR GUARANTEE</h3>
                <p className="mt-3 text-sm leading-7 text-[#5f5746]">
                  R &amp; D Goatley offers a full 10 year guarantee on all our installations, services and profile (5 years on glass and moving parts). All installations are insurance backed when FENSA certificates are issued.
                </p>
              </div>

              <div className="border-t border-[#e0d5bb] pt-6">
                <h3 className="font-serif text-2xl text-[#2f2613]">Our Payment Policy</h3>
                <p className="mt-3 text-sm leading-7 text-[#5f5746]">
                  At R &amp; D Goatley, we take great pride in our workmanship and quality. That’s why we don’t require any deposits on contracts under £30,000—full payment is only due upon completion of your project. For contracts over £30,000 (including VAT), a 10% deposit is required.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
