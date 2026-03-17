"use client"

        import { useMemo, useRef, useState } from "react"
        import { ArrowLeft, Loader2, Mic, PhoneOff, Radio, Ticket, Trees, UtensilsCrossed, CalendarDays, BadgeHelp, BedDouble, Sparkles, Volume2, MapPinned } from "lucide-react"

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
              "Hi — I’m George, your friendly Fishers Farm Park website assistant. Ask me about tickets, opening times, attractions, food, annual passes, cottages, pods, accessibility, or the best next step on the Fishers website.",
          },
        ]

        const FIRST_RESPONSE_EVENT = {
          type: "response.create",
          response: {
            instructions:
              "Briefly introduce yourself as George for Fishers Farm Park, then ask warmly what the visitor would like help with today.",
          },
        }

        const QUICK_LINKS = [
          { label: "Buy Tickets", href: "https://fishersfarmpark.visihost.co.uk/", icon: Ticket },
          { label: "Annual Pass", href: "https://www.fishersfarmpark.co.uk/annual-pass", icon: Ticket },
          { label: "Plan Your Visit", href: "https://www.fishersfarmpark.co.uk/plan-your-visit", icon: MapPinned },
          { label: "What's On", href: "https://www.fishersfarmpark.co.uk/events", icon: CalendarDays },
          { label: "Holiday Cottages", href: "https://www.fishersfarmpark.co.uk/holiday-cottages", icon: BedDouble },
          { label: "Luxury Pods", href: "https://www.fishersfarmpark.co.uk/holiday-pods", icon: Trees },
          { label: "Food & Drink", href: "https://www.fishersfarmpark.co.uk/food", icon: UtensilsCrossed },
          { label: "FAQs", href: "https://www.fishersfarmpark.co.uk/faq", icon: BadgeHelp },
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
                  .join("
")
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
            <section className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-10">
              <div className="space-y-6">
                <div className="overflow-hidden rounded-[34px] border border-[#d5eac3] bg-[linear-gradient(135deg,rgba(246,255,236,0.98)_0%,rgba(223,248,214,0.96)_42%,rgba(255,248,196,0.96)_100%)] shadow-[0_28px_80px_rgba(77,124,15,0.12)]">
                  <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-10">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-[#86b93b]/30 bg-white/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.34em] text-[#4d7c0f] shadow-sm sm:text-xs">
                        <Sparkles className="h-4 w-4" /> Fishers Farm Park Assistant
                      </div>
                      <h1 className="mt-5 text-4xl font-black tracking-tight text-[#355e12] sm:text-5xl lg:text-6xl">
                        Meet George for Fishers Farm Park.
                      </h1>
                      <p className="mt-5 max-w-3xl text-base leading-8 text-[#3f4d2f] sm:text-lg">
                        A friendly website assistant for Fishers visitors. George helps with tickets, opening times, attractions, food, annual passes, cottages, pods, accessibility, and where to go next on the Fishers website.
                      </p>
                      <p className="mt-4 max-w-3xl text-sm leading-7 text-[#587043] sm:text-base">
                        This version is set up to pull fresh information from the live Fishers website whenever a new George conversation starts, so updates on the site can flow through into what George says.
                      </p>
                    </div>

                    <div className="rounded-[28px] border border-white/80 bg-white/70 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_18px_44px_rgba(132,148,53,0.12)] backdrop-blur">
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#d97706]">Quick help</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <div className="rounded-2xl border border-[#f7d76d]/60 bg-[#fff8d6] px-4 py-3 text-sm text-[#6b4f00]">Tickets & annual passes</div>
                        <div className="rounded-2xl border border-[#cae7b4] bg-[#f6fff0] px-4 py-3 text-sm text-[#355e12]">Opening times & planning your visit</div>
                        <div className="rounded-2xl border border-[#cae7b4] bg-[#f6fff0] px-4 py-3 text-sm text-[#355e12]">Attractions, food & seasonal events</div>
                        <div className="rounded-2xl border border-[#cae7b4] bg-[#f6fff0] px-4 py-3 text-sm text-[#355e12]">Holiday cottages & luxury pods</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[34px] border border-[#dce9c9] bg-white/90 shadow-[0_30px_90px_rgba(120,130,70,0.12)] backdrop-blur">
                  <div className="flex flex-wrap items-center gap-3 border-b border-[#e8f0db] bg-[linear-gradient(180deg,#fcfff8_0%,#f4faea_100%)] px-5 py-4 sm:px-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8ec63f,#f4d35e)] text-lg font-black text-[#24420b] shadow-[0_12px_24px_rgba(142,198,63,0.22)]">
                      G
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-[#28461a] sm:text-lg">George</p>
                      <p className="text-sm text-[#5b6b49]">Friendly Fishers Farm Park website assistant</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium sm:text-sm ${
                        connectionState === "connected"
                          ? "border-[#86b93b]/30 bg-[#f1fae6] text-[#4d7c0f]"
                          : connectionState === "connecting"
                            ? "border-[#f2c14e]/40 bg-[#fff8dc] text-[#9a6700]"
                            : connectionState === "error"
                              ? "border-[#f1b5b5]/50 bg-[#fff1f1] text-[#b3261e]"
                              : "border-[#dbe8c9] bg-[#f8fbf4] text-[#5b6b49]"
                      }`}
                    >
                      {connectionState === "connected" ? <Volume2 className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
                      <span>{isModelSpeaking ? "George is talking" : statusText}</span>
                    </span>
                  </div>

                  <div ref={scrollRef} className="max-h-[560px] overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(244,211,94,0.15)_0%,rgba(245,252,237,0.8)_28%,rgba(255,255,255,0.96)_78%)] px-4 py-6 sm:px-6 sm:py-8">
                    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
                      {messages.map((message) => (
                        <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[92%] whitespace-pre-wrap rounded-[24px] px-5 py-4 text-[15px] leading-7 shadow-sm sm:max-w-[86%] sm:text-[16px] ${
                              message.role === "user"
                                ? "rounded-br-md bg-[#4d7c0f] text-white"
                                : message.role === "assistant"
                                  ? "rounded-bl-md border border-[#e5ecd8] bg-white text-[#24321a]"
                                  : "rounded-bl-md border border-[#f4d35e]/50 bg-[#fff9df] text-[#7a5700]"
                            }`}
                          >
                            {message.content}
                          </div>
                        </div>
                      ))}

                      {connectionState === "connecting" && (
                        <div className="flex justify-start">
                          <div className="inline-flex items-center gap-3 rounded-[24px] rounded-bl-md border border-[#e5ecd8] bg-white px-5 py-4 text-[#5b6b49] shadow-sm">
                            <Loader2 className="h-4 w-4 animate-spin" /> George is joining the conversation…
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-[#e8f0db] bg-[#fbfdf8] px-4 py-5 sm:px-6">
                    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm leading-6 text-[#5b6b49]">
                        {connectionState === "connected"
                          ? "You’re in a live conversation. Just speak naturally and George should reply automatically."
                          : "Start the live conversation and George will greet visitors, listen, and reply automatically without push-to-talk."}
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={startConversation}
                          disabled={!canStart}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,#8ec63f_0%,#5e9921_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(94,153,33,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Mic className="h-4 w-4" />
                          {connectionState === "connected" ? "Live conversation on" : "Start live conversation"}
                        </button>
                        {connectionState === "connected" && (
                          <button
                            type="button"
                            onClick={stopConversation}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#dbe8c9] bg-white px-5 py-3 text-sm font-semibold text-[#355e12] transition hover:bg-[#f7fbf2]"
                          >
                            <PhoneOff className="h-4 w-4" /> End conversation
                          </button>
                        )}
                      </div>
                    </div>
                    {error ? <p className="mx-auto mt-3 w-full max-w-4xl text-sm text-[#b3261e]">{error}</p> : null}
                  </div>
                </div>

                <div className="rounded-[34px] border border-[#dce9c9] bg-white/90 p-6 shadow-[0_26px_70px_rgba(120,130,70,0.12)] sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#d97706]">Helpful buttons</p>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#355e12]">Send visitors straight to the right place</h2>
                    </div>
                    <a
                      href="https://www.fishersfarmpark.co.uk/"
                      className="inline-flex items-center gap-2 rounded-full border border-[#dbe8c9] bg-[#f8fbf4] px-5 py-3 text-sm font-semibold text-[#355e12] transition hover:bg-[#f1f7e8]"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back to Fishers Farm Park
                    </a>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {QUICK_LINKS.map((link) => {
                      const Icon = link.icon
                      return (
                        <a
                          key={link.label}
                          href={link.href}
                          className="group flex items-center gap-3 rounded-[24px] border border-[#dfe9d4] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf4_100%)] px-4 py-4 text-sm font-semibold text-[#355e12] shadow-sm transition hover:-translate-y-0.5 hover:border-[#bfdc9f] hover:shadow-[0_16px_34px_rgba(120,130,70,0.12)]"
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef8df] text-[#5e9921] transition group-hover:bg-[#e4f3ca]">
                            <Icon className="h-5 w-5" />
                          </span>
                          <span>{link.label}</span>
                        </a>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>
          )
        }
