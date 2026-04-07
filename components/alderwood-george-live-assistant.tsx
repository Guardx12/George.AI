"use client"

import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import { ExternalLink, Fish, Loader2, MapPin, Mic, Phone, PhoneOff, Trees, Volume2 } from "lucide-react"
import { alderwoodSite } from "@/components/alderwood-site-data"

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
      "Hi — I’m George, the AI fishery assistant for Alderwood Ponds. Ask me about prices, fish sizes, rules, night fishing, cabins, camping, dogs, or directions.",
  },
]

const FIRST_RESPONSE_EVENT = {
  type: "response.create",
  response: {
    instructions:
      "Briefly introduce yourself as George, the AI fishery assistant for Alderwood Ponds, then ask in a warm natural way: 'What would you like help with today — prices, rules, fish sizes, night fishing, cabins, camping, or directions?'",
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

export function AlderwoodGeorgeLiveAssistant() {
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

  const canStart = useMemo(() => connectionState === "idle" || connectionState === "error", [connectionState])

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    }
  }, [messages, statusText])

  useEffect(() => {
    return () => {
      void cleanupConversation()
    }
  }, [])

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
      audioRef.current = audioEl
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams
        if (remoteStream && audioRef.current) {
          audioRef.current.srcObject = remoteStream
        }
      }

      const dc = pc.createDataChannel("oai-events")
      dcRef.current = dc

      dc.addEventListener("open", () => {
        setConnectionState("connected")
        setStatusText("George is listening")
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
            await cleanupConversation()
            break
          default:
            break
        }
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime?model=gpt-realtime", {
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
      await cleanupConversation()
      setConnectionState("error")
      setStatusText("Couldn’t connect")
      setError(err instanceof Error ? err.message : "Could not start George right now.")
    }
  }

  async function stopConversation() {
    await cleanupConversation()
    setConnectionState("idle")
    setStatusText("Ready when you are")
  }

  return (
    <main className="min-h-screen bg-[#08130f] text-[#f5f8f6]">
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0">
          <Image src="/alderwood/gallery/home-hero.webp" alt="Alderwood Ponds lake view" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,15,12,0.24)_0%,rgba(6,15,12,0.72)_52%,rgba(6,15,12,0.94)_100%)]" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
          <div className="max-w-2xl self-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-[#c9b58a]">Family-run coarse fishery in Steyning, West Sussex</p>
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">Alderwood Ponds</h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-[#dbe5df] sm:text-lg">
              Peaceful fishing lakes, cabins and camping in a beautiful countryside setting. George can help with prices,
              rules, fish sizes, cabins, camping, dogs, directions and the key things visitors usually ask before they come.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={`tel:${alderwoodSite.phone}`} className="inline-flex items-center gap-2 rounded-full bg-[#2D7357] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(17,58,42,0.34)] transition hover:bg-[#245c46]">
                <Phone className="h-4 w-4" />
                Call booking line
              </a>
              <a href={alderwoodSite.facebookUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[#c9b58a]/30 bg-black/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/30">
                <ExternalLink className="h-4 w-4" />
                Facebook updates
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-[#dbe5df]">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Opening times available below</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Cash on the bank</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Three waters on site</span>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,20,16,0.9)_0%,rgba(11,21,18,0.96)_100%)] shadow-[0_25px_70px_rgba(0,0,0,0.32)] backdrop-blur">
            <div className="border-b border-white/10 px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c9b58a]">Meet George</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Ask George about anything</h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-[#d6e6df]">Prices, rules, cabins, camping, fishing and more.</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-[#d6e6df]">{statusText}</div>
              </div>
            </div>

            <div ref={scrollRef} className="max-h-[420px] space-y-4 overflow-y-auto bg-[linear-gradient(180deg,rgba(11,21,18,0.38)_0%,rgba(8,16,13,0.24)_100%)] px-5 py-5 sm:px-6">
              {messages.map((message) => {
                const isAssistant = message.role !== "user"
                return (
                  <div
                    key={message.id}
                    className={`max-w-[88%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm sm:text-[15px] ${
                      isAssistant
                        ? "mr-auto border border-white/10 bg-[rgba(236,244,240,0.10)] text-[#F4F8F6]"
                        : "ml-auto bg-[#2A6A51] text-white"
                    }`}
                  >
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">{isAssistant ? "George" : "You"}</p>
                    <p>{message.content}</p>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-white/10 px-5 py-4 sm:px-6">
              <p className="mb-3 text-sm text-[#d6e6df]">Have a question? Ask George instantly.</p>
              <div className="flex flex-wrap items-center gap-3">
                {connectionState !== "connected" ? (
                  <button
                    onClick={startConversation}
                    disabled={!canStart}
                    className="inline-flex items-center gap-2 rounded-full bg-[#2D7357] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(23,68,52,0.34)] transition hover:bg-[#235844] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {connectionState === "connecting" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connecting George…
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4" />
                        Start talking to George
                      </>
                    )}
                  </button>
                ) : (
                  <button onClick={stopConversation} className="inline-flex items-center gap-2 rounded-full bg-[#101C18] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0B1512]">
                    <PhoneOff className="h-4 w-4" />
                    End conversation
                  </button>
                )}

                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-[#D6E6DF]">
                  <Volume2 className="h-4 w-4 text-[#8FD2B2]" />
                  Voice enabled
                </div>

                {isModelSpeaking ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-[#D6E6DF]">
                    <Loader2 className="h-4 w-4 animate-spin text-[#8FD2B2]" />
                    George is speaking
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-12 lg:grid-cols-4 lg:px-8">
        <article className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.16)]">
          <p className="text-xs uppercase tracking-[0.2em] text-[#c9b58a]">Opening times</p>
          <h3 className="mt-3 text-lg font-semibold text-white">{alderwoodSite.hours}</h3>
          <p className="mt-2 text-sm leading-6 text-[#c9d6cf]">Please check opening times before travelling.</p>
        </article>
        <article className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.16)]">
          <p className="text-xs uppercase tracking-[0.2em] text-[#c9b58a]">Address</p>
          <h3 className="mt-3 text-lg font-semibold text-white">{alderwoodSite.address}</h3>
          <p className="mt-2 text-sm leading-6 text-[#c9d6cf]">Steyning, West Sussex.</p>
        </article>
        <article className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.16)]">
          <p className="text-xs uppercase tracking-[0.2em] text-[#c9b58a]">Booking line</p>
          <h3 className="mt-3 text-lg font-semibold text-white">{alderwoodSite.phoneDisplay}</h3>
          <p className="mt-2 text-sm leading-6 text-[#c9d6cf]">Monday to Friday, 9am to 12 midday.</p>
        </article>
        <article className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.16)]">
          <p className="text-xs uppercase tracking-[0.2em] text-[#c9b58a]">Payment</p>
          <h3 className="mt-3 text-lg font-semibold text-white">{alderwoodSite.payment}</h3>
          <p className="mt-2 text-sm leading-6 text-[#c9d6cf]">Simple and clear on arrival.</p>
        </article>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,29,23,0.86)_0%,rgba(10,19,15,0.94)_100%)] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c9b58a]">What George knows</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-3 text-white"><Fish className="h-5 w-5 text-[#8fd2b2]" /><h3 className="font-semibold">Fishing details</h3></div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#d6e6df]">
                <li>Ticket prices for day fishing and night fishing.</li>
                <li>Fish sizes, waters on site and disabled access basics.</li>
                <li>Fishery rules, gear requirements and general angler info.</li>
              </ul>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-3 text-white"><Trees className="h-5 w-5 text-[#8fd2b2]" /><h3 className="font-semibold">Stay details</h3></div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#d6e6df]">
                <li>Cabins, camping, dog rules and key visitor details.</li>
                <li>Opening hours, payment information and how the fishery works.</li>
                <li>Recent reports and general site information.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,29,23,0.86)_0%,rgba(10,19,15,0.94)_100%)] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c9b58a]">Good things to ask</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#d6e6df]">
              <li>What are the day ticket prices?</li>
              <li>Can I night fish and how much does it cost?</li>
              <li>What rules do I need to know before I come?</li>
              <li>Are dogs allowed and what are the dog rules?</li>
              <li>Tell me about the cabins and camping.</li>
              <li>What fish are in the lakes and how big do they grow?</li>
            </ul>
          </div>

          <div className="rounded-[30px] border border-[#c9b58a]/20 bg-[linear-gradient(180deg,rgba(36,58,46,0.9)_0%,rgba(20,34,27,0.96)_100%)] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <div className="flex items-center gap-3 text-white"><MapPin className="h-5 w-5 text-[#c9b58a]" /><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#c9b58a]">Need to book or confirm details?</p></div>
            <p className="mt-3 text-sm leading-6 text-[#d6e6df]">
              George can explain the website information, but for bookings and direct enquiries the site still points
              visitors to the booking line on {alderwoodSite.phoneDisplay}, Monday to Friday, 9am to 12 midday.
            </p>
          </div>

          {error ? (
            <div className="rounded-[24px] border border-[#E7C7B6] bg-[#FFF7F2] p-4 text-sm text-[#7A3B1C]">
              <p className="font-semibold">George couldn’t connect just now.</p>
              <p className="mt-1">{error}</p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
