"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, CheckCircle2, Loader2, MessageCircle, Mic, PhoneOff, Radio, Sparkles, Volume2 } from "lucide-react"

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
      "Hi — I’m George, the digital salesperson for Woodbourne Car Sales. Tell me what sort of car you’re after and I’ll narrow it down for you.",
  },
]

const FIRST_RESPONSE_EVENT = {
  type: "response.create",
  response: {
    instructions:
      "Briefly introduce yourself as George for Woodbourne Car Sales in warm, natural British English. Explain that visitors do not need to scroll because you can help them find the right car, answer questions, and help with the next step. Then ask one short question about what sort of car they are after.",
  },
}

const FUEL_OPTIONS = ["", "Petrol", "Diesel", "Hybrid", "Electric", "No preference"]
const GEARBOX_OPTIONS = ["", "Automatic", "Manual", "No preference"]

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
  return matchFirst(text, [
    /(?:monthly budget|per month|a month|monthly)\s*(?:of)?\s*£?\s?([0-9][0-9,]{1,})/i,
  ])
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

function extractLeadDetailsFromTranscript(transcript: string, messages: LiveMessage[]) {
  const emailMatch = transcript.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const phoneMatch = transcript.match(/(?:\+?44\s?7\d{3}|0\d{4}|0\d{3}|0\d{2})[\s\d]{6,12}/)

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

  const recentNeed = lastUserMessages(messages, 4).join(" ")
  const summary = recentNeed ? (recentNeed.length > 320 ? `${recentNeed.slice(0, 317)}...` : recentNeed) : ""

  return {
    firstName,
    lastName,
    email: emailMatch ? normalizeWhitespace(emailMatch[0]) : "",
    phone: phoneMatch ? normalizeWhitespace(phoneMatch[0]) : "",
    carOfInterest: inferCarOfInterest(transcript),
    budget: extractBudget(transcript),
    monthlyBudget: extractMonthlyBudget(transcript),
    fuelType: inferFuelType(transcript),
    gearbox: inferGearbox(transcript),
    useCase: inferUseCase(transcript),
    summary,
    captureMode: detectCaptureMode(transcript),
  }
}

function isFormMostlyReady(leadForm: LeadFormState) {
  return Boolean((leadForm.firstName || leadForm.lastName) && (leadForm.email || leadForm.phone) && (leadForm.carOfInterest || leadForm.message))
}

export function WoodbourneGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [statusText, setStatusText] = useState("Ready when you are")
  const [isModelSpeaking, setIsModelSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [captureMode, setCaptureMode] = useState(false)
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
  const [buyerIntent, setBuyerIntent] = useState("")

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

  useEffect(() => {
    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `woodbourne-${Date.now()}-${Math.random()}`
    conversationSessionIdRef.current = sessionId
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

      if (memory.firstName || memory.budget || memory.monthlyBudget || memory.gearbox || memory.fuelType || memory.useCase || memory.carOfInterest) {
        setMessages((prev) => {
          const alreadyHasWelcomeBack = prev.some((message) => message.id === "welcome-back")
          if (alreadyHasWelcomeBack) return prev
          return [
            ...prev,
            {
              id: "welcome-back",
              role: "system",
              content: buildReturnVisitorMessage(memory),
            },
          ]
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
    const details = extractLeadDetailsFromTranscript(transcript, messages)
    setCaptureMode(details.captureMode)

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

    const nextBuyerIntent = inferBuyerIntent(transcript)
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

    if (pendingAutoContinueRef.current) {
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
        const transcript = content
          .map((part: any) => {
            if (typeof part?.transcript === "string") return part.transcript
            if (typeof part?.text === "string") return part.text
            return ""
          })
          .filter(Boolean)
          .join("\n")
        if (transcript) {
          appendOrUpdateAssistantPartial(transcript, true)
          scheduleAssistantContinuationIfNeeded(transcript)
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
        dc.send(JSON.stringify(FIRST_RESPONSE_EVENT))
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

      const answer = {
        type: "answer",
        sdp: await response.text(),
      }

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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[32px] border border-[#d8dde8] bg-white shadow-[0_24px_70px_rgba(2,5,117,0.08)]">
          <div className="border-b border-[#e5e7eb] bg-[#f2f2f7] px-5 py-6 sm:px-6 sm:py-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <img src="/woodbourne-logo.jpg" alt="Woodbourne Car Sales" className="h-14 w-auto object-contain sm:h-16" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#020575]">Woodbourne Car Sales x George</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#262626] sm:text-4xl">Meet George</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-[#4b5563] sm:text-base">
                    Woodbourne’s live digital salesperson. George helps visitors find the right car, answers stock questions naturally, compares the best-fit options, and moves serious buyers toward WhatsApp or an enquiry.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://www.woodbournecarsales.co.uk/used/cars/"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[#cfd5e2] bg-white px-4 py-2 text-sm font-medium text-[#262626] transition hover:border-[#020575]/25 hover:text-[#020575]"
                >
                  View stock
                </a>
                <a
                  href="https://api.whatsapp.com/send/?phone=447984518439&text&type=phone_number&app_absent=0"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#020575] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </div>
            </div>
          </div>

          <div className="border-b border-[#e5e7eb] bg-white px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-xs text-[#4b5563] sm:text-sm">
                <span className="rounded-full border border-[#d8dde8] bg-[#f8fafc] px-3 py-2">Stock-led replies</span>
                <span className="rounded-full border border-[#d8dde8] bg-[#f8fafc] px-3 py-2">Finance aware</span>
                <span className="rounded-full border border-[#d8dde8] bg-[#f8fafc] px-3 py-2">Warranty aware</span>
                <span className="rounded-full border border-[#d8dde8] bg-[#f8fafc] px-3 py-2">WhatsApp handoff</span>
                {buyerIntent ? <span className="rounded-full border border-[#d8dde8] bg-[#f8fafc] px-3 py-2">Intent: {buyerIntent}</span> : null}
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium shadow-sm sm:text-sm ${
                  connectionState === "connected"
                    ? "border-[#cde7d5] bg-[#eefaf1] text-[#166534]"
                    : connectionState === "connecting"
                      ? "border-[#d9d5c6] bg-[#faf7ef] text-[#8a6a13]"
                      : connectionState === "error"
                        ? "border-[#f2caca] bg-[#fff1f1] text-[#b42318]"
                        : "border-[#d8dde8] bg-[#f8fafc] text-[#374151]"
                }`}
              >
                {connectionState === "connected" ? <Volume2 className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
                <span>{isModelSpeaking ? "George is talking" : statusText}</span>
              </span>
            </div>
          </div>

          <div className="border-b border-[#e5e7eb] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] px-4 py-10 sm:px-6 sm:py-12">
            <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-[#020575]">
                {connectionState === "connected"
                  ? isModelSpeaking
                    ? "George is talking"
                    : "George is live"
                  : connectionState === "connecting"
                    ? "Connecting George"
                    : "Tap the circle to speak to George"}
              </p>

              <button
                type="button"
                onClick={connectionState === "connected" ? stopConversation : startConversation}
                disabled={connectionState === "connecting"}
                aria-label={connectionState === "connected" ? "Stop talking to George" : "Start talking to George"}
                className={`group relative mt-8 flex h-[250px] w-[250px] items-center justify-center rounded-full transition duration-300 ease-out sm:h-[300px] sm:w-[300px] ${
                  connectionState === "connecting" ? "cursor-wait" : "hover:scale-[1.02]"
                } ${
                  connectionState === "connected" || connectionState === "connecting"
                    ? "animate-[pulse_2s_ease-in-out_infinite]"
                    : "animate-[pulse_4s_ease-in-out_infinite]"
                }`}
                style={{
                  background:
                    "radial-gradient(circle at 30% 25%, #4c6cff 0%, #1d3fcf 28%, #020575 62%, #010349 100%)",
                  boxShadow:
                    connectionState === "connected" || connectionState === "connecting"
                      ? "0 0 0 10px rgba(2,5,117,0.10), 0 28px 60px rgba(2,5,117,0.28), inset 0 3px 18px rgba(255,255,255,0.24), inset 0 -14px 28px rgba(1,3,73,0.5)"
                      : "0 24px 54px rgba(2,5,117,0.18), inset 0 3px 18px rgba(255,255,255,0.22), inset 0 -14px 28px rgba(1,3,73,0.48)",
                }}
              >
                <span className="pointer-events-none absolute inset-[8px] rounded-full border border-white/20" />
                <span className="pointer-events-none absolute left-[12%] top-[10%] h-[22%] w-[52%] rounded-full bg-white/30 blur-[10px]" />
                <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0)_45%,rgba(255,255,255,0.16)_75%,rgba(255,255,255,0.24)_100%)]" />
                <div className="relative z-10 flex h-[80%] w-[80%] flex-col items-center justify-center rounded-full text-white">
                  {connectionState === "connected" ? <PhoneOff className="h-16 w-16 sm:h-20 sm:w-20" /> : <Mic className="h-16 w-16 sm:h-20 sm:w-20" />}
                  <span className="mt-4 text-lg font-semibold sm:text-xl">
                    {connectionState === "connected" ? "End conversation" : connectionState === "connecting" ? "Connecting..." : "Talk to George"}
                  </span>
                </div>
                <span className="sr-only">{connectionState === "connected" ? "George is live" : "Start talking to George"}</span>
              </button>

              <div className="mt-6 min-h-[84px] max-w-3xl text-center">
                <p className="text-base leading-7 text-[#374151] sm:text-lg">
                  {connectionState === "connected"
                    ? "You’re in a live conversation. Speak naturally and George should reply automatically, narrow the stock down, and pre-fill the enquiry form when the visitor is ready."
                    : "No need to scroll — just tell George what sort of car you want and he’ll narrow things down for you."}
                </p>
                {error ? <p className="mt-3 text-sm font-medium text-[#b42318]">{error}</p> : null}
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="max-h-[560px] overflow-y-auto bg-[#f8fafc] px-4 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[92%] whitespace-pre-wrap rounded-[24px] px-5 py-4 text-[15px] leading-7 shadow-sm sm:max-w-[86%] sm:text-[16px] ${
                      message.role === "user"
                        ? "rounded-br-md bg-[#020575] text-white"
                        : message.role === "assistant"
                          ? "rounded-bl-md border border-[#d8dde8] bg-white text-[#1f2937]"
                          : "rounded-bl-md border border-[#d8dde8] bg-[#eef2ff] text-[#243277]"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {connectionState === "connecting" && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-3 rounded-[24px] rounded-bl-md border border-[#d8dde8] bg-white px-5 py-4 text-[#1f2937] shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> George is joining the call…
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#e5e7eb] bg-white px-4 py-4 sm:px-6">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-[#4b5563]">
                George is trained on Woodbourne’s live stock, finance, warranty, dealership trust signals, WhatsApp handoff, and enquiry capture — so visitors get real help rather than a generic bot experience.
              </p>
              <div className="flex items-center gap-3">
                {connectionState === "connected" && (
                  <button
                    type="button"
                    onClick={stopConversation}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d8dde8] bg-white px-5 py-3 text-sm font-semibold text-[#262626] transition hover:border-[#020575]/25 hover:text-[#020575]"
                  >
                    <PhoneOff className="h-4 w-4" /> End conversation
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-[#e5e7eb] bg-[#f2f2f7] px-5 py-6 text-[#111827] sm:px-6 sm:py-8">
            <div className="mx-auto w-full max-w-4xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-[#262626]">Woodbourne Enquiry Form</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[#4b5563]">
                    George should pre-fill this from the conversation as he learns what the visitor wants. They can then check it, submit it, and it will go to your current GuardX inbox while WhatsApp stays available as the faster handoff.
                  </p>
                </div>
                {captureMode ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#d8dde8] bg-white px-4 py-2 text-sm font-medium text-[#020575] shadow-sm">
                    <Sparkles className="h-4 w-4" /> George is collecting details now
                  </div>
                ) : null}
              </div>

              {formMostlyReady ? (
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#cde7d5] bg-[#eefaf1] px-4 py-2 text-sm font-medium text-[#166534] shadow-sm">
                  <CheckCircle2 className="h-4 w-4" /> If this looks right, hit send and it will go through to your current enquiry inbox.
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="https://api.whatsapp.com/send/?phone=447984518439&text&type=phone_number&app_absent=0"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#25d366] px-5 py-3 text-sm font-semibold text-[#073b1d] shadow-sm transition hover:brightness-110"
                >
                  <MessageCircle className="h-4 w-4" /> Open WhatsApp handoff
                </a>
              </div>

              <form action="https://formsubmit.co/info@guardxnetwork.com" method="POST" className="mt-6 space-y-5 rounded-[28px] border border-[#d8dde8] bg-white p-5 shadow-sm sm:p-6">
                <input type="hidden" name="source" value="Woodbourne George page" />
                <input type="hidden" name="page" value={typeof window !== "undefined" ? window.location.href : "https://askgeorge.app/woodbourne"} />
                <input type="hidden" name="submissionMode" value="manual_submit" />
                <input type="hidden" name="sessionId" value={conversationSessionIdRef.current} />
                <input type="hidden" name="submittedAt" value={new Date().toISOString()} />
                <input type="hidden" name="transcript" value={transcript} />
                <input type="hidden" name="buyerIntent" value={buyerIntent} />
                <input type="hidden" name="leadSummary" value={`${leadForm.firstName} ${leadForm.lastName}`.trim() ? `${leadForm.firstName} ${leadForm.lastName}`.trim() + (leadForm.carOfInterest ? ` | ${leadForm.carOfInterest}` : "") + (leadForm.budget ? ` | Budget £${leadForm.budget}` : leadForm.monthlyBudget ? ` | Monthly £${leadForm.monthlyBudget}` : "") + (leadForm.useCase ? ` | ${leadForm.useCase}` : "") : "Woodbourne George enquiry"} />
                <input type="hidden" name="_subject" value="New Woodbourne George enquiry" />
                <input type="hidden" name="_replyto" value={leadForm.email} />
                <input type="hidden" name="_captcha" value="false" />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#262626]">First Name</label>
                    <input name="firstName" value={leadForm.firstName} onChange={(event) => setLeadForm((prev) => ({ ...prev, firstName: event.target.value }))} placeholder="Type here..." className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#262626]">Last Name</label>
                    <input name="lastName" value={leadForm.lastName} onChange={(event) => setLeadForm((prev) => ({ ...prev, lastName: event.target.value }))} placeholder="Type here..." className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#262626]">Email</label>
                    <input type="email" name="email" value={leadForm.email} onChange={(event) => setLeadForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Type here..." className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#262626]">Phone</label>
                    <input name="phone" value={leadForm.phone} onChange={(event) => setLeadForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Type here..." className={inputClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-[#262626]">Car of Interest</label>
                    <input name="carOfInterest" value={leadForm.carOfInterest} onChange={(event) => setLeadForm((prev) => ({ ...prev, carOfInterest: event.target.value }))} placeholder="e.g. Toyota Yaris" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#262626]">Budget</label>
                    <input name="budget" value={leadForm.budget} onChange={(event) => setLeadForm((prev) => ({ ...prev, budget: event.target.value }))} placeholder="e.g. 10000" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#262626]">Monthly Budget</label>
                    <input name="monthlyBudget" value={leadForm.monthlyBudget} onChange={(event) => setLeadForm((prev) => ({ ...prev, monthlyBudget: event.target.value }))} placeholder="e.g. 200" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#262626]">Fuel Type</label>
                    <select name="fuelType" value={leadForm.fuelType} onChange={(event) => setLeadForm((prev) => ({ ...prev, fuelType: event.target.value }))} className={inputClass}>
                      {FUEL_OPTIONS.map((option) => (
                        <option key={option || "blank-fuel"} value={option}>{option || "Select fuel type"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#262626]">Gearbox</label>
                    <select name="gearbox" value={leadForm.gearbox} onChange={(event) => setLeadForm((prev) => ({ ...prev, gearbox: event.target.value }))} className={inputClass}>
                      {GEARBOX_OPTIONS.map((option) => (
                        <option key={option || "blank-gearbox"} value={option}>{option || "Select gearbox"}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-[#262626]">Use Case</label>
                    <input name="useCase" value={leadForm.useCase} onChange={(event) => setLeadForm((prev) => ({ ...prev, useCase: event.target.value }))} placeholder="e.g. family use, commuting, first car" className={inputClass} />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#262626]">Additional Information</label>
                  <input name="additionalInformation" value={leadForm.additionalInformation} onChange={(event) => setLeadForm((prev) => ({ ...prev, additionalInformation: event.target.value }))} className={inputClass} />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#262626]">Your Message</label>
                  <textarea name="message" value={leadForm.message} onChange={(event) => setLeadForm((prev) => ({ ...prev, message: event.target.value }))} rows={6} className={`${inputClass} min-h-[160px] resize-y`} />
                </div>

                <div className="flex justify-start pt-1">
                  <button type="submit" className="rounded-full bg-[#020575] px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
                    Send enquiry
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-2">
          <a
            href="https://www.woodbournecarsales.co.uk/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#020575] px-8 py-4 text-base font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            <ArrowLeft className="h-5 w-5" /> Back to Woodbourne Car Sales
          </a>
        </div>
      </div>
    </div>
  )
}
