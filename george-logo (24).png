"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageCircle,
  Mic,
  Phone,
  PhoneOff,
  Radio,
  Volume2,
} from "lucide-react"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

type LeadFormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  carOfInterest: string
  budget: string
  monthlyBudget: string
  fuelType: string
  gearbox: string
  useCase: string
  additionalInformation: string
  message: string
}

type VisitorMemory = {
  firstName: string
  budget: string
  monthlyBudget: string
  fuelType: string
  gearbox: string
  useCase: string
  carOfInterest: string
  buyerIntent: string
}

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "system",
    content:
      "Hi — I’m George, the digital salesperson for Woodbourne Car Sales. You don’t need to scroll around — tell me what you’re after and I’ll narrow it down and point you to the best options.",
  },
]

function buildFirstResponseEvent(memory?: VisitorMemory | null) {
  const memoryInstruction = memory && (memory.firstName || memory.budget || memory.monthlyBudget || memory.fuelType || memory.gearbox || memory.useCase || memory.carOfInterest)
    ? ` You already have browser memory for this returning visitor. Work that in naturally. Mention what you remember and ask whether they want to carry on from there or change anything.`
    : ""

  return {
    type: "response.create",
    response: {
      instructions:
        `Briefly introduce yourself as George for Woodbourne Car Sales in warm, natural British English. Explain that visitors do not need to scroll because you can help them find the right car, answer questions, and guide them to the next step. Keep it short and professional. Ask only one short, directional question. Do not ask multiple questions, do not ramble, and do not invent any stock, finance, or spec details. Only make a light steer when it genuinely helps, and keep it grounded in broad categories rather than made-up specifics. Always suggest before asking where you reasonably can.${memoryInstruction}`,
    },
  }
}

const inputClass =
  "w-full rounded-2xl border border-[#cfd5e2] bg-white px-4 py-3 text-sm text-[#111827] outline-none transition placeholder:text-[#6b7280] focus:border-[#020575] focus:ring-2 focus:ring-[#020575]/10"

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

function normalizeVoiceTranscript(value: string) {
  let normalized = normalizeWhitespace(value)

  const replacements: Array<[RegExp, string]> = [
    [/\bpectoral\s+blades\b/gi, "petrol"],
    [/\bpetrol\s+please\b/gi, "petrol"],
    [/\bpetrols\b/gi, "petrol"],
    [/\bautomatick[yý]\b/gi, "automatic"],
    [/\bautomatik\b/gi, "automatic"],
    [/\bautomaticky\b/gi, "automatic"],
    [/\bmanuell?\b/gi, "manual"],
    [/\bulez\s+compliant\b/gi, "ULEZ compliant"],
  ]

  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement)
  }

  return normalized
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

function buildUserTranscript(messages: LiveMessage[]) {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => `Visitor: ${normalizeWhitespace(message.content)}`)
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

function inferFuelType(text: string) {
  const lowered = text.toLowerCase()
  if (lowered.includes("hybrid")) return "Hybrid"
  if (lowered.includes("electric") || lowered.includes("ev")) return "Electric"
  if (lowered.includes("diesel")) return "Diesel"
  if (lowered.includes("petrol")) return "Petrol"
  if (/no preference|anything|either/.test(lowered)) return "No preference"
  return ""
}

function inferGearbox(text: string) {
  const lowered = text.toLowerCase()
  if (lowered.includes("automatic") || lowered.includes("auto")) return "Automatic"
  if (lowered.includes("manual")) return "Manual"
  if (/no preference|anything|either/.test(lowered)) return "No preference"
  return ""
}

function inferUseCase(text: string) {
  const lowered = text.toLowerCase()
  if (/first car|new driver|first time driver/.test(lowered)) return "First car / new driver"
  if (/family|kids|children/.test(lowered)) return "Family use"
  if (/commut|work|daily/.test(lowered)) return "Commuting / daily driving"
  if (/school run/.test(lowered)) return "School runs"
  if (/long distance|motorway/.test(lowered)) return "Long-distance driving"
  return ""
}

function inferCarOfInterest(text: string) {
  return matchFirst(text, [
    /interested in the\s+([A-Za-z0-9][A-Za-z0-9 .,'&/-]{3,80})/i,
    /about the\s+([A-Za-z0-9][A-Za-z0-9 .,'&/-]{3,80})/i,
    /the\s+([A-Za-z0-9][A-Za-z0-9 .,'&/-]{3,80})\s+(?:for sale|you mentioned)/i,
  ])
}

function extractBudget(text: string) {
  return matchFirst(text, [
    /(?:budget|up to|under|around|about)\s*£?\s?([0-9][0-9,]{2,})/i,
    /£\s?([0-9][0-9,]{2,})/i,
  ])
}

function extractMonthlyBudget(text: string) {
  return matchFirst(text, [/(:?monthly budget|per month|a month|monthly)\s*(?:of)?\s*£?\s?([0-9][0-9,]{1,})/i])
}

function detectCaptureMode(transcript: string) {
  return /(?:take|get|grab|collect|leave|confirm|send)\s+(?:my|your|the)?\s*(?:details|number|email)|arrange a viewing|book a viewing|send (?:me )?details|request a call|call me back/i.test(
    transcript,
  )
}

function inferBuyerIntent(text: string) {
  const lowered = text.toLowerCase()
  if (/best number|best email|send (?:me )?details|book|arrange a viewing|call me back|i want this|that's the one|that works for me|sounds good|i like that one|when can i see it|can i buy/.test(lowered)) {
    return "High"
  }
  if (/compare|which one|lean towards|what do you recommend|automatic|manual|diesel|petrol|family|commut|budget|monthly/.test(lowered)) {
    return "Medium"
  }
  return lowered.trim() ? "Low" : ""
}

function buildReturnVisitorMessage(memory: VisitorMemory) {
  const parts: string[] = []
  if (memory.gearbox) parts.push(memory.gearbox.toLowerCase())
  if (memory.fuelType && memory.fuelType !== "No preference") parts.push(memory.fuelType.toLowerCase())
  if (memory.budget) parts.push(`under £${memory.budget}`)
  else if (memory.monthlyBudget) parts.push(`around £${memory.monthlyBudget} a month`)
  if (memory.useCase) parts.push(`for ${memory.useCase.toLowerCase()}`)
  if (memory.carOfInterest) parts.push(`and were looking at the ${memory.carOfInterest}`)

  const summary = parts.length ? parts.join(" ") : "and I can pick things up where you left off"
  const greetingName = memory.firstName ? ` ${memory.firstName}` : ""
  return `Welcome back${greetingName} — last time you were looking ${summary}. Tell me what’s changed, or I can carry on from there.`
}

function extractLeadDetailsFromTranscript(userTranscript: string, messages: LiveMessage[]) {
  const emailMatch = userTranscript.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const phoneMatch = userTranscript.match(/(?:\+?44\s?7\d{3}|0\d{4}|0\d{3}|0\d{2})[\s\d]{6,12}/)

  let firstName = ""
  let lastName = ""
  const fullName = matchFirst(userTranscript, [
    /my name is\s+([A-Za-z][A-Za-z' -]{1,50})/i,
    /name(?:'s| is)\s+([A-Za-z][A-Za-z' -]{1,50})/i,
    /i(?: am|'m)\s+called\s+([A-Za-z][A-Za-z' -]{1,50})/i,
    /this is\s+([A-Za-z][A-Za-z' -]{1,50})/i,
    /i am\s+([A-Za-z][A-Za-z' -]{1,50})/i,
    /i'm\s+([A-Za-z][A-Za-z' -]{1,50})/i,
  ])

  if (fullName) {
    const parts = normalizeWhitespace(fullName).split(" ")
    firstName = titleCase(parts[0] || "")
    lastName = titleCase(parts.slice(1).join(" "))
  }

  const recentNeed = lastUserMessages(messages, 6).join(" ")
  const summary = recentNeed ? (recentNeed.length > 500 ? `${recentNeed.slice(0, 497)}...` : recentNeed) : ""

  return {
    firstName,
    lastName,
    email: emailMatch ? normalizeWhitespace(emailMatch[0]) : "",
    phone: phoneMatch ? normalizeWhitespace(phoneMatch[0]) : "",
    carOfInterest: inferCarOfInterest(userTranscript),
    budget: extractBudget(userTranscript),
    monthlyBudget: extractMonthlyBudget(userTranscript),
    fuelType: inferFuelType(userTranscript),
    gearbox: inferGearbox(userTranscript),
    useCase: inferUseCase(userTranscript),
    summary,
    captureMode: detectCaptureMode(userTranscript),
  }
}

function isFormMostlyReady(leadForm: LeadFormState) {
  return Boolean(leadForm.firstName && leadForm.lastName && leadForm.email && leadForm.phone && leadForm.message)
}

function SteeringWheelMark() {
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24 sm:h-28 sm:w-28" aria-hidden="true">
      <defs>
        <linearGradient id="wheelStroke" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
          <stop offset="100%" stopColor="rgba(210,222,255,0.88)" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="40" fill="none" stroke="url(#wheelStroke)" strokeWidth="6.5" />
      <circle cx="60" cy="60" r="11" fill="none" stroke="url(#wheelStroke)" strokeWidth="5.5" />
      <path d="M33 48c8-12 18-18 27-18s19 6 27 18" fill="none" stroke="url(#wheelStroke)" strokeWidth="6" strokeLinecap="round" />
      <path d="M60 49v39" fill="none" stroke="url(#wheelStroke)" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M43 60l17 13 17-13" fill="none" stroke="url(#wheelStroke)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-full border border-[#cfd5e2] bg-white px-4 py-2 text-sm font-medium text-[#111827] transition hover:border-[#020575]/30 hover:text-[#020575]"
    >
      {label}
    </a>
  )
}

export function WoodbourneGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [statusText, setStatusText] = useState("Ready when you are")
  const [isModelSpeaking, setIsModelSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [captureMode, setCaptureMode] = useState(false)
  const [buyerIntent, setBuyerIntent] = useState("")
  const [conversationOpen, setConversationOpen] = useState(false)
  const [pageUrl, setPageUrl] = useState("https://askgeorge.app/woodbourne")
  const [submittedAt, setSubmittedAt] = useState("")
  const [leadForm, setLeadForm] = useState<LeadFormState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    carOfInterest: "",
    budget: "",
    monthlyBudget: "",
    fuelType: "",
    gearbox: "",
    useCase: "",
    additionalInformation: "",
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
  const pendingAutoContinueRef = useRef<number | null>(null)
  const lastAutoContinuedTextRef = useRef("")
  const visitorMemoryRef = useRef<VisitorMemory | null>(null)

  useEffect(() => {
    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `woodbourne-${Date.now()}-${Math.random()}`
    conversationSessionIdRef.current = sessionId
    setSubmittedAt(new Date().toISOString())
    if (typeof window !== "undefined") setPageUrl(window.location.href)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const raw = window.localStorage.getItem("george-woodbourne-memory")
      if (!raw) return
      const memory = JSON.parse(raw) as VisitorMemory

      setLeadForm((prev) => ({
        ...prev,
        firstName: memory.firstName || prev.firstName,
        budget: memory.budget || prev.budget,
        monthlyBudget: memory.monthlyBudget || prev.monthlyBudget,
        fuelType: memory.fuelType || prev.fuelType,
        gearbox: memory.gearbox || prev.gearbox,
        useCase: memory.useCase || prev.useCase,
        carOfInterest: memory.carOfInterest || prev.carOfInterest,
      }))
      setBuyerIntent(memory.buyerIntent || "")
      visitorMemoryRef.current = memory

      if (memory.firstName || memory.budget || memory.monthlyBudget || memory.gearbox || memory.fuelType || memory.useCase || memory.carOfInterest) {
        setMessages((prev) => {
          const alreadyHasWelcomeBack = prev.some((message) => message.id === "welcome-back")
          if (alreadyHasWelcomeBack) return prev
          return [...prev, { id: "welcome-back", role: "system", content: buildReturnVisitorMessage(memory) }]
        })
      }
    } catch {
      // ignore invalid stored memory
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })

    const transcript = buildTranscript(messages)
    const userTranscript = buildUserTranscript(messages)
    const details = extractLeadDetailsFromTranscript(userTranscript, messages)
    setCaptureMode(details.captureMode || Boolean(details.phone || details.email))

    setLeadForm((prev) => ({
      ...prev,
      firstName: details.firstName || prev.firstName,
      lastName: details.lastName || prev.lastName,
      email: details.email || prev.email,
      phone: details.phone || prev.phone,
      carOfInterest: details.carOfInterest || prev.carOfInterest,
      budget: details.budget || prev.budget,
      monthlyBudget: details.monthlyBudget || prev.monthlyBudget,
      fuelType: details.fuelType || prev.fuelType,
      gearbox: details.gearbox || prev.gearbox,
      useCase: details.useCase || prev.useCase,
      additionalInformation: prev.additionalInformation || details.summary || "",
      message:
        prev.message ||
        (details.summary
          ? `Woodbourne enquiry via George: ${details.summary}`
          : transcript
            ? "Enquiry via George conversation on the Woodbourne page."
            : ""),
    }))

    const nextBuyerIntent = inferBuyerIntent(userTranscript)
    if (nextBuyerIntent) setBuyerIntent(nextBuyerIntent)
  }, [messages])

  useEffect(() => {
    if (typeof window === "undefined") return

    const memory: VisitorMemory = {
      firstName: leadForm.firstName,
      budget: leadForm.budget,
      monthlyBudget: leadForm.monthlyBudget,
      fuelType: leadForm.fuelType,
      gearbox: leadForm.gearbox,
      useCase: leadForm.useCase,
      carOfInterest: leadForm.carOfInterest,
      buyerIntent,
    }

    const hasUsefulMemory = Object.values(memory).some(Boolean)
    if (!hasUsefulMemory) return

    window.localStorage.setItem("george-woodbourne-memory", JSON.stringify(memory))
  }, [buyerIntent, leadForm.budget, leadForm.carOfInterest, leadForm.firstName, leadForm.fuelType, leadForm.gearbox, leadForm.monthlyBudget, leadForm.useCase])

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

    if (typeof window !== "undefined" && pendingAutoContinueRef.current) {
      window.clearTimeout(pendingAutoContinueRef.current)
      pendingAutoContinueRef.current = null
    }

    currentAssistantTextRef.current = ""
    currentAssistantMessageIdRef.current = null
    lastAutoContinuedTextRef.current = ""
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
    const cleaned = normalizeVoiceTranscript(text)
    if (!cleaned) return
    lastAutoContinuedTextRef.current = ""
    setMessages((prev) => [...prev, makeMessage("user", cleaned)])
  }

  function shouldForceContinuation(text: string) {
    const cleaned = normalizeWhitespace(text).toLowerCase()
    if (!cleaned) return false

    const lookupSignals = [
      /let me check(?: our)? stock/,
      /let me have a look/,
      /i(?:'| a)?ll check(?: the)? stock/,
      /i(?:'| a)?ll see what(?: we've| we have)? got/,
      /give me a second and i(?:'| a)?ll/,
      /let me narrow (?:it|this) down/,
    ]
    const hasLookupSignal = lookupSignals.some((pattern) => pattern.test(cleaned))
    if (!hasLookupSignal) return false

    const likelyResolved = /(best option|best fit|i can see|i've found|i have found|there'?s|there is|the strongest option|the best one|based on what you've said)/.test(cleaned)
    return !likelyResolved
  }

  function requestAssistantContinuation(triggerText: string) {
    if (!dcRef.current || dcRef.current.readyState !== "open") return
    const cleaned = normalizeWhitespace(triggerText)
    if (!cleaned) return
    if (lastAutoContinuedTextRef.current === cleaned) return
    lastAutoContinuedTextRef.current = cleaned

    dcRef.current.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions:
            "Continue immediately from your last sentence without waiting for the visitor. Do not repeat yourself. Give the result in this same turn. If you mention stock, continue straight into the best fit you can see. Only describe a specific car from exact visible listing facts. Do not use vague phrases like typically, usually, or recent model year. If a detail is not clearly visible, say you do not want to guess and offer to get it confirmed.",
        },
      }),
    )
  }

  function scheduleAssistantContinuationIfNeeded(text: string) {
    if (typeof window === "undefined") return
    if (!shouldForceContinuation(text)) return
    if (pendingAutoContinueRef.current) {
      window.clearTimeout(pendingAutoContinueRef.current)
    }
    pendingAutoContinueRef.current = window.setTimeout(() => {
      requestAssistantContinuation(text)
      pendingAutoContinueRef.current = null
    }, 450)
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
      case "response.output_audio_transcript.done": {
        const finalText = typeof event.transcript === "string" ? event.transcript : ""
        appendOrUpdateAssistantPartial(finalText, true)
        scheduleAssistantContinuationIfNeeded(finalText)
        break
      }
      case "conversation.item.input_audio_transcription.completed":
        addUserTranscript(typeof event.transcript === "string" ? event.transcript : "")
        break
      case "response.output_item.done": {
        const content = Array.isArray(event?.item?.content) ? event.item.content : []
        const outputTranscript = content
          .map((part: any) => {
            if (typeof part?.transcript === "string") return part.transcript
            if (typeof part?.text === "string") return part.text
            return ""
          })
          .filter(Boolean)
          .join("\n")
        if (outputTranscript) {
          appendOrUpdateAssistantPartial(outputTranscript, true)
          scheduleAssistantContinuationIfNeeded(outputTranscript)
        }
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
    setStatusText("Connecting George…")
    setError(null)
    setConversationOpen(true)

    try {
      const tokenResponse = await fetch("/api/woodbourne-session", { method: "GET", cache: "no-store" })
      const tokenData = await tokenResponse.json().catch(() => null)

      if (!tokenResponse.ok || !tokenData?.value) {
        throw new Error(tokenData?.error || "Could not create a secure live session.")
      }

      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = localStream

      const pc = new RTCPeerConnection()
      pcRef.current = pc

      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream))

      const audio = document.createElement("audio")
      audio.autoplay = true
      audioRef.current = audio

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams
        if (remoteStream) {
          audio.srcObject = remoteStream
        }
      }

      const dc = pc.createDataChannel("oai-events")
      dcRef.current = dc

      dc.onmessage = (messageEvent) => {
        try {
          const event = JSON.parse(messageEvent.data)
          handleRealtimeEvent(event)
        } catch {
          // ignore malformed payloads
        }
      }

      dc.onopen = () => {
        setConnectionState("connected")
        setStatusText("Listening…")
        dc.send(JSON.stringify(buildFirstResponseEvent(visitorMemoryRef.current)))
      }

      dc.onclose = () => {
        setIsModelSpeaking(false)
        setConnectionState("idle")
        setStatusText("Ready when you are")
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.value}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "")
        throw new Error(errorText || "Could not connect the live voice session.")
      }

      const answer = { type: "answer", sdp: await response.text() }
      await pc.setRemoteDescription(answer)
    } catch (err) {
      await cleanupConversation()
      setConnectionState("error")
      setStatusText("Could not connect George")
      setError(err instanceof Error ? err.message : "Could not connect George right now.")
    }
  }

  async function stopConversation() {
    await cleanupConversation()
    setConnectionState("idle")
    setStatusText("Ready when you are")
  }

  return (
    <div className="min-h-screen bg-[#f3f3f3] text-[#111827]">
      <div className="fixed bottom-4 right-4 z-50 sm:bottom-5 sm:right-5">
        <a
          href="https://api.whatsapp.com/send?phone=447984518439"
          target="_blank"
          rel="noreferrer"
          aria-label="Open WhatsApp"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25d366] text-white shadow-[0_18px_35px_rgba(37,211,102,0.35)] transition hover:scale-105 hover:brightness-105 sm:h-14 sm:w-14"
        >
          <MessageCircle className="h-6 w-6 sm:h-7 sm:w-7" />
        </a>
      </div>

      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="flex flex-col items-center justify-center">
  <img src="/woodbourne-logo.jpg" alt="Woodbourne Car Sales" className="h-24 sm:h-32 w-auto object-contain" />
</div>
          <h2 className="mt-4 text-2xl font-semibold text-[#262626] sm:text-4xl">Meet George</h2>
          <p className="mt-3 text-sm text-[#4b5563] sm:text-base">
            Tell George what you're after and he’ll help you find the right car.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href="https://www.woodbournecarsales.co.uk/used/cars/" target="_blank" rel="noreferrer" className="rounded-full bg-[#020575] px-5 py-3 text-white font-semibold transition hover:brightness-110">
              View Stock
            </a>
            <a href="https://api.whatsapp.com/send?phone=447984518439" target="_blank" rel="noreferrer" className="rounded-full bg-[#25d366] px-5 py-3 font-semibold text-[#073b1d] transition hover:brightness-105">
              WhatsApp
            </a>
          </div>

          <div className="mt-8">

            <div className="mx-auto max-w-4xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d8dde8] bg-[#f8fafc] px-4 py-2 text-sm font-medium text-[#374151] shadow-sm">
                {connectionState === "connected" ? <Volume2 className="h-4 w-4 text-[#020575]" /> : connectionState === "connecting" ? <Loader2 className="h-4 w-4 animate-spin text-[#020575]" /> : <Radio className="h-4 w-4 text-[#020575]" />}
                <span>{isModelSpeaking ? "George is talking" : statusText}</span>
              </div>

              <button
                type="button"
                onClick={connectionState === "connected" ? stopConversation : startConversation}
                disabled={connectionState === "connecting"}
                aria-label={connectionState === "connected" ? "End talking to George" : "Start talking to George"}
                className={`mx-auto mt-6 flex h-[220px] w-[220px] items-center justify-center rounded-full transition duration-300 sm:h-[260px] sm:w-[260px] ${
                  connectionState === "connecting" ? "cursor-wait" : "hover:scale-[1.02]"
                }`}
                style={{
                  background: "radial-gradient(circle at 30% 25%, #4c6cff 0%, #1d3fcf 28%, #020575 62%, #010349 100%)",
                  boxShadow:
                    connectionState === "connected" || connectionState === "connecting"
                      ? "0 0 0 10px rgba(2,5,117,0.10), 0 28px 60px rgba(2,5,117,0.28), inset 0 3px 18px rgba(255,255,255,0.24), inset 0 -14px 28px rgba(1,3,73,0.5)"
                      : "0 24px 54px rgba(2,5,117,0.18), inset 0 3px 18px rgba(255,255,255,0.22), inset 0 -14px 28px rgba(1,3,73,0.48)",
                }}
              >
                <div className="flex h-[80%] w-[80%] flex-col items-center justify-center rounded-full border border-white/20 text-white">
                  {connectionState === "connected" ? <PhoneOff className="h-14 w-14 sm:h-16 sm:w-16" /> : <SteeringWheelMark />}
                  <span className="mt-3 text-lg font-semibold sm:text-xl">
                    {connectionState === "connected" ? "End conversation" : connectionState === "connecting" ? "Connecting..." : "Talk to George"}
                  </span>
                </div>
              </button>

              <p className="mx-auto mt-5 max-w-3xl text-sm leading-6 text-[#4b5563] sm:text-base sm:leading-7">
                Speak naturally and George will answer questions and help you as you go.
              </p>
              {error ? <p className="mt-3 text-sm font-medium text-[#b42318]">{error}</p> : null}

              <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap sm:justify-center">
                <a href="tel:01273500990" className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#cfd5e2] bg-white px-5 py-3 text-sm font-semibold text-[#111827] transition hover:border-[#020575]/30 hover:text-[#020575] sm:w-auto">
                  <Phone className="h-4 w-4" /> 01273 500990
                </a>
                <a href="tel:07984518439" className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#cfd5e2] bg-white px-5 py-3 text-sm font-semibold text-[#111827] transition hover:border-[#020575]/30 hover:text-[#020575] sm:w-auto">
                  <Phone className="h-4 w-4" /> 07984 518439
                </a>
                <a href="https://api.whatsapp.com/send?phone=447984518439" target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25d366] px-5 py-3 text-sm font-semibold text-[#073b1d] transition hover:brightness-105 sm:w-auto">
                  <MessageCircle className="h-4 w-4" /> Start WhatsApp
                </a>
              </div>

              <div className="mt-7">
                <button
                  type="button"
                  onClick={() => setConversationOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#020575] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  {conversationOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {conversationOpen ? "Hide conversation" : "Open conversation"}
                </button>
              </div>
            </div>
          </div>

          {conversationOpen ? (
            <div className="border-t border-[#e5e7eb] bg-[#f8fafc] px-4 py-6 sm:px-6 sm:py-8">
              <div ref={scrollRef} className="mx-auto max-h-[520px] max-w-4xl overflow-y-auto rounded-[24px] border border-[#d8dde8] bg-white p-3 shadow-sm sm:rounded-[28px] sm:p-5">
                <div className="flex flex-col gap-4">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[96%] whitespace-pre-wrap rounded-[20px] px-3 py-3 text-[14px] leading-6 shadow-sm sm:max-w-[82%] sm:rounded-[24px] sm:px-4 sm:text-[15px] sm:leading-7 ${
                          message.role === "user"
                            ? "bg-[#020575] text-white"
                            : message.role === "system"
                              ? "border border-[#d8dde8] bg-[#f4f6fb] text-[#374151]"
                              : "border border-[#d8dde8] bg-white text-[#111827]"
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="border-t border-[#e5e7eb] bg-[#f2f2f7] px-3 py-6 sm:px-6 sm:py-10">
            <div className="mx-auto max-w-4xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-[#262626]">Get in touch</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4b5563]">
                    If you'd like Woodbourne to come back to you, please double-check your first name, last name, email, telephone, and message, then hit Send below. If you'd rather message directly, tap WhatsApp instead.
                  </p>
                </div>
                {captureMode ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#d8dde8] bg-white px-4 py-2 text-sm font-medium text-[#020575] shadow-sm">
                    George is helping gather your details
                  </div>
                ) : null}
              </div>

              {formMostlyReady ? (
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#cde7d5] bg-[#eefaf1] px-4 py-2 text-sm font-medium text-[#166534] shadow-sm">
                  <CheckCircle2 className="h-4 w-4" /> That looks ready — double-check your details, then press Send or use WhatsApp.
                </div>
              ) : null}

              <form action="https://formsubmit.co/info@guardxnetwork.com" method="POST" className="mt-6 space-y-5 rounded-[24px] border border-[#d8dde8] bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-6">
                <input type="hidden" name="source" value="Woodbourne George page" />
                <input type="hidden" name="page" value={pageUrl} />
                <input type="hidden" name="submissionMode" value="manual_submit" />
                <input type="hidden" name="sessionId" value={conversationSessionIdRef.current} />
                <input type="hidden" name="submittedAt" value={submittedAt} />
                <input type="hidden" name="transcript" value={transcript} />
                <input type="hidden" name="buyerIntent" value={buyerIntent} />
                <input type="hidden" name="carOfInterest" value={leadForm.carOfInterest} />
                <input type="hidden" name="budget" value={leadForm.budget} />
                <input type="hidden" name="monthlyBudget" value={leadForm.monthlyBudget} />
                <input type="hidden" name="fuelType" value={leadForm.fuelType} />
                <input type="hidden" name="gearbox" value={leadForm.gearbox} />
                <input type="hidden" name="useCase" value={leadForm.useCase} />
                <input type="hidden" name="additionalInformation" value={leadForm.additionalInformation} />
                <input type="hidden" name="_subject" value="New Woodbourne George enquiry" />
                <input type="hidden" name="_replyto" value={leadForm.email} />
                <input type="hidden" name="_captcha" value="false" />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#262626]">First name</label>
                    <input name="firstName" value={leadForm.firstName} onChange={(event) => setLeadForm((prev) => ({ ...prev, firstName: event.target.value }))} placeholder="Type here..." className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#262626]">Last name</label>
                    <input name="lastName" value={leadForm.lastName} onChange={(event) => setLeadForm((prev) => ({ ...prev, lastName: event.target.value }))} placeholder="Type here..." className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#262626]">Email</label>
                    <input type="email" name="email" value={leadForm.email} onChange={(event) => setLeadForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Type here..." className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#262626]">Telephone</label>
                    <input name="phone" value={leadForm.phone} onChange={(event) => setLeadForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Type here..." className={inputClass} />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#262626]">Message</label>
                  <textarea name="message" value={leadForm.message} onChange={(event) => setLeadForm((prev) => ({ ...prev, message: event.target.value }))} rows={7} className={`${inputClass} min-h-[180px] resize-y`} />
                </div>

                <div className="grid gap-3 pt-1 sm:flex sm:flex-wrap">
                  <button type="submit" className="w-full rounded-full bg-[#020575] px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 sm:w-auto">
                    Send
                  </button>
                  <a href="https://www.woodbournecarsales.co.uk/contact/" target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#cfd5e2] bg-white px-5 py-3 text-sm font-semibold text-[#111827] transition hover:border-[#020575]/30 hover:text-[#020575] sm:w-auto">
                    Go to Contact Us <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </form>
            </div>
          </div>

          <div className="border-t border-[#e5e7eb] bg-white px-4 py-6 sm:px-6">
            <div className="mx-auto grid max-w-4xl gap-3 sm:flex sm:flex-wrap">
              <QuickLink href="https://www.woodbournecarsales.co.uk/" label="Back to Woodbourne home" />
              <QuickLink href="https://www.woodbournecarsales.co.uk/used/cars/" label="Browse used cars" />
              <QuickLink href="https://www.woodbournecarsales.co.uk/finance/" label="Finance page" />
              <QuickLink href="https://www.woodbournecarsales.co.uk/warranty/" label="Warranty page" />
              <QuickLink href="https://www.woodbournecarsales.co.uk/reviews/" label="Reviews" />
              <QuickLink href="https://www.woodbournecarsales.co.uk/contact/" label="Contact us" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
