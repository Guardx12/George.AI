"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Loader2, Mic, PhoneOff, RotateCcw } from "lucide-react"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

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

export function PlacesForPeopleGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [isModelSpeaking, setIsModelSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasStoredSession, setHasStoredSession] = useState(false)
  const [visitorName, setVisitorName] = useState<string | null>(null)
  const [showConversation, setShowConversation] = useState(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const canStart = useMemo(() => connectionState === "idle" || connectionState === "error", [connectionState])
  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant")?.content ?? INITIAL_MESSAGES[0].content,
    [messages],
  )
  const latestUserMessage = useMemo(() => [...messages].reverse().find((message) => message.role === "user")?.content ?? null, [messages])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, connectionState, showConversation])

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
    setIsModelSpeaking(false)
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
      case "response.output_audio.delta":
      case "response.created":
        setIsModelSpeaking(true)
        break
      case "response.output_audio.done":
        setIsModelSpeaking(false)
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

  return (
    <section className="rounded-[18px] border border-[#d9d9d9] bg-white px-4 py-8 shadow-[0_12px_30px_rgba(57,69,83,0.08)] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-[760px] text-center">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={connectionState === "connected" ? stopConversation : startConversation}
            disabled={connectionState === "connecting"}
            aria-label={connectionState === "connected" ? "End conversation with George" : "Talk to George"}
            className={`group relative flex h-[126px] w-[126px] items-center justify-center rounded-full transition duration-300 sm:h-[146px] sm:w-[146px] ${
              connectionState === "connecting" ? "cursor-wait" : "hover:scale-[1.02]"
            } ${connectionState === "connected" || connectionState === "connecting" ? "animate-[pulse_2.2s_ease-in-out_infinite]" : ""}`}
            style={{
              background: "radial-gradient(circle at 30% 28%, #7d868f 0%, #616a73 48%, #49515a 100%)",
              boxShadow:
                connectionState === "connected" || connectionState === "connecting"
                  ? "0 0 0 4px rgba(244,124,0,0.20), 0 0 0 10px rgba(244,124,0,0.10), 0 18px 34px rgba(57,69,83,0.20), inset 0 8px 18px rgba(255,255,255,0.18), inset 0 -8px 18px rgba(0,0,0,0.16)"
                  : "0 0 0 4px rgba(244,124,0,0.85), 0 18px 34px rgba(57,69,83,0.16), inset 0 8px 18px rgba(255,255,255,0.18), inset 0 -8px 18px rgba(0,0,0,0.16)",
            }}
          >
            <span className="absolute inset-[10px] rounded-full border border-white/20" />
            <span className="absolute inset-x-[24%] top-[14%] h-5 rounded-full bg-white/12 blur-md" />
            <div className="relative z-10 flex flex-col items-center justify-center text-white">
              {connectionState === "connecting" ? <Loader2 className="h-8 w-8 animate-spin sm:h-9 sm:w-9" /> : <Mic className="h-8 w-8 sm:h-9 sm:w-9" />}
            </div>
          </button>
        </div>

        <h2 className="mt-6 text-[30px] font-black tracking-tight text-[#394553] sm:text-[38px]">Tap to talk to George</h2>
        <p className="mx-auto mt-4 max-w-[720px] text-[17px] leading-8 text-[#394553] sm:text-[18px]">
          George can recommend the right membership, check the live timetable, answer any questions, and guide you through joining.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3 text-left">
          {[
            "Recommend the right membership",
            "Check the live timetable",
            "Answer centre questions",
            "Guide you through joining",
          ].map((item) => (
            <div key={item} className="rounded-full border border-[#d8dde3] bg-[#f6f7f8] px-4 py-2 text-[14px] font-medium text-[#394553] sm:text-[15px]">
              {item}
            </div>
          ))}
        </div>

        {error ? <p className="mt-5 text-sm font-medium text-[#b42318]">{error}</p> : null}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {connectionState === "connected" ? (
            <button
              type="button"
              onClick={stopConversation}
              className="inline-flex items-center gap-2 rounded-full bg-[#f47c00] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105"
            >
              <PhoneOff className="h-4 w-4" /> End conversation
            </button>
          ) : hasStoredSession ? (
            <button
              type="button"
              onClick={clearSavedSession}
              className="inline-flex items-center gap-2 rounded-full border border-[#cfd5dc] bg-white px-5 py-3 text-sm font-semibold text-[#394553] transition hover:bg-[#f6f7f8]"
            >
              <RotateCcw className="h-4 w-4" /> Start fresh
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setShowConversation((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full border border-[#cfd5dc] bg-white px-5 py-3 text-sm font-semibold text-[#394553] transition hover:bg-[#f6f7f8]"
          >
            {showConversation ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showConversation ? "Hide conversation" : "View conversation"}
          </button>
        </div>
      </div>

      {showConversation ? (
        <div className="mt-8 border-t border-[#ececec] pt-6">
          <div ref={scrollRef} className="mx-auto max-h-[420px] w-full max-w-4xl overflow-y-auto px-1">
            <div className="flex flex-col gap-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[92%] whitespace-pre-wrap rounded-[22px] px-5 py-4 text-[15px] leading-7 shadow-sm sm:max-w-[84%] sm:text-[16px] ${
                      message.role === "user"
                        ? "rounded-br-md bg-[#394553] text-white"
                        : message.role === "assistant"
                          ? "rounded-bl-md border border-[#dde3de] bg-white text-[#394553]"
                          : "rounded-bl-md border border-[#dde3de] bg-[#f1f1f1] text-[#5a6672]"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {connectionState === "connecting" && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-3 rounded-[24px] rounded-bl-md border border-[#dde3de] bg-white px-5 py-4 text-[#394553] shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> George is joining the conversation…
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
