"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, Loader2, MessageSquareText, Mic } from "lucide-react"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

type QuickLink = {
  label: string
  href: string
  prompt: string
  description: string
}

const STORAGE_KEY = "placesforpeople-george-session-v2"

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "system",
    content:
      "Hi — I'm George for Steyning Leisure Centre. I can help you choose the right membership, check the live timetable, answer centre questions, and guide you through joining step by step.",
  },
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
        .replace(/^(it'?s|its|i am|i'm|im|my name is|name'?s|this is)\s+/i, "")
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
    ? `Introduce yourself as George for Steyning Leisure Centre in warm, natural British English. This visitor has an ongoing conversation with you on this device, so welcome them back briefly and continue naturally instead of restarting. ${visitorName ? `Their name is ${visitorName}. Use it lightly.` : ""} ${lastUserMessage ? `The last thing they said was: ${lastUserMessage}` : ""} Keep it short and helpful. Ask one short question about what they want help with next.`
    : "Introduce yourself as George for Steyning Leisure Centre in warm, natural British English. Keep it short, welcoming and practical. Make it clear you can recommend memberships, check the live timetable, answer centre questions, and guide people through joining step by step. Ask one short question about what they want help with first."

  return {
    type: "response.create",
    response: { instructions },
  }
}

const quickLinks: QuickLink[] = [
  { label: "Join now", href: "https://placesleisure.gladstonego.cloud/memberships?siteId=7", prompt: "Help me join", description: "Direct Steyning memberships" },
  { label: "View timetable", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/swimming-lessons/#timetable", prompt: "What is on today? Use the swimming timetable link for swim bookings, classes, kids sessions and tours.", description: "Live classes, swimming, kids sessions and tours" },
  { label: "Swimming & Lessons", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/swimming-lessons/#timetable", prompt: "Show me swimming and lessons", description: "Swimming, lessons, classes, kids sessions and tours" },
  { label: "Fitness & Health", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/fitness-health/", prompt: "Show me gym and fitness", description: "Gym, classes, PT, support and junior fitness" },
  { label: "Sports", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/sports/#timetable", prompt: "Show me sports", description: "Badminton, basketball, table tennis and squash bookings" },
  { label: "Family & Kids", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/family-kids/", prompt: "Show me family activities", description: "Active Reality, parties and family activities" },
  { label: "More", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/more/", prompt: "Show me more centre activities", description: "Travel, parking, facility hire and shop" },
  { label: "Centre info", href: "https://www.placesleisure.org/centres/steyning-leisure-centrex/", prompt: "Show me centre information", description: "Opening times, facilities and accessibility" },
  { label: "Contact us", href: "https://www.placesleisure.org/contact-us/", prompt: "How do I contact the centre?", description: "Centre contact and support options" },
]

function getQuickLinkAnchorText(link: QuickLink) {
  switch (link.label) {
    case "Join now":
      return "join here"
    case "View timetable":
      return "view the timetable here"
    case "Sports":
      return "book here"
    case "Swimming & Lessons":
      return "book swimming here"
    case "Family & Kids":
      return "find out more here"
    default:
      return "find out more here"
  }
}

function applyQuickLinkToTranscript(text: string, link: QuickLink | null) {
  if (!link) return text
  const anchorText = getQuickLinkAnchorText(link)
  const escapedAnchor = anchorText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const patterns = [
    new RegExp(`\\b${escapedAnchor}\\b`, "i"),
    /\bclick here\b/i,
    /\bhere\b/i,
  ]

  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return text.replace(pattern, `[${anchorText}](${link.href})`)
    }
  }

  return `${text} [${anchorText}](${link.href})`
}


function splitTextWithUrls(text: string) {
  let autoLinkedText = text

  const phraseLinks: Array<[RegExp, string]> = [
    [/\bjoin here\b/gi, "https://placesleisure.gladstonego.cloud/memberships?siteId=7"],
    [/\bview the timetable here\b/gi, "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/swimming-lessons/#timetable"],
    [/\bbook swimming here\b/gi, "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/swimming-lessons/#timetable"],
    [/\bbook a swim here\b/gi, "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/swimming-lessons/#timetable"],
    [/\bbook your swim here\b/gi, "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/swimming-lessons/#timetable"],
    [/\bbook a swim session here\b/gi, "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/swimming-lessons/#timetable"],
    [/\bbook swimming lessons here\b/gi, "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/swimming-lessons/#timetable"],
    [/\bbook swim classes here\b/gi, "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/swimming-lessons/#timetable"],
    [/\bbook kids sessions here\b/gi, "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/swimming-lessons/#timetable"],
    [/\bbook a tour here\b/gi, "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/swimming-lessons/#timetable"],
    [/\bbook active reality here\b/gi, "https://ecom.roller.app/activerealitysteyning/checkout/en/home"],
    [/\bdownload the party booking form here\b/gi, "https://www.placesleisure.org/media/gaxhgqlv/new-party-booking-form.pdf"],
    [/\bbook a kids'? party here\b/gi, "https://www.placesleisure.org/media/gaxhgqlv/new-party-booking-form.pdf"],
    [/\bbook a party here\b/gi, "https://www.placesleisure.org/media/gaxhgqlv/new-party-booking-form.pdf"],
    [/\bparty booking form here\b/gi, "https://www.placesleisure.org/media/gaxhgqlv/new-party-booking-form.pdf"],
    [/\bbook here\b/gi, "https://www.placesleisure.org/centres/steyning-leisure-centrex/centre-activities/sports/#timetable"],
    [/\bfind out more here\b/gi, "https://www.placesleisure.org/centres/steyning-leisure-centrex/"],
  ]

  for (const [pattern, href] of phraseLinks) {
    autoLinkedText = autoLinkedText.replace(pattern, (match) => `[${match}](${href})`)
  }

  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
  const parts: Array<{ value: string; href?: string; isLink: boolean }> = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = linkRegex.exec(autoLinkedText)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ value: autoLinkedText.slice(lastIndex, match.index), isLink: false })
    }
    parts.push({ value: match[1], href: match[2], isLink: true })
    lastIndex = linkRegex.lastIndex
  }

  if (lastIndex < autoLinkedText.length) {
    parts.push({ value: autoLinkedText.slice(lastIndex), isLink: false })
  }

  return parts.filter((part) => part.value)
}

export function PlacesForPeopleGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [hasStoredSession, setHasStoredSession] = useState(false)
  const [visitorName, setVisitorName] = useState<string | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const pendingQuickLinkRef = useRef<QuickLink | null>(null)
  const activeQuickLinkRef = useRef<QuickLink | null>(null)

  const canStart = useMemo(() => connectionState === "idle" || connectionState === "error", [connectionState])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const stored = JSON.parse(raw) as StoredSession
      if (Array.isArray(stored?.messages) && stored.messages.length > 1) {
        setMessages(stored.messages)
        setHasStoredSession(true)
        setVisitorName(stored.visitorName || detectVisitorName(stored.messages))
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
  }

  function clearSavedSession() {
    void cleanupConversation()
    setMessages(INITIAL_MESSAGES)
    setVisitorName(null)
    setHasStoredSession(false)
    setError(null)
    setConnectionState("idle")
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  function appendOrUpdateAssistantPartial(delta: string, isFinal = false) {
    if (!delta) return

    const applyFinalFormatting = (text: string) =>
      isFinal ? applyQuickLinkToTranscript(text, activeQuickLinkRef.current) : text

    if (!currentAssistantMessageIdRef.current) {
      const finalContent = applyFinalFormatting(delta)
      const message = makeMessage("assistant", finalContent)
      currentAssistantMessageIdRef.current = message.id
      currentAssistantTextRef.current = finalContent
      setMessages((prev) => [...prev, message])
      if (isFinal) {
        currentAssistantMessageIdRef.current = null
        currentAssistantTextRef.current = ""
        activeQuickLinkRef.current = null
      }
      return
    }

    currentAssistantTextRef.current += delta
    if (isFinal) {
      currentAssistantTextRef.current = applyQuickLinkToTranscript(currentAssistantTextRef.current, activeQuickLinkRef.current)
    }
    const targetId = currentAssistantMessageIdRef.current
    setMessages((prev) => prev.map((message) => (message.id === targetId ? { ...message, content: currentAssistantTextRef.current } : message)))

    if (isFinal) {
      currentAssistantMessageIdRef.current = null
      currentAssistantTextRef.current = ""
      activeQuickLinkRef.current = null
    }
  }

  function addUserTranscript(text: string) {
    const cleaned = text.trim()
    if (!cleaned) return
    setMessages((prev) => [...prev, makeMessage("user", cleaned)])
  }

  function sendQuickLinkPrompt(link: QuickLink) {
    const channel = dcRef.current
    if (!channel || channel.readyState !== "open") return false

    const userPrompt = `${link.prompt}. Say only the visible clickable phrase and never the hidden destination behind it. Do not say any URL, site ID, parameter, domain, or web address. After the clickable phrase, add one short practical sentence explaining what to do when they land on that page. Then end naturally with a short line like "If you need anything else, just ask."`
    setMessages((prev) => [...prev, makeMessage("user", link.label)])

    channel.send(JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: userPrompt }],
      },
    }))

    channel.send(JSON.stringify({
      type: "response.create",
      response: {
        instructions: `Reply as George for Steyning Leisure Centre. Be warm, natural and action-focused. Say only the visible clickable phrase and never the hidden destination behind it. Do not say, read out, display, or hint at any URL, domain, web address, site ID, query string, or parameter. After the clickable phrase, add one short practical sentence explaining what to do when they land on that page. Finish with a short helpful follow-up.`,
      },
    }))

    return true
  }

  async function handleQuickLink(link: QuickLink) {
    pendingQuickLinkRef.current = link

    if (connectionState === "connected") {
      if (sendQuickLinkPrompt(link)) return
      return
    }

    if (connectionState === "idle" || connectionState === "error") {
      await startConversation()
    }
  }

  function handleRealtimeEvent(event: any) {
    const type = event?.type
    if (!type) return

    switch (type) {
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
        } else {
          void cleanupConversation()
          setConnectionState("error")
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
    setMessages((prev) => (hasStoredSession && prev.length > 1 ? prev : INITIAL_MESSAGES))

    try {
      const tokenResponse = await fetch("/api/placesforpeople-session", {
        method: "GET",
        cache: "no-store",
      })

      const tokenData = await tokenResponse.json().catch(() => null)
      if (!tokenResponse.ok) {
        throw new Error(typeof tokenData?.error === "string" ? tokenData.error : "Could not create a secure live session.")
      }

      const ephemeralKey = tokenData?.value
      if (typeof ephemeralKey !== "string" || !ephemeralKey) throw new Error("Live voice token was missing.")

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
        const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? null
        const event = buildFirstResponseEvent(visitorName, hasStoredSession && messages.length > 1, lastUserMessage)
        window.setTimeout(() => {
          dataChannel.send(JSON.stringify(event))
        }, 150)

        window.setTimeout(() => {
          if (pendingQuickLinkRef.current) {
            const pending = pendingQuickLinkRef.current
            if (sendQuickLinkPrompt(pending)) pendingQuickLinkRef.current = null
          }
        }, 900)
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
          if (typeof parsed?.error?.message === "string") message = parsed.error.message
        } catch {
          if (answer.trim()) message = answer.trim()
        }
        throw new Error(message)
      }

      await pc.setRemoteDescription({ type: "answer", sdp: answer })
      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") {
          setConnectionState("error")
        }
      })
    } catch (err) {
      await cleanupConversation()
      setConnectionState("error")
      setError(err instanceof Error ? err.message : "Could not connect George right now.")
    }
  }

  async function stopConversation() {
    await cleanupConversation()
    setError(null)
    setConnectionState("idle")
  }

  const teaserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" || message.role === "user")
  const teaserLabel = teaserMessage?.role === "user" ? "You" : "George"
  const teaserText = teaserMessage?.content || INITIAL_MESSAGES[0].content

  return (
    <section className="py-8 text-center sm:py-10">
      <div className="mx-auto max-w-[760px]">
        <button
          type="button"
          onClick={connectionState === "connected" ? stopConversation : startConversation}
          disabled={connectionState === "connecting"}
          aria-label={connectionState === "connected" ? "End conversation with George" : "Talk to George"}
          className={`group relative mx-auto flex h-[112px] w-[112px] items-center justify-center rounded-full transition duration-300 sm:h-[128px] sm:w-[128px] ${
            connectionState === "connecting" ? "cursor-wait" : "hover:scale-[1.02]"
          } ${connectionState === "connected" || connectionState === "connecting" ? "animate-[pulse_2.2s_ease-in-out_infinite]" : ""}`}
          style={{
            background: "radial-gradient(circle at 30% 28%, #6c7580 0%, #59616b 48%, #414951 100%)",
            boxShadow:
              connectionState === "connected" || connectionState === "connecting"
                ? "0 0 0 4px rgba(244,124,0,0.22), 0 0 0 10px rgba(244,124,0,0.09), 0 16px 28px rgba(57,69,83,0.20), inset 0 8px 16px rgba(255,255,255,0.16), inset 0 -8px 16px rgba(0,0,0,0.16)"
                : "0 0 0 4px rgba(244,124,0,0.82), 0 14px 24px rgba(57,69,83,0.14), inset 0 8px 16px rgba(255,255,255,0.16), inset 0 -8px 16px rgba(0,0,0,0.16)",
          }}
        >
          <span className="absolute inset-[10px] rounded-full border border-white/15" />
          <span className="absolute inset-x-[24%] top-[14%] h-5 rounded-full bg-white/10 blur-md" />
          <div className="relative z-10 flex items-center justify-center text-white">
            {connectionState === "connecting" ? <Loader2 className="h-8 w-8 animate-spin sm:h-9 sm:w-9" /> : <Mic className="h-8 w-8 sm:h-9 sm:w-9" />}
          </div>
        </button>

        <h2 className="mt-6 text-[28px] font-black tracking-tight text-[#394553] sm:text-[34px]">Talk to George</h2>
        <p className="mx-auto mt-3 max-w-[680px] text-[16px] leading-8 text-[#394553] sm:text-[18px]">
          George can recommend the right membership, check the live timetable, answer any questions, and help you get signed up.
        </p>

        <div className="mx-auto mt-5 max-w-[560px] rounded-[20px] border border-[#d8dde3] bg-white px-4 py-3 text-left shadow-[0_12px_28px_rgba(57,69,83,0.08)] sm:px-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#f47c00]/10 text-[#f47c00]">
              <MessageSquareText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#f47c00]">{teaserLabel}</p>
              <div className="mt-1 text-[14px] leading-6 text-[#394553] sm:text-[15px]">
                {splitTextWithUrls(teaserText).map((part, index) => (
                  <Fragment key={`${part.value}-${index}`}>
                    {part.isLink && part.href ? (
                      <a
                        href={part.href}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all font-semibold text-[#f47c00] underline underline-offset-2"
                      >
                        {part.value}
                      </a>
                    ) : (
                      part.value
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {quickLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-[#cfd5dc] bg-white px-4 py-2 text-sm font-semibold text-[#394553] transition hover:border-[#f47c00] hover:text-[#f47c00]"
            >
              {link.label}
            </a>
          ))}
        </div>


        {error ? <p className="mt-5 text-sm font-medium text-[#b42318]">{error}</p> : null}
      </div>
    </section>
  )

}
