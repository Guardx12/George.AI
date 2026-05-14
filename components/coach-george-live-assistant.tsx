"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { Mic, Send, Square, Volume2, VolumeX } from "lucide-react"

type Role = "assistant" | "user"

type ChatMessage = {
  id: string
  role: Role
  content: string
}

type CoachMemory = {
  name?: string
  goal?: string
  currentWeightKg?: string
  targetWeightKg?: string
  trainingFocus?: string
  tracker?: string
  foodPreferences?: string[]
  struggles?: string[]
  patterns?: string[]
  coachingStyle?: string
  lastSummary?: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

type ChatResponse = {
  reply: string
  memory: CoachMemory
  memoryNote?: string
  outOfScope?: boolean
}

const STORAGE_KEY = "coach-george-conversation-v1"
const MEMORY_KEY = "coach-george-memory-v1"
const VOICE_KEY = "coach-george-voice-enabled-v1"

const INTRO_MESSAGE = "Hey, I’m George. Tell me what we’re working towards and I’ll coach you from there."

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function makeMessage(role: Role, content: string): ChatMessage {
  return { id: makeId(role), role, content }
}

function trimMessages(messages: ChatMessage[]) {
  return messages.slice(-60)
}

function mergeMemory(existing: CoachMemory, incoming: CoachMemory): CoachMemory {
  const mergeList = (a?: string[], b?: string[]) => Array.from(new Set([...(a || []), ...(b || [])].filter(Boolean))).slice(0, 12)
  return {
    ...existing,
    ...Object.fromEntries(Object.entries(incoming || {}).filter(([, value]) => value !== undefined && value !== null && value !== "")),
    foodPreferences: mergeList(existing.foodPreferences, incoming.foodPreferences),
    struggles: mergeList(existing.struggles, incoming.struggles),
    patterns: mergeList(existing.patterns, incoming.patterns),
  }
}

function memoryBadges(memory: CoachMemory) {
  const badges = [memory.goal, memory.currentWeightKg, memory.trainingFocus, ...(memory.patterns || []).slice(0, 2)]
    .filter(Boolean)
    .map(String)
  return badges.slice(0, 3)
}

function buildVoiceRendererInstructions() {
  return [
    "You are Coach George's voice renderer.",
    "The app decides the exact words.",
    "Only speak the exact text provided to you.",
    "Do not add, remove, paraphrase, answer, or improvise.",
    "Use a calm, warm, direct coach tone.",
  ].join(" ")
}

function buildRealtimeSessionPayload(instructions: string) {
  return {
    type: "realtime",
    instructions,
    audio: {
      input: {
        transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "en",
        },
        turn_detection: {
          type: "semantic_vad",
          eagerness: "high",
          create_response: false,
          interrupt_response: true,
        },
      },
      output: {
        voice: "cedar",
        speed: 1.0,
      },
    },
  }
}

export function CoachGeorgeLiveAssistant() {
  const [hydrated, setHydrated] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([makeMessage("assistant", INTRO_MESSAGE)])
  const [memory, setMemory] = useState<CoachMemory>({})
  const [input, setInput] = useState("")
  const [isThinking, setIsThinking] = useState(false)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [lastSpokenText, setLastSpokenText] = useState("")

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const chatRef = useRef<HTMLDivElement | null>(null)
  const memoryRef = useRef<CoachMemory>({})
  const messagesRef = useRef<ChatMessage[]>(messages)
  const handledTranscriptsRef = useRef<Map<string, number>>(new Map())

  const badges = useMemo(() => memoryBadges(memory), [memory])
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant")?.content || INTRO_MESSAGE
  const isConnected = connectionState === "connected"
  const isConnecting = connectionState === "connecting"

  useEffect(() => {
    memoryRef.current = memory
  }, [memory])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const storedMessages = window.localStorage.getItem(STORAGE_KEY)
      const storedMemory = window.localStorage.getItem(MEMORY_KEY)
      const storedVoice = window.localStorage.getItem(VOICE_KEY)
      if (storedMessages) {
        const parsed = JSON.parse(storedMessages) as ChatMessage[]
        if (Array.isArray(parsed) && parsed.length) setMessages(trimMessages(parsed))
      }
      if (storedMemory) {
        const parsed = JSON.parse(storedMemory) as CoachMemory
        if (parsed && typeof parsed === "object") setMemory(parsed)
      }
      if (storedVoice === "off") setVoiceEnabled(false)
    } catch {
      // ignore bad local storage
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimMessages(messages)))
  }, [messages, hydrated])

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return
    window.localStorage.setItem(MEMORY_KEY, JSON.stringify(memory))
  }, [memory, hydrated])

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return
    window.localStorage.setItem(VOICE_KEY, voiceEnabled ? "on" : "off")
  }, [voiceEnabled, hydrated])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, isThinking])

  useEffect(() => {
    return () => stopVoiceSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function appendMessage(role: Role, content: string) {
    const next = makeMessage(role, content)
    setMessages((prev) => trimMessages([...prev, next]))
    return next
  }

  function speak(text: string) {
    if (!voiceEnabled) return
    const channel = dcRef.current
    if (!channel || channel.readyState !== "open") return
    const safeText = text.trim()
    if (!safeText) return
    setLastSpokenText(safeText)
    try {
      channel.send(
        JSON.stringify({
          type: "response.create",
          response: {
            conversation: "none",
            output_modalities: ["audio"],
            input: [
              {
                type: "message",
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: `Speak this exactly as written, in George's calm coach voice. Do not add anything.\n\n${safeText}`,
                  },
                ],
              },
            ],
          },
        }),
      )
    } catch (err) {
      console.error("Could not send George voice response", err)
    }
  }

  async function askGeorge(userText: string) {
    const clean = userText.trim()
    if (!clean || isThinking) return
    setError(null)
    appendMessage("user", clean)
    setInput("")
    setIsThinking(true)

    try {
      const response = await fetch("/api/coach-george-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: clean,
          memory: memoryRef.current,
          messages: messagesRef.current.slice(-16),
        }),
      })

      const payload = (await response.json()) as ChatResponse
      if (!response.ok || !payload?.reply) throw new Error("George did not return a reply.")

      const nextMemory = mergeMemory(memoryRef.current, payload.memory || {})
      if (payload.memoryNote) nextMemory.lastSummary = payload.memoryNote
      setMemory(nextMemory)
      appendMessage("assistant", payload.reply)
      speak(payload.reply)
    } catch (err) {
      const fallback = "I’m with you. Tell me the food, training, motivation, or weight issue in plain English and I’ll coach the next move."
      appendMessage("assistant", fallback)
      speak(fallback)
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setIsThinking(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await askGeorge(input)
  }

  function handleTranscript(text: string) {
    const clean = text.trim()
    if (!clean) return
    const normalized = clean.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    const now = Date.now()
    const previous = handledTranscriptsRef.current.get(normalized)
    if (previous && now - previous < 2500) return
    handledTranscriptsRef.current.set(normalized, now)
    void askGeorge(clean)
  }

  function handleDataChannelMessage(raw: MessageEvent<string>) {
    try {
      const event = JSON.parse(raw.data)
      const type = String(event?.type || "")
      if (type === "conversation.item.input_audio_transcription.completed") {
        const transcript = String(event?.transcript || "")
        handleTranscript(transcript)
      }
      if (type === "input_audio_buffer.speech_started") {
        setError(null)
      }
      if (type === "error") {
        setError(typeof event?.error?.message === "string" ? event.error.message : "Voice connection error.")
      }
    } catch {
      // ignore unknown realtime events
    }
  }

  function stopVoiceSession() {
    try {
      dcRef.current?.close()
    } catch {}
    try {
      pcRef.current?.close()
    } catch {}
    try {
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
    } catch {}
    dcRef.current = null
    pcRef.current = null
    localStreamRef.current = null
    setConnectionState("idle")
  }

  async function startVoiceSession() {
    if (connectionState === "connected" || connectionState === "connecting") {
      stopVoiceSession()
      return
    }

    setError(null)
    setConnectionState("connecting")

    try {
      const tokenResponse = await fetch("/api/george-session", { cache: "no-store" })
      const tokenData = await tokenResponse.json().catch(() => null)
      const token = tokenData?.value
      if (!tokenResponse.ok || typeof token !== "string") {
        throw new Error(tokenData?.error || "Could not start George voice.")
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      const pc = new RTCPeerConnection()
      pcRef.current = pc
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      const remoteAudio = new Audio()
      remoteAudio.autoplay = true
      audioRef.current = remoteAudio
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams
        if (remoteStream) {
          remoteAudio.srcObject = remoteStream
          void remoteAudio.play().catch(() => setError("Tap once more if your browser blocked audio playback."))
        }
      }

      const channel = pc.createDataChannel("oai-events")
      dcRef.current = channel
      channel.onmessage = handleDataChannelMessage
      channel.onopen = () => {
        setConnectionState("connected")
        channel.send(JSON.stringify({ type: "session.update", session: buildRealtimeSessionPayload(buildVoiceRendererInstructions()) }))
      }
      channel.onerror = () => setError("George voice hit a connection issue.")
      channel.onclose = () => setConnectionState("idle")

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp || "",
      })

      if (!sdpResponse.ok) throw new Error("OpenAI realtime connection failed.")
      const answerSdp = await sdpResponse.text()
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp })
    } catch (err) {
      stopVoiceSession()
      setConnectionState("error")
      setError(err instanceof Error ? err.message : "Could not start George voice.")
    }
  }

  function resetLocalMemory() {
    const intro = makeMessage("assistant", INTRO_MESSAGE)
    setMessages([intro])
    setMemory({})
    setError(null)
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY)
      window.localStorage.removeItem(MEMORY_KEY)
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050506] text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(196,160,93,0.20),_transparent_34%),linear-gradient(180deg,_rgba(11,12,14,0.78),_#050506_60%,_#020203)]" />
        <div className="absolute left-1/2 top-[-120px] h-[440px] w-[440px] -translate-x-1/2 rounded-full bg-[#c4a05d]/10 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-80px] h-[360px] w-[360px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:44px_44px]" />
      </div>

      <section className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-4 pb-4 pt-5 sm:px-5">
        <div className="flex items-center justify-between text-xs text-white/50">
          <button onClick={resetLocalMemory} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:bg-white/[0.07]">
            Reset
          </button>
          <button
            onClick={() => setVoiceEnabled((value) => !value)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:bg-white/[0.07]"
            aria-label="Toggle George voice"
          >
            {voiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            {voiceEnabled ? "Voice on" : "Voice off"}
          </button>
        </div>

        <div className="flex flex-col items-center pt-4 text-center">
          <button
            onClick={startVoiceSession}
            className={`group relative h-40 w-40 rounded-full border border-[#dbc078]/35 bg-[radial-gradient(circle_at_45%_28%,rgba(255,255,255,.96),rgba(221,192,118,.72)_18%,rgba(52,43,30,.92)_48%,rgba(5,5,6,.98)_74%)] shadow-[0_0_70px_rgba(196,160,93,.24)] transition duration-300 active:scale-[0.98] ${isConnected ? "animate-pulse" : ""}`}
            aria-label={isConnected ? "Stop talking to George" : "Tap to talk to George"}
          >
            <span className="absolute inset-3 rounded-full border border-white/10 bg-black/20" />
            <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,transparent_45%,rgba(255,255,255,.12)_46%,transparent_48%)]" />
            <span className="relative z-10 flex h-full flex-col items-center justify-center gap-2 text-white">
              {isConnected ? <Square className="h-9 w-9 fill-white/80" /> : <Mic className="h-10 w-10" />}
              <span className="text-sm font-semibold tracking-[0.22em] text-[#f5e6ba]">GEORGE</span>
            </span>
          </button>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight">Coach George</h1>
          <p className="mt-2 max-w-[330px] text-sm leading-6 text-white/60">Your coach for food, training, motivation, and staying on track.</p>
          <div className="mt-3 min-h-6 text-xs text-[#f0d28a]/80">
            {isConnecting ? "Connecting…" : isConnected ? "Listening" : connectionState === "error" ? "Voice paused" : "Tap George to talk"}
          </div>
          {badges.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {badges.map((badge) => (
                <span key={badge} className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/55">
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.045] p-4 shadow-2xl backdrop-blur-xl">
          <p className="text-sm leading-6 text-white/82">{latestAssistant}</p>
        </div>

        <div ref={chatRef} className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pb-4 pr-1">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[86%] rounded-[24px] px-4 py-3 text-sm leading-6 shadow-lg ${
                  message.role === "user"
                    ? "bg-[#d7b56d] text-[#15100a]"
                    : "border border-white/10 bg-[#111216]/86 text-white/82 backdrop-blur-xl"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex justify-start">
              <div className="rounded-[24px] border border-white/10 bg-[#111216]/86 px-4 py-3 text-sm text-white/60 backdrop-blur-xl">George is thinking…</div>
            </div>
          )}
        </div>

        {error && <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-xs leading-5 text-red-100">{error}</div>}
        {lastSpokenText && voiceEnabled && isConnected && <p className="mb-2 text-center text-[11px] text-white/35">Voice reply ready</p>}

        <form onSubmit={handleSubmit} className="rounded-[28px] border border-white/10 bg-[#0d0e11]/92 p-2 shadow-[0_-18px_60px_rgba(0,0,0,.35)] backdrop-blur-xl">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void askGeorge(input)
              }
            }}
            placeholder="Talk to George…"
            rows={1}
            className="min-h-[52px] w-full resize-none rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white outline-none placeholder:text-white/35 focus:border-[#d7b56d]/45"
          />
          <div className="mt-2 flex items-center justify-between gap-2 px-1 pb-1">
            <p className="text-[11px] text-white/35">Voice replies + text. George stays focused on coaching.</p>
            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#d7b56d] text-[#15100a] transition hover:bg-[#e8ca80] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
