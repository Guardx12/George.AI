"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, CheckCircle2, Loader2, Mic, PhoneOff, Radio, Sparkles, Volume2 } from "lucide-react"

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
      "Hi — I’m George, the digital member of staff for R & D Goatley. Ask me about windows, doors, conservatories, pergolas, product options, or the next step for a quote enquiry.",
  },
]

const FIRST_RESPONSE_EVENT = {
  type: "response.create",
  response: {
    instructions:
      "Briefly introduce yourself as George for R & D Goatley, then ask in a warm, natural way what the visitor would like help with today.",
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

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function buildTranscript(messages: LiveMessage[]) {
  return messages
    .filter((message) => message.role === "assistant" || message.role === "user")
    .map((message) => `${message.role === "assistant" ? "George" : "Visitor"}: ${normalizeWhitespace(message.content)}`)
    .join("\n\n")
}

function lastUserMessages(messages: LiveMessage[], count = 4) {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => normalizeWhitespace(message.content))
    .filter(Boolean)
    .slice(-count)
}

function matchFirst(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return normalizeWhitespace(match[1])
  }
  return ""
}

function inferInterest(text: string) {
  const lowered = text.toLowerCase()
  const mapping: Array<[string, string]> = [
    ["aluminium bifold", "Aluminium Bifolds"],
    ["bifold", "Aluminium Bifolds"],
    ["composite door", "Composite Doors"],
    ["resi door", "Resi Doors"],
    ["aluminium patio", "Aluminium Patio Doors"],
    ["patio door", "Patio Doors"],
    ["vertical sliding", "Vertical Sliding Windows"],
    ["sash window", "Vertical Sliding Windows"],
    ["upvc window", "PVC Windows"],
    ["pvc window", "PVC Windows"],
    ["aluminium window", "Aluminium Windows"],
    ["fascia", "Fascia and Soffits"],
    ["soffit", "Fascia and Soffits"],
    ["conservator", "Conservatory"],
    ["glass unit", "Glass Units"],
    ["service call", "Service Call"],
    ["repair", "Service Call"],
    ["window", "Windows and Doors"],
    ["door", "Windows and Doors"],
  ]

  for (const [needle, value] of mapping) {
    if (lowered.includes(needle)) return value
  }
  return ""
}

function detectCaptureMode(transcript: string) {
  return /(?:take|get|grab|collect|leave|confirm|fill(?:ing)?\s+in)\s+(?:your\s+)?details|what(?:'s| is)\s+the\s+best\s+(?:email|number)|can i take your|ready to send|hit send/i.test(
    transcript,
  )
}

function extractLeadDetailsFromTranscript(transcript: string, messages: LiveMessage[]) {
  const emailMatch = transcript.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const phoneMatch = transcript.match(/(?:\+?44\s?7\d{3}|0\d{4}|0\d{3}|0\d{2})[\s\d]{6,12}/)
  const postcodeMatch = transcript.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i)

  const title = matchFirst(transcript, [
    /(?:title is|i am|i'm|this is)\s+(mr and mr|miss and miss|doctor|mr\.?|mrs\.?|miss|ms|mx)\b/i,
  ])

  let firstName = ""
  let lastName = ""
  const fullName = matchFirst(transcript, [
    /my name is\s+([A-Za-z][A-Za-z' -]{1,50})/i,
    /it's\s+([A-Za-z][A-Za-z' -]{1,50})/i,
    /this is\s+([A-Za-z][A-Za-z' -]{1,50})/i,
    /i am\s+([A-Za-z][A-Za-z' -]{1,50})/i,
    /i'm\s+([A-Za-z][A-Za-z' -]{1,50})/i,
  ])
  if (fullName) {
    const parts = normalizeWhitespace(fullName).split(" ")
    firstName = titleCase(parts[0] || "")
    lastName = titleCase(parts.slice(1).join(" "))
  }

  const street = matchFirst(transcript, [
    /(?:address is|building name and street is|street is)\s+([^,.\n]{4,80})/i,
    /(?:i live at|we are at)\s+([^,.\n]{4,80})/i,
  ])
  const town = matchFirst(transcript, [/(?:town is|in the town of)\s+([A-Za-z][A-Za-z' -]{2,40})/i])
  const county = matchFirst(transcript, [/(?:county is)\s+([A-Za-z][A-Za-z' -]{2,40})/i])

  const personalHints = /\b(my house|my home|our house|i need|i'm looking|i am looking|for my property|for my house)\b/i.test(transcript)
  const businessHints = /\b(company|business|office|shop|premises|commercial|for our business|for the business)\b/i.test(transcript)

  const interest = inferInterest(transcript)

  const recentNeed = lastUserMessages(messages, 3).join(" ")
  const summary = recentNeed
    ? recentNeed.length > 260
      ? `${recentNeed.slice(0, 257)}...`
      : recentNeed
    : ""

  return {
    title: title
      ? TITLE_OPTIONS.find((option) => option.toLowerCase() === title.toLowerCase()) || titleCase(title.replace(/\.$/, ""))
      : "",
    firstName,
    lastName,
    email: emailMatch ? normalizeWhitespace(emailMatch[0]) : "",
    phone: phoneMatch ? normalizeWhitespace(phoneMatch[0]) : "",
    street: street ? titleCase(street) : "",
    town: town ? titleCase(town) : "",
    county: county ? titleCase(county) : "",
    postcode: postcodeMatch ? normalizeWhitespace(postcodeMatch[1]).toUpperCase() : "",
    customerType: businessHints && !personalHints ? "Business" : personalHints ? "Personal" : "",
    interestedIn: interest,
    summary,
    captureMode: detectCaptureMode(transcript),
  }
}

function isFormMostlyReady(leadForm: LeadFormState) {
  return Boolean(
    (leadForm.firstName || leadForm.lastName) &&
      (leadForm.email || leadForm.phone) &&
      (leadForm.interestedIn || leadForm.message || leadForm.additionalInformation),
  )
}

export function GoatleyGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [statusText, setStatusText] = useState("Ready when you are")
  const [isModelSpeaking, setIsModelSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [captureMode, setCaptureMode] = useState(false)
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
    const details = extractLeadDetailsFromTranscript(transcript, messages)
    setCaptureMode(details.captureMode)

    setLeadForm((prev) => ({
      ...prev,
      customerType: details.customerType || prev.customerType,
      title: details.title || prev.title,
      firstName: details.firstName || prev.firstName,
      lastName: details.lastName || prev.lastName,
      email: details.email || prev.email,
      phone: details.phone || prev.phone,
      street: details.street || prev.street,
      town: details.town || prev.town,
      county: details.county || prev.county,
      postcode: details.postcode || prev.postcode,
      interestedIn: details.interestedIn || prev.interestedIn,
      additionalInformation: prev.additionalInformation || details.summary || "",
      message:
        prev.message ||
        (details.summary
          ? `Enquiry via George: ${details.summary}`
          : transcript
            ? "Enquiry via George conversation on the R & D Goatley page."
            : ""),
    }))
  }, [messages])

  const canStart = useMemo(() => connectionState === "idle" || connectionState === "error", [connectionState])
  const transcript = useMemo(() => buildTranscript(messages), [messages])
  const formMostlyReady = useMemo(() => isFormMostlyReady(leadForm), [leadForm])

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
    setCaptureMode(false)

    try {
      const tokenResponse = await fetch("/api/goatley-session", { method: "GET", cache: "no-store" })
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
    setCaptureMode(false)
  }

  const inputClass =
    "w-full rounded-2xl border border-[#8d6b25]/40 bg-[linear-gradient(180deg,rgba(20,20,20,0.95)_0%,rgba(8,8,8,0.98)_100%)] px-4 py-3 text-[15px] text-[#f6e8ba] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_35px_rgba(0,0,0,0.25)] outline-none transition placeholder:text-[#8f8059] focus:border-[#f0cb6d] focus:shadow-[0_0_0_1px_rgba(240,203,109,0.5),0_18px_35px_rgba(0,0,0,0.35)]"

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 text-white sm:px-6 lg:px-8">
      <div className="space-y-7">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-[32px] border border-[#d7b65d]/35 bg-[linear-gradient(145deg,rgba(22,22,22,0.98)_0%,rgba(10,10,10,0.96)_48%,rgba(34,26,10,0.98)_100%)] p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-[#f0cb6d]/10 backdrop-blur sm:p-10">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#f0cb6d]/30 bg-[#f0cb6d]/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.34em] text-[#f5d57b] shadow-[0_10px_30px_rgba(201,168,79,0.15)] sm:text-xs">
            <Sparkles className="h-4 w-4" /> 
          </div>
          <h1 className="mt-5 bg-[linear-gradient(180deg,#fff9e9_0%,#f1cd72_100%)] bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
            Your digital member of staff for R &amp; D Goatley.
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-[#d8c9a4] sm:text-lg">
            George answers questions, explains products and options, guides visitors naturally toward an enquiry, and helps collect the right details when someone is ready.
          </p>
          <div className="mx-auto mt-6 h-px w-40 bg-[linear-gradient(90deg,transparent_0%,rgba(240,203,109,0.9)_50%,transparent_100%)]" />
        </div>

        <div className="overflow-hidden rounded-[32px] border border-[#d7b65d]/25 bg-[linear-gradient(180deg,rgba(20,20,20,0.98)_0%,rgba(8,8,8,0.99)_100%)] shadow-[0_35px_90px_rgba(0,0,0,0.5)] ring-1 ring-[#f0cb6d]/10 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 border-b border-[#d7b65d]/20 bg-[linear-gradient(180deg,rgba(42,32,13,0.95)_0%,rgba(15,15,15,0.95)_100%)] px-5 py-4 sm:px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#ffe8a3_0%,#dfb95a_35%,#8e6720_100%)] text-lg font-semibold text-[#111] shadow-[0_12px_30px_rgba(223,185,90,0.35)] animate-pulse">
              G
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-[#fff6db] sm:text-lg">George</p>
              <p className="text-sm text-[#c9bb95]">R &amp; D Goatley digital member of staff</p>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium shadow-[0_10px_24px_rgba(0,0,0,0.28)] sm:text-sm ${
                connectionState === "connected"
                  ? "border-[#2c7e42]/40 bg-[#0f2416] text-[#8ce6a8]"
                  : connectionState === "connecting"
                    ? "border-[#a57b20]/40 bg-[#24190a] text-[#f4cd6a]"
                    : connectionState === "error"
                      ? "border-[#8f2f2f]/40 bg-[#2a1111] text-[#ff9a9a]"
                      : "border-[#6e5825]/35 bg-[#18140c] text-[#d6c082]"
              }`}
            >
              {connectionState === "connected" ? <Volume2 className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
              <span>{isModelSpeaking ? "George is talking" : statusText}</span>
            </span>
          </div>

          <div ref={scrollRef} className="max-h-[560px] overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(76,58,20,0.35)_0%,rgba(18,18,18,0.94)_36%,rgba(6,6,6,0.98)_100%)] px-4 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[92%] whitespace-pre-wrap rounded-[24px] px-5 py-4 text-[15px] leading-7 shadow-[0_15px_35px_rgba(0,0,0,0.28)] sm:max-w-[86%] sm:text-[16px] ${
                      message.role === "user"
                        ? "rounded-br-md border border-[#d7b65d]/35 bg-[linear-gradient(180deg,#f0cb6d_0%,#bb8e2d_100%)] text-[#17130b]"
                        : message.role === "assistant"
                          ? "rounded-bl-md border border-[#d7b65d]/18 bg-[linear-gradient(180deg,rgba(255,248,228,0.08)_0%,rgba(255,255,255,0.03)_100%)] text-[#f7ebc5] backdrop-blur"
                          : "rounded-bl-md border border-[#8d6b25]/35 bg-[#18140d] text-[#d7c08a]"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {connectionState === "connecting" && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-3 rounded-[24px] rounded-bl-md border border-[#d7b65d]/18 bg-[linear-gradient(180deg,rgba(255,248,228,0.08)_0%,rgba(255,255,255,0.03)_100%)] px-5 py-4 text-[#f7ebc5] shadow-[0_15px_35px_rgba(0,0,0,0.28)]">
                    <Loader2 className="h-4 w-4 animate-spin" /> George is joining the call…
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#d7b65d]/18 bg-[linear-gradient(180deg,rgba(20,20,20,0.98)_0%,rgba(11,11,11,0.98)_100%)] px-4 py-4 sm:px-6">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-[#c9bb95]">
                {connectionState === "connected"
                  ? "You’re in a live conversation. Just speak naturally. George will reply automatically and should pre-fill the enquiry form as he collects the details."
                  : "Start the live conversation and George will greet the visitor, reply automatically, and guide them naturally toward an enquiry when the timing is right."}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={startConversation}
                  disabled={!canStart}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#f0cb6d]/30 bg-[linear-gradient(180deg,#f4d273_0%,#c2912d_100%)] px-5 py-3 text-sm font-semibold text-[#16110a] shadow-[0_18px_36px_rgba(194,145,45,0.25)] transition hover:scale-[1.02] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Mic className="h-4 w-4" />
                  {connectionState === "connected" ? "Live conversation on" : "Start live conversation"}
                </button>
                {connectionState === "connected" && (
                  <button
                    type="button"
                    onClick={stopConversation}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#8d6b25]/35 bg-transparent px-5 py-3 text-sm font-semibold text-[#e7d09a] transition hover:border-[#f0cb6d]/45 hover:bg-[#1b160d]"
                  >
                    <PhoneOff className="h-4 w-4" /> End conversation
                  </button>
                )}
              </div>
            </div>
            {error ? <p className="mx-auto mt-3 w-full max-w-4xl text-sm text-[#ff9a9a]">{error}</p> : null}
          </div>

          <div className="border-t border-[#d7b65d]/18 bg-[radial-gradient(circle_at_top,rgba(95,73,26,0.26)_0%,rgba(14,14,14,0.98)_35%,rgba(7,7,7,1)_100%)] px-5 py-6 text-white sm:px-6 sm:py-8">
            <div className="mx-auto w-full max-w-4xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-[#fff6db]">Customer Enquiry Form</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c9bb95]">
                    George should pre-fill this from the conversation as details are collected. The visitor can then check it, press send, and it will go straight through to R &amp; D Goatley.
                  </p>
                </div>
                {captureMode ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#f0cb6d]/30 bg-[#211808] px-4 py-2 text-sm font-medium text-[#f4cd6a] shadow-[0_16px_34px_rgba(0,0,0,0.28)]">
                    <Sparkles className="h-4 w-4" /> George is collecting details now
                  </div>
                ) : null}
              </div>

              {formMostlyReady ? (
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#2c7e42]/35 bg-[#0f2416] px-4 py-2 text-sm font-medium text-[#8ce6a8] shadow-[0_16px_34px_rgba(0,0,0,0.28)]">
                  <CheckCircle2 className="h-4 w-4" /> If this all looks okay, hit send and it will go through to R &amp; D Goatley.
                </div>
              ) : null}

              <form action="https://formspree.io/f/mrbypyzv" method="POST" className="mt-6 space-y-5 rounded-[28px] border border-[#d7b65d]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.01)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_30px_60px_rgba(0,0,0,0.32)] sm:p-6">
                <input type="hidden" name="source" value="R & D Goatley George page" />
                <input type="hidden" name="page" value={typeof window !== "undefined" ? window.location.href : "https://guardxnetwork.com/rd-goatley-george"} />
                <input type="hidden" name="submissionMode" value="manual_submit" />
                <input type="hidden" name="sessionId" value={conversationSessionIdRef.current} />
                <input type="hidden" name="submittedAt" value={new Date().toISOString()} />
                <input type="hidden" name="transcript" value={transcript} />
                <input type="hidden" name="_subject" value="New R & D Goatley George enquiry" />
                <input type="hidden" name="_replyto" value={leadForm.email} />

                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#f0cb6d]">Customer</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {(["Personal", "Business"] as const).map((option) => (
                      <label
                        key={option}
                        className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                          leadForm.customerType === option
                            ? "border-[#f0cb6d]/45 bg-[linear-gradient(180deg,#f4d273_0%,#c2912d_100%)] text-[#16110a] shadow-[0_14px_26px_rgba(194,145,45,0.24)]"
                            : "border-[#8d6b25]/35 bg-[#121212] text-[#f1dfac] hover:border-[#f0cb6d]/45"
                        }`}
                      >
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
                    <label className="mb-2 block text-sm font-medium text-[#f7ebc5]">Title*</label>
                    <select name="title" value={leadForm.title} onChange={(event) => setLeadForm((prev) => ({ ...prev, title: event.target.value }))} className={inputClass}>
                      {TITLE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div />
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#f7ebc5]">First Name</label>
                    <input name="firstName" value={leadForm.firstName} onChange={(event) => setLeadForm((prev) => ({ ...prev, firstName: event.target.value }))} placeholder="Type here..." className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#f7ebc5]">Last Name*</label>
                    <input name="lastName" value={leadForm.lastName} onChange={(event) => setLeadForm((prev) => ({ ...prev, lastName: event.target.value }))} placeholder="Type here..." required className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#f7ebc5]">Email*</label>
                    <input type="email" name="email" value={leadForm.email} onChange={(event) => setLeadForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Type here..." required className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#f7ebc5]">Phone*</label>
                    <input name="phone" value={leadForm.phone} onChange={(event) => setLeadForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Type here..." required className={inputClass} />
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-[#f0cb6d]">Address</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-[#f7ebc5]">Building Name &amp; Street*</label>
                      <input name="street" value={leadForm.street} onChange={(event) => setLeadForm((prev) => ({ ...prev, street: event.target.value }))} placeholder="Type here..." className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#f7ebc5]">Town</label>
                      <input name="town" value={leadForm.town} onChange={(event) => setLeadForm((prev) => ({ ...prev, town: event.target.value }))} placeholder="Type here..." className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#f7ebc5]">County</label>
                      <input name="county" value={leadForm.county} onChange={(event) => setLeadForm((prev) => ({ ...prev, county: event.target.value }))} placeholder="Type here..." className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#f7ebc5]">Post Code</label>
                      <input name="postcode" value={leadForm.postcode} onChange={(event) => setLeadForm((prev) => ({ ...prev, postcode: event.target.value }))} placeholder="Type here..." className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#f7ebc5]">Interested In</label>
                      <select name="interestedIn" value={leadForm.interestedIn} onChange={(event) => setLeadForm((prev) => ({ ...prev, interestedIn: event.target.value }))} className={inputClass}>
                        <option value="">Select Interest</option>
                        {INTEREST_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#f7ebc5]">Additional Information</label>
                  <input name="additionalInformation" value={leadForm.additionalInformation} onChange={(event) => setLeadForm((prev) => ({ ...prev, additionalInformation: event.target.value }))} className={inputClass} />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#f7ebc5]">Your Message</label>
                  <textarea name="message" value={leadForm.message} onChange={(event) => setLeadForm((prev) => ({ ...prev, message: event.target.value }))} placeholder="Message*" rows={6} className={`${inputClass} min-h-[160px] resize-y`} />
                </div>

                <div className="flex justify-start pt-1">
                  <button type="submit" className="rounded-full border border-[#f0cb6d]/30 bg-[linear-gradient(180deg,#f4d273_0%,#c2912d_100%)] px-7 py-3 text-sm font-semibold text-[#16110a] shadow-[0_18px_36px_rgba(194,145,45,0.25)] transition hover:scale-[1.02] hover:brightness-110">
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-2">
          <a
            href="https://www.randdgoatley.co.uk/"
            className="inline-flex items-center gap-2 rounded-full border border-[#f0cb6d]/30 bg-[linear-gradient(180deg,#f4d273_0%,#c2912d_100%)] px-8 py-4 text-base font-semibold text-[#16110a] shadow-[0_18px_36px_rgba(194,145,45,0.25)] transition hover:scale-[1.02] hover:brightness-110"
          >
            <ArrowLeft className="h-5 w-5" /> Back to R &amp; D Goatleys
          </a>
        </div>
      </div>
    </section>
  )
}
