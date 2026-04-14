"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, MessageSquareText, Mic } from "lucide-react"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

const STORAGE_KEY = "coach-george-session-v1"

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "system",
    content: "Hi — I'm George, your coach. Tap to talk whenever you're ready.",
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
    ? `Introduce yourself as George in warm, natural British English. This visitor has an ongoing conversation with you on this device, so welcome them back briefly and continue naturally instead of restarting. ${visitorName ? `Their name is ${visitorName}. Use it lightly.` : ""} ${lastUserMessage ? `The last thing they said was: ${lastUserMessage}` : ""} Keep it short and helpful. Ask one short question about what they want help with next.`
    : "Introduce yourself as George in warm, natural British English. Keep it short, welcoming and practical. Ask one short question about what they want help with first."

  return {
    type: "response.create",
    response: { instructions },
  }
}

export function CoachGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [hasStoredSession, setHasStoredSession] = useState(false)
  const [visitorName, setVisitorName] = useState<string | null>(null)

  const sessionStartedAtRef = useRef<number | null>(null)
  const usageLoggedRef = useRef(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)

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
    return () => {
      void cleanupConversation(false)
    }
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

  async function logUsageIfNeeded() {
    if (usageLoggedRef.current || sessionStartedAtRef.current === null) return

    const elapsedMs = Date.now() - sessionStartedAtRef.current
    const minutes = Math.max(0.1, Math.round((elapsedMs / 60000) * 10) / 10)
    usageLoggedRef.current = true

    try {
      await fetch("/api/placesforpeople-usage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({ minutes }),
        cache: "no-store",
        keepalive: true,
      })
    } catch (err) {
      console.error("Could not log Places for People usage", err)
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

    currentAssistantTextRef.current = ""
    currentAssistantMessageIdRef.current = null
    sessionStartedAtRef.current = null
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

    await cleanupConversation(false)
    setConnectionState("connecting")
    setError(null)
    usageLoggedRef.current = false
    sessionStartedAtRef.current = null
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
        sessionStartedAtRef.current = Date.now()
        const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? null
        const event = buildFirstResponseEvent(visitorName, hasStoredSession && messages.length > 1, lastUserMessage)
        window.setTimeout(() => {
          dataChannel.send(JSON.stringify(event))
        }, 150)
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
    await cleanupConversation(true)
    setError(null)
    setConnectionState("idle")
  }

  useEffect(() => {
    if (!chatScrollRef.current) return
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [messages])

  return (
    <section className="bg-[#060a12] px-4 py-6 text-white sm:py-8">
      <div className="mx-auto w-full max-w-[430px] rounded-[30px] border border-white/10 bg-gradient-to-b from-[#0f1727] to-[#090f1a] p-4 shadow-[0_0_80px_rgba(93,123,255,0.12)] sm:p-5">
        <div className="rounded-3xl border border-white/10 bg-[#0a1120]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <button
            type="button"
            onClick={connectionState === "connected" ? stopConversation : startConversation}
            disabled={connectionState === "connecting"}
            aria-label={connectionState === "connected" ? "End conversation with George" : "Tap to talk"}
            className={`group relative mx-auto flex h-[170px] w-[170px] items-center justify-center rounded-full transition duration-300 ${
              connectionState === "connecting" ? "cursor-wait" : "hover:scale-[1.015]"
            } ${connectionState === "connected" || connectionState === "connecting" ? "animate-[pulse_2.2s_ease-in-out_infinite]" : ""}`}
            style={{
              background: "radial-gradient(circle at 32% 26%, #284775 0%, #1a2e52 52%, #0d1a33 100%)",
              boxShadow:
                connectionState === "connected" || connectionState === "connecting"
                  ? "0 0 0 6px rgba(93,123,255,0.2), 0 0 0 16px rgba(93,123,255,0.08), 0 22px 44px rgba(0,0,0,0.45), inset 0 8px 18px rgba(255,255,255,0.12), inset 0 -8px 18px rgba(0,0,0,0.25)"
                  : "0 0 0 6px rgba(93,123,255,0.28), 0 20px 40px rgba(0,0,0,0.4), inset 0 8px 18px rgba(255,255,255,0.12), inset 0 -8px 18px rgba(0,0,0,0.25)",
            }}
          >
            <span className="absolute inset-[12px] rounded-full border border-white/15" />
            <span className="absolute inset-x-[23%] top-[12%] h-6 rounded-full bg-white/10 blur-md" />
            <div className="relative z-10 flex items-center justify-center text-white">
              {connectionState === "connecting" ? <Loader2 className="h-10 w-10 animate-spin" /> : <Mic className="h-10 w-10" />}
            </div>
          </button>
          <p className="mt-4 text-center text-lg font-semibold tracking-wide text-white">Tap to Talk</p>
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-[#0c1424] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9fb4dc]">Stats</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-[#8ea5cc]">Calories</p>
              <p className="mt-1 text-xl font-semibold">—</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-[#8ea5cc]">Weight</p>
              <p className="mt-1 text-xl font-semibold">—</p>
            </div>
            <div className="col-span-2 space-y-2 rounded-2xl bg-white/5 p-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-[#8ea5cc]">
                  <span>Protein</span>
                  <span>—</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 w-0 rounded-full bg-[#66d0ff]" />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-[#8ea5cc]">
                  <span>Carbs</span>
                  <span>—</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 w-0 rounded-full bg-[#7f92ff]" />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-[#8ea5cc]">
                  <span>Fats</span>
                  <span>—</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-2 w-0 rounded-full bg-[#9d7cff]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {["Log a Meal", "What Should I Eat", "Went Off Track", "Give Me a Workout"].map((label) => (
            <button
              key={label}
              type="button"
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-[#d5e3ff] transition hover:bg-white/10"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-[#0a1222] p-3">
          <div className="mb-3 flex items-center gap-2 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1b2a44] text-[#9cb7e4]">
              <MessageSquareText className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9fb4dc]">Chat</p>
          </div>
          <div ref={chatScrollRef} className="h-[400px] space-y-3 overflow-y-auto rounded-2xl bg-white/[0.03] p-3">
            {messages
              .filter((message) => message.role !== "system")
              .map((message) => {
                const isUser = message.role === "user"
                return (
                  <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6 ${
                        isUser ? "bg-[#365fa5] text-white" : "border border-white/10 bg-[#121f35] text-[#dce8ff]"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                )
              })}
            {messages.filter((message) => message.role !== "system").length === 0 ? (
              <p className="px-1 py-2 text-sm text-[#93a6ca]">Your conversation will appear here.</p>
            ) : null}
          </div>
        </div>

        {error ? <p className="mt-4 text-center text-sm font-medium text-[#ff8892]">{error}</p> : null}
      </div>
    </section>
  )
}
