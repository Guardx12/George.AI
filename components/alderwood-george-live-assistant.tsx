"use client"

import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Loader2, Mic, PhoneOff } from "lucide-react"

const BACK_TO_SITE_URL = "https://alderwoodponds.fish"
const RETAINED_RATE = 0.4

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

type AlderwoodStats = {
  total: number
  minutes: number
}

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "system",
    content:
      "Hi — I’m George, the AI fishery assistant for Alderwood Ponds. Ask me about prices, rules, cabins, camping, fishing, or anything else on the site.",
  },
]

const FIRST_RESPONSE_EVENT = {
  type: "response.create",
  response: {
    instructions:
      "Briefly introduce yourself as George for Alderwood Ponds, then warmly invite the visitor to ask about prices, rules, cabins, camping, fishing, or anything else.",
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

function formatHours(totalMinutes: number) {
  return (totalMinutes / 60).toFixed(1)
}

function formatRetained(totalVisitors: number) {
  return Math.round(totalVisitors * RETAINED_RATE)
}

export function AlderwoodGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [statusText, setStatusText] = useState("Ready when you are")
  const [isModelSpeaking, setIsModelSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<AlderwoodStats>({ total: 0, minutes: 0 })

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const sessionStartedAtRef = useRef<number | null>(null)
  const usageLoggedRef = useRef(false)
  const connectionTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  const canStart = useMemo(() => connectionState === "idle" || connectionState === "error", [connectionState])

  const latestAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" || message.role === "system")?.content ??
    "Tap the circle and start speaking to George."

  useEffect(() => {
    void refreshStats()
    const interval = window.setInterval(() => {
      void refreshStats()
    }, 10000)

    return () => {
      window.clearInterval(interval)
      void cleanupConversation(false)
    }
  }, [])

  async function refreshStats() {
    try {
      const response = await fetch("/api/alderwood-stats", { cache: "no-store" })
      if (!response.ok) return
      const data = (await response.json()) as Partial<AlderwoodStats>
      setStats({
        total: Number(data?.total || 0),
        minutes: Number(data?.minutes || 0),
      })
    } catch (err) {
      console.error("Could not refresh Alderwood stats", err)
    }
  }

  async function logUsageIfNeeded() {
    if (usageLoggedRef.current || sessionStartedAtRef.current === null) return

    const elapsedMs = Date.now() - sessionStartedAtRef.current
    const minutes = Math.max(1, Math.round(elapsedMs / 60000))
    usageLoggedRef.current = true

    try {
      await fetch("/api/alderwood-usage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({ minutes }),
        cache: "no-store",
        keepalive: true,
      })

      setStats((existing) => ({
        total: existing.total + 1,
        minutes: existing.minutes + minutes,
      }))

      window.setTimeout(() => {
        void refreshStats()
      }, 1500)
    } catch (err) {
      console.error("Could not log Alderwood usage", err)
      usageLoggedRef.current = false
    }
  }

  async function cleanupConversation(logUsage = true) {
    if (logUsage) {
      await logUsageIfNeeded()
    }

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

    if (connectionTimeoutRef.current) {
      window.clearTimeout(connectionTimeoutRef.current)
      connectionTimeoutRef.current = null
    }

    currentAssistantTextRef.current = ""
    currentAssistantMessageIdRef.current = null
    setIsModelSpeaking(false)
    sessionStartedAtRef.current = null
  }

  function appendAssistantDelta(delta: string) {
    currentAssistantTextRef.current += delta
    const currentId = currentAssistantMessageIdRef.current ?? makeMessage("assistant", "").id
    currentAssistantMessageIdRef.current = currentId

    setMessages((existing) => {
      const next = [...existing]
      const index = next.findIndex((message) => message.id === currentId)
      if (index === -1) {
        next.push({ id: currentId, role: "assistant", content: currentAssistantTextRef.current })
      } else {
        next[index] = { ...next[index], content: currentAssistantTextRef.current }
      }
      return next
    })
  }

  async function startConversation() {
    if (!canStart) return

    setError(null)
    setConnectionState("connecting")
    setStatusText("Connecting to George…")
    usageLoggedRef.current = false
    sessionStartedAtRef.current = null

    if (connectionTimeoutRef.current) window.clearTimeout(connectionTimeoutRef.current)
    connectionTimeoutRef.current = window.setTimeout(async () => {
      if (dcRef.current?.readyState !== "open") {
        await cleanupConversation(false)
        setConnectionState("error")
        setStatusText("Couldn’t connect")
        setError("George took too long to connect. Please tap again.")
      }
    }, 20000)

    try {
      const tokenResponse = await fetch("/api/alderwood-session", { cache: "no-store" })
      const tokenData = await tokenResponse.json().catch(() => null)

      if (!tokenResponse.ok || !tokenData?.value) {
        throw new Error(tokenData?.error || "Could not start George right now.")
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      const pc = new RTCPeerConnection()
      pcRef.current = pc
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      const audioEl = document.createElement("audio")
      audioEl.autoplay = true
      audioEl.playsInline = true
      audioEl.style.display = "none"
      document.body.appendChild(audioEl)
      audioRef.current = audioEl

      pc.ontrack = async (event) => {
        const [remoteStream] = event.streams
        if (remoteStream && audioRef.current) {
          audioRef.current.srcObject = remoteStream
          try {
            await audioRef.current.play()
          } catch (playError) {
            console.error("Could not autoplay Alderwood audio", playError)
          }
        }
      }

      const dc = pc.createDataChannel("oai-events")
      dcRef.current = dc

      dc.addEventListener("open", () => {
        if (connectionTimeoutRef.current) {
          window.clearTimeout(connectionTimeoutRef.current)
          connectionTimeoutRef.current = null
        }
        setConnectionState("connected")
        setStatusText("George is listening")
        sessionStartedAtRef.current = Date.now()
        dc.send(JSON.stringify(FIRST_RESPONSE_EVENT))
      })

      dc.addEventListener("message", async (event) => {
        const payload = JSON.parse(event.data)

        switch (payload.type) {
          case "input_audio_buffer.speech_started":
            setStatusText("Listening…")
            break
          case "input_audio_buffer.speech_stopped":
            setStatusText("Thinking…")
            break
          case "response.output_audio_transcript.delta":
          case "response.output_text.delta":
          case "response.audio_transcript.delta":
          case "response.text.delta":
            if (payload.delta) appendAssistantDelta(payload.delta)
            break
          case "response.output_item.added":
            if (payload.item?.role === "assistant") {
              currentAssistantTextRef.current = ""
              currentAssistantMessageIdRef.current = makeMessage("assistant", "").id
              setIsModelSpeaking(true)
            }
            break
          case "conversation.item.input_audio_transcription.completed":
            if (payload.transcript?.trim()) {
              setMessages((existing) => [...existing, makeMessage("user", payload.transcript.trim())])
            }
            break
          case "response.done":
            setIsModelSpeaking(false)
            setStatusText("George is listening")
            currentAssistantTextRef.current = ""
            currentAssistantMessageIdRef.current = null
            break
          case "error":
            console.error("Realtime event error", payload)
            setError(payload.error?.message ?? "Something went wrong with the live connection.")
            setConnectionState("error")
            setStatusText("Connection problem")
            await cleanupConversation(true)
            break
          default:
            break
        }
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${tokenData.value}`,
          "Content-Type": "application/sdp",
        },
      })

      if (!sdpResponse.ok) {
        const details = await sdpResponse.text().catch(() => "")
        throw new Error(details || "Could not complete the live voice connection.")
      }

      await pc.setRemoteDescription({ type: "answer", sdp: await sdpResponse.text() })
    } catch (err) {
      console.error(err)
      await cleanupConversation(false)
      setConnectionState("error")
      setStatusText("Couldn’t connect")
      setError(err instanceof Error ? err.message : "Could not start George right now.")
    }
  }

  async function stopConversation() {
    await cleanupConversation(true)
    setConnectionState("idle")
    setStatusText("Ready when you are")
  }

  return (
    <main className="min-h-screen bg-[#08130f] text-[#f5f8f6]">
      <section className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/alderwood/gallery/home-hero.webp" alt="Alderwood Ponds lake view" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,15,12,0.22)_0%,rgba(6,15,12,0.68)_42%,rgba(6,15,12,0.92)_100%)]" />
        </div>

        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-6 py-14 text-center sm:px-8 lg:px-10">
          <div className="max-w-4xl">
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              Ask George about anything at Alderwood Ponds.
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-[#e1ebe5] sm:text-lg lg:text-xl">
              Prices, rules, cabins, camping, fishing, and more.
            </p>
          </div>

          <div className="mt-10 flex w-full max-w-5xl flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-center lg:gap-8">
            <div className="w-full max-w-[320px] rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,rgba(10,22,18,0.84)_0%,rgba(7,15,12,0.92)_100%)] p-4 text-left shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur lg:self-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#c9b58a]">George live impact</p>
              <div className="mt-2.5 space-y-2.5 text-[13px] text-[#e6efea] sm:text-sm">
                <div>
                  <p className="text-[22px] font-semibold leading-none text-white sm:text-[26px]">{stats.total}</p>
                  <p className="mt-1 leading-5">visitors helped — instead of leaving</p>
                </div>
                <div>
                  <p className="text-[22px] font-semibold leading-none text-white sm:text-[26px]">{stats.minutes}</p>
                  <p className="mt-1 leading-5">minutes saved from answering questions and calls</p>
                </div>
                <div>
                  <p className="text-[22px] font-semibold leading-none text-white sm:text-[26px]">≈ {formatHours(stats.minutes)}</p>
                  <p className="mt-1 leading-5">hours of support delivered</p>
                </div>
                <div>
                  <p className="text-[22px] font-semibold leading-none text-white sm:text-[26px]">+ {formatRetained(stats.total)}</p>
                  <p className="mt-1 leading-5">
                    extra visitors who would have otherwise left <span className="text-[#bdd1c7]">(estimated)</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex w-full max-w-3xl flex-col items-center">
              <button
                type="button"
                onClick={connectionState === "connected" ? stopConversation : startConversation}
                disabled={connectionState === "connecting"}
                aria-label={connectionState === "connected" ? "Stop talking to George" : "Start talking to George"}
                className={`group relative flex h-[220px] w-[220px] items-center justify-center rounded-full transition duration-300 ease-out sm:h-[270px] sm:w-[270px] ${
                  connectionState === "connecting" ? "cursor-wait" : "hover:scale-[1.02]"
                } ${
                  connectionState === "connected" || connectionState === "connecting"
                    ? "animate-[pulse_2s_ease-in-out_infinite]"
                    : "animate-[pulse_4s_ease-in-out_infinite]"
                }`}
                style={{
                  background:
                    "radial-gradient(circle at 30% 25%, #4f8d73 0%, #2D7357 26%, #16362b 60%, #08130f 100%)",
                  boxShadow:
                    connectionState === "connected" || connectionState === "connecting"
                      ? "0 0 0 10px rgba(45,115,87,0.12), 0 28px 60px rgba(0,0,0,0.36), inset 0 3px 18px rgba(255,255,255,0.20), inset 0 -14px 28px rgba(2,8,6,0.55)"
                      : "0 24px 54px rgba(0,0,0,0.28), inset 0 3px 18px rgba(255,255,255,0.18), inset 0 -14px 28px rgba(2,8,6,0.52)",
                }}
              >
                <span className="pointer-events-none absolute inset-[8px] rounded-full border border-white/15" />
                <span className="pointer-events-none absolute left-[12%] top-[10%] h-[22%] w-[52%] rounded-full bg-white/22 blur-[10px]" />
                <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0)_45%,rgba(255,255,255,0.13)_75%,rgba(255,255,255,0.2)_100%)]" />

                <div className="relative z-10 flex h-[80%] w-[80%] items-center justify-center rounded-full">
                  {connectionState === "connecting" ? (
                    <Loader2 className="h-16 w-16 animate-spin text-white sm:h-20 sm:w-20" />
                  ) : connectionState === "connected" ? (
                    <PhoneOff className="h-16 w-16 text-white sm:h-20 sm:w-20" />
                  ) : (
                    <Mic className="h-16 w-16 text-white sm:h-20 sm:w-20" />
                  )}
                </div>

                <span className="sr-only">{connectionState === "connected" ? "George is live" : "Start talking to George"}</span>
              </button>

              <div className="mt-8 w-full max-w-2xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,21,18,0.78)_0%,rgba(8,16,13,0.9)_100%)] px-6 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.24)] backdrop-blur">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c9b58a]">
                  {connectionState === "connected"
                    ? isModelSpeaking
                      ? "George is talking"
                      : "George is live"
                    : connectionState === "connecting"
                      ? "Connecting George"
                      : "Tap the circle to speak to George"}
                </p>
                <p className="mt-3 text-base leading-7 text-[#e1ebe5] sm:text-lg">{latestAssistantMessage}</p>
                <p className="mt-3 text-sm text-[#bdd1c7]">{statusText}</p>
                {error ? <p className="mt-3 text-sm font-medium text-[#ffd4c4]">{error}</p> : null}
              </div>

              <a
                href={BACK_TO_SITE_URL}
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#c9b58a]/35 bg-[rgba(6,15,12,0.45)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[rgba(6,15,12,0.62)]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Alderwood Ponds
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
