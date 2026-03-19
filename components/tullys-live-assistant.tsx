"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, ChevronRight, Compass, MapPin, Mic, Ticket, Trees, Volume2 } from "lucide-react"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

type QuickLink = {
  label: string
  href: string
  helper: string
  icon: any
  image: string
  glow: string
}

const QUICK_LINKS: QuickLink[] = [
  {
    label: "Tulip Fest",
    href: "https://www.tulipfarm.co.uk/",
    helper: "Spring tickets & festival details",
    icon: Trees,
    image: "https://www.tulleysfarm.com/images/layout/homepage-panels/homepage-panel-tulips.png",
    glow: "rgba(255, 143, 171, 0.28)",
  },
  {
    label: "Pumpkin Festival",
    href: "https://www.pumpkinfarm.co.uk/",
    helper: "Autumn family fun & pumpkins",
    icon: Ticket,
    image: "https://www.tulleysfarm.com/images/layout/homepage-panels/homepage-panel-pumpkin-festival.png",
    glow: "rgba(241, 130, 32, 0.32)",
  },
  {
    label: "Shocktober Fest",
    href: "https://www.shocktoberfest.co.uk/",
    helper: "Halloween scream park info",
    icon: CalendarDays,
    image: "https://www.tulleysfarm.com/images/layout/homepage-panels/homepage-panel-shocktober.png",
    glow: "rgba(25, 25, 25, 0.42)",
  },
  {
    label: "Pumpkin Nights",
    href: "https://www.pumpkinnights.co.uk/",
    helper: "Evening trail & lantern event",
    icon: CalendarDays,
    image: "https://www.tulleysfarm.com/images/layout/homepage-panels/homepage-panel-pumpkin-nights.png",
    glow: "rgba(88, 50, 131, 0.35)",
  },
  {
    label: "Christmas Light Festival",
    href: "https://www.christmaslightshow.co.uk/",
    helper: "Lights trail & winter evenings",
    icon: Trees,
    image: "https://www.tulleysfarm.com/images/layout/homepage-panels/homepage-panel-christmas-lights.png",
    glow: "rgba(33, 119, 98, 0.32)",
  },
  {
    label: "Christmas Experience",
    href: "https://www.tulleyschristmas.co.uk/",
    helper: "Daytime Christmas attraction",
    icon: Trees,
    image: "https://www.tulleysfarm.com/images/layout/homepage-panels/homepage-panel-christmas-experience.png",
    glow: "rgba(183, 41, 54, 0.3)",
  },
  {
    label: "Escape Rooms",
    href: "https://tulleysescape.com/",
    helper: "Year-round escape adventures",
    icon: Compass,
    image: "https://www.tulleysfarm.com/images/layout/homepage-panels/homepage-panel-escape.png",
    glow: "rgba(98, 144, 168, 0.3)",
  },
  {
    label: "Tea Room",
    href: "https://www.tulleysfarm.com/tea-room",
    helper: "Food, cakes & drinks",
    icon: Ticket,
    image: "https://www.tulleysfarm.com/images/layout/homepage-panels/homepage-panel-tearoom.png",
    glow: "rgba(157, 115, 74, 0.28)",
  },
  {
    label: "FAQs",
    href: "https://www.tulleysfarm.com/faqs",
    helper: "Common visitor questions",
    icon: CalendarDays,
    image: "https://www.tulleysfarm.com/uploads/Panels/panel_about-image%28992x709-crop-autorotate%29.png",
    glow: "rgba(92, 67, 44, 0.24)",
  },
  {
    label: "Contact & Find Us",
    href: "https://www.tulleysfarm.com/contact-us",
    helper: "Directions, address & contact info",
    icon: MapPin,
    image: "https://www.tulleysfarm.com/uploads/Panels/screenshot_2025_09_20_at_155907_1__1__-image%28992x652-crop-autorotate%29.png",
    glow: "rgba(74, 65, 52, 0.28)",
  },
]

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "system",
    content: "Hi — I’m George, your guide for Tulleys. Ask me about tickets, timings, food, directions, seasonal events, or what to do next.",
  },
]

const FIRST_RESPONSE_EVENT = {
  type: "response.create",
  response: {
    instructions:
      "Introduce yourself as George for Tulleys in upbeat, friendly British English. You help visitors before they arrive and while they are there. You can explain seasonal experiences, tickets, opening times, practical visitor information, food, escape rooms, and help people decide what to do next. Do not over-explain. Do not start by sending visitors away to links. Keep your opening helpful, concise, and natural, then warmly ask what you can help with today.",
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

export function TullysLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [statusText, setStatusText] = useState("Ready when you are")
  const [isModelSpeaking, setIsModelSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConversation, setShowConversation] = useState(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el && showConversation) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages, showConversation])

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
      const tokenResponse = await fetch("/api/tullys-session", { method: "GET", cache: "no-store" })
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
            message = answerText.slice(0, 220)
          }
        }
        throw new Error(message)
      }

      await pc.setRemoteDescription({ type: "answer", sdp: answerText })
    } catch (err) {
      await cleanupConversation()
      setConnectionState("error")
      setStatusText("Could not connect George")
      setError(err instanceof Error ? err.message : "Could not start live voice right now.")
    }
  }

  async function endConversation() {
    await cleanupConversation()
    setConnectionState("idle")
    setStatusText("Ready when you are")
    setMessages(INITIAL_MESSAGES)
    setError(null)
  }

  const latestVisibleMessage = [...messages].reverse().find((message) => message.role !== "system")

  return (
    <section className="relative overflow-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[28px] border border-[rgba(255,255,255,0.10)] bg-[rgba(12,9,21,0.72)] p-4 shadow-[0_28px_80px_rgba(7,4,16,0.45)] backdrop-blur-[2px] sm:p-5 lg:p-6">
          <div className="mx-auto max-w-5xl text-center">
            <div className="flex justify-center">
              <img
                src="/tulleys-brand-logo2.svg"
                alt="Tulleys Farm"
                className="h-auto w-[220px] max-w-full drop-shadow-[0_10px_30px_rgba(0,0,0,0.4)] sm:w-[260px] lg:w-[320px]"
              />
            </div>
            <h1
              className="mt-4 text-5xl uppercase tracking-[0.06em] text-[#F6E6C5] sm:text-6xl"
              style={{ fontFamily: "var(--font-bebas), Impact, sans-serif" }}
            >
              Meet George
            </h1>
            <p className="mx-auto mt-3 max-w-3xl text-lg leading-8 text-[#F4EADA] sm:text-xl">
              George helps before you arrive and while you&apos;re here — from tickets and seasonal experiences to food, timings and always knowing what to do next.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-[760px] text-center">
            <button
              type="button"
              aria-label={canStart ? "Start talking to George" : "End conversation with George"}
              onClick={canStart ? startConversation : endConversation}
              className={`group relative mx-auto block h-[250px] w-[250px] appearance-none overflow-hidden rounded-full border-0 bg-transparent shadow-none outline-none ring-0 transition duration-300 hover:scale-[1.015] focus:outline-none focus:ring-0 sm:h-[300px] sm:w-[300px] ${
                connectionState === "connected" || connectionState === "connecting"
                  ? "animate-[pulse_2.1s_ease-in-out_infinite] shadow-[0_0_0_8px_rgba(255,122,45,0.08),0_0_0_16px_rgba(64,129,255,0.06)]"
                  : ""
              }`}
              style={{ borderRadius: "9999px", WebkitAppearance: "none" }}
            >
              <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.22),transparent_28%),linear-gradient(145deg,rgba(255,114,73,0.22),rgba(48,90,255,0.18))]" />
              <span className="absolute inset-[10px] rounded-full border border-[rgba(255,255,255,0.14)] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),rgba(10,8,18,0.55)_58%,rgba(4,3,10,0.92)_100%)] backdrop-blur-sm" />
              <span className="absolute inset-[18px] overflow-hidden rounded-full border border-[rgba(255,255,255,0.08)] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),rgba(8,6,16,0.95)_72%)]">
                <img
                  src="/tulleys-seasons-button.png"
                  alt="Tulleys seasons guide button"
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="absolute inset-x-[14%] top-[6%] h-[18%] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0))] opacity-75 blur-[8px]" />

            </button>

            <div className="mt-5 min-h-[84px] px-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#EEDFC0]/80">
                {statusText}
              </p>
              <p className="mx-auto mt-2 max-w-2xl text-lg leading-8 text-[#FFF5E4] transition-opacity duration-500 animate-[fadeIn_400ms_ease] sm:text-xl">
                {error
                  ? error
                  : latestVisibleMessage?.content || "Helping you make the most of your experience — whatever season you’re visiting."}
              </p>
            </div>

            <div className="mt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowConversation((prev) => !prev)}
                className="inline-flex items-center gap-2 border border-[rgba(255,244,219,0.18)] bg-[rgba(255,248,237,0.06)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#F7EAD1] transition hover:bg-[rgba(255,248,237,0.1)] sm:text-sm"
                style={{ borderRadius: "9999px" }}
              >
                {isModelSpeaking ? <Volume2 className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {showConversation ? "Hide conversation" : "View conversation"}
              </button>
            </div>

            {showConversation ? (
              <div
                ref={scrollRef}
                className="mx-auto mt-5 max-h-[280px] max-w-3xl space-y-3 overflow-y-auto rounded-[24px] border border-[rgba(246,230,197,0.14)] bg-[rgba(9,6,16,0.68)] p-4 text-left"
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={message.role === "assistant"
                      ? "ml-auto max-w-[88%] rounded-[24px] border border-[rgba(246,230,197,0.18)] bg-[rgba(255,245,228,0.1)] px-4 py-3 text-base leading-7 text-[#FFF5E4]"
                      : message.role === "user"
                      ? "mr-auto max-w-[88%] rounded-[24px] border border-[rgba(246,230,197,0.1)] bg-[rgba(20,12,8,0.52)] px-4 py-3 text-base leading-6 text-[#E9DDC9]"
                      : "mx-auto max-w-[92%] rounded-[22px] border border-dashed border-[rgba(246,230,197,0.18)] bg-[rgba(248,241,226,0.05)] px-4 py-3 text-center text-base leading-6 text-[#F2E4CB]"}
                  >
                    {message.content}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mx-auto mt-8 max-w-6xl">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {QUICK_LINKS.map((link) => {
                const Icon = link.icon
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative overflow-hidden rounded-[26px] border border-[rgba(255,248,231,0.18)] p-[1px] transition hover:-translate-y-1"
                    style={{ boxShadow: `0 20px 42px ${link.glow}` }}
                  >
                    <div
                      className="relative flex min-h-[178px] flex-col justify-end overflow-hidden rounded-[25px] p-4 text-[#FFF6E7]"
                      style={{
                        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.16) 28%, rgba(16,10,7,0.8) 100%), url(${link.image})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.18)_40%,rgba(16,10,7,0.82))]" />
                      <div className="relative z-10 flex items-center justify-between gap-3">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(255,244,219,0.28)] bg-[rgba(19,11,7,0.45)] backdrop-blur-sm">
                          <Icon className="h-4 w-4" />
                        </div>
                        <ChevronRight className="h-5 w-5 opacity-80 transition group-hover:translate-x-1" />
                      </div>
                      <div className="relative z-10 mt-8">
                        <div className="text-2xl uppercase tracking-[0.06em] drop-shadow-[0_6px_20px_rgba(0,0,0,0.65)]" style={{ fontFamily: "var(--font-bebas), Impact, sans-serif" }}>
                          {link.label}
                        </div>
                        <p className="mt-1 text-base leading-5 text-[#FFF0D6] drop-shadow-[0_6px_20px_rgba(0,0,0,0.65)]">{link.helper}</p>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
