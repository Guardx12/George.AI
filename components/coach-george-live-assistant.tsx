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

const STORAGE_KEY = "coach-george-simple-chat-v1"
const MEMORY_KEY = "coach-george-simple-memory-v1"
const VOICE_KEY = "coach-george-simple-voice-v1"

const INTRO_MESSAGE = "Hey, I’m George. Tell me what we’re working towards and I’ll coach you from there."

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function makeMessage(role: Role, content: string): ChatMessage {
  return { id: makeId(role), role, content }
}

function trimMessages(messages: ChatMessage[]) {
  return messages.slice(-80)
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

function buildVoiceRendererInstructions() {
  return [
    "You are Coach George's voice renderer.",
    "Only speak the exact text provided by the app.",
    "Do not add, remove, paraphrase, answer, or improvise.",
    "Use a calm, warm, direct British coach tone.",
    "Sound natural, not robotic.",
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
        speed: 0.95,
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

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const chatRef = useRef<HTMLDivElement | null>(null)
  const memoryRef = useRef<CoachMemory>({})
  const messagesRef = useRef<ChatMessage[]>(messages)
  const handledTranscriptsRef = useRef<Map<string, number>>(new Map())

  const latestAssistant = useMemo(() => [...messages].reverse().find((message) => message.role === "assistant")?.content || INTRO_MESSAGE, [messages])
  const isConnected = connectionState === "connected"
  const isConnecting = connectionState === "connecting"
  const hasRealConversation = messages.length > 1

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
          messages: messagesRef.current.slice(-24),
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
      const fallback = "I’m with you. Say it plainly — food, training, weight, motivation, or whatever’s trying to knock you off track — and I’ll coach the next move."
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
      if (type === "input_audio_buffer.speech_started") setError(null)
      if (type === "error") setError(typeof event?.error?.message === "string" ? event.error.message : "Voice connection error.")
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
      if (!tokenResponse.ok || typeof token !== "string") throw new Error(tokenData?.error || "Could not start George voice.")

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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(232,210,164,0.16),transparent_34%),linear-gradient(180deg,rgba(14,15,18,0.94),#050506_54%,#020203)]" />
        <div className="absolute inset-x-0 top-0 mx-auto h-[360px] max-w-[620px] bg-[url('/coach-george-face.png')] bg-cover bg-center opacity-[0.10] blur-2xl" />
        <div className="absolute left-1/2 top-[80px] h-[260px] w-[260px] -translate-x-1/2 rounded-full bg-[#e8d2a4]/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.55)_1px,transparent_1px)] [background-size:42px_42px]" />
      </div>

      <section className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-4 pb-4 pt-4 sm:px-5">
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setVoiceEnabled((value) => !value)}
            className="rounded-full border border-white/10 bg-white/[0.035] p-2.5 text-white/55 backdrop-blur-xl transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Toggle George voice"
          >
            {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex flex-col items-center pt-1 text-center">
          <button
            onClick={startVoiceSession}
            className={`group relative h-44 w-44 rounded-full border border-[#f1d99d]/45 bg-black shadow-[0_0_90px_rgba(232,210,164,.22)] transition duration-300 active:scale-[0.985] ${isConnected ? "animate-pulse" : ""}`}
            aria-label={isConnected ? "Stop talking to George" : "Tap to talk to George"}
          >
            <span className="absolute -inset-2 rounded-full bg-[conic-gradient(from_180deg,transparent,rgba(255,237,191,.50),transparent,rgba(201,166,98,.35),transparent)] opacity-75 blur-[2px]" />
            <span className="absolute inset-0 overflow-hidden rounded-full border border-white/10">
              <img src="/coach-george-face.png" alt="Coach George" className="h-full w-full scale-[1.08] object-cover" />
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,transparent_40%,rgba(0,0,0,.20)_72%,rgba(0,0,0,.72))]" />
            </span>
            <span className="absolute bottom-3 left-1/2 z-10 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-[#f1d99d]/50 bg-black/70 text-[#f5deb0] shadow-[0_0_32px_rgba(232,210,164,.24)] backdrop-blur-md">
              {isConnected ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-6 w-6" />}
            </span>
          </button>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight">Coach George</h1>
          <p className="mt-2 max-w-[330px] text-sm leading-6 text-white/58">Your coach for food, training, motivation, and staying on track.</p>
          <div className="mt-3 min-h-5 text-xs text-[#ead4a6]/75">
            {isConnecting ? "Connecting…" : isConnected ? "Listening" : connectionState === "error" ? "Voice paused" : "Tap George to talk"}
          </div>
        </div>

        <div className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.05] p-4 shadow-2xl backdrop-blur-xl">
          <p className="text-[15px] leading-6 text-white/84">{latestAssistant}</p>
        </div>

        <div ref={chatRef} className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pb-4 pr-1">
          {(hasRealConversation ? messages.slice(1) : []).map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[86%] rounded-[24px] px-4 py-3 text-sm leading-6 shadow-lg ${
                  message.role === "user"
                    ? "bg-[linear-gradient(135deg,#e7d2a4,#a98242)] text-[#120e08]"
                    : "border border-white/10 bg-[#111216]/88 text-white/84 backdrop-blur-xl"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex justify-start">
              <div className="rounded-[24px] border border-white/10 bg-[#111216]/88 px-4 py-3 text-sm text-white/60 backdrop-blur-xl">George is thinking…</div>
            </div>
          )}
        </div>

        {error && <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-xs leading-5 text-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="rounded-[28px] border border-white/10 bg-[#0d0e11]/94 p-2 shadow-[0_-18px_60px_rgba(0,0,0,.35)] backdrop-blur-xl">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void askGeorge(input)
              }
            }}
            rows={1}
            placeholder="Talk to George…"
            className="max-h-28 min-h-[44px] w-full resize-none rounded-[22px] border border-white/0 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
          />
          <div className="flex items-center justify-between gap-3 px-2 pb-1">
            <button type="button" onClick={resetLocalMemory} className="text-[11px] text-white/22 transition hover:text-white/50">
              Reset
            </button>
            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f1d99d,#a98242)] text-[#110d08] shadow-[0_0_28px_rgba(232,210,164,.20)] transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message to George"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
