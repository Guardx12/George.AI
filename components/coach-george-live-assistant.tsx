"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Flame, Loader2, MessageSquareText, Mic } from "lucide-react"
import {
  buildMealPlan,
  getDailyTargets,
  foods,
  type Profile,
} from "@/lib/coach-george/coach-george-nutrition"

type ChatActionKind =
  | "confirm-targets"
  | "adjust-targets"
  | "looks-good"
  | "change-something"
  | "rebuild-plan"
  | "keep-plan"
  | "swap-works"
  | "swap-again"

type ChatAction = {
  id: string
  label: string
  prompt: string
  kind: ChatActionKind
}

type LiveMessage = {
  id: string
  role: "assistant" | "user"
  content: string
  actions?: ChatAction[]
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"

type StoredSession = {
  messages: LiveMessage[]
  profile: Profile
  latestPlan: string
  lastActiveDate: string
  dayStreak: number
}

const SESSION_KEY = "coach-george-session-v4"

const DEFAULT_PROFILE: Profile = {
  goal: "lose-fat",
  sex: "male",
  age: 30,
  heightCm: 178,
  currentWeightKg: 82,
  activityLevel: "moderate",
  allergies: [],
  dislikedFoods: [],
  mealsPerDay: 4,
  dietaryPreference: "omnivore",
}

const ONBOARDING_ACTIONS: ChatAction[] = [
  { id: "confirm-targets", label: "Confirm targets", prompt: "Confirm my targets and build my day plan.", kind: "confirm-targets" },
  { id: "adjust-targets", label: "Adjust targets", prompt: "I want to adjust my targets before planning.", kind: "adjust-targets" },
]

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "assistant",
    content:
      "Hi — I'm Coach George. Tap to talk. When you're ready, confirm your targets and I'll build your plan meal-by-meal.",
    actions: ONBOARDING_ACTIONS,
  },
]

function makeMessage(role: LiveMessage["role"], content: string, actions?: ChatAction[]) {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${role}-${Date.now()}-${Math.random()}`,
    role,
    content,
    ...(actions?.length ? { actions } : {}),
  }
}

function sanitizeActions(messages: LiveMessage[]) {
  return messages.map((m) => (m.actions?.length ? { ...m, actions: [] } : m))
}

export function CoachGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [latestPlan, setLatestPlan] = useState("No plan built yet.")
  const [dayStreak, setDayStreak] = useState(1)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)

  const targets = useMemo(() => getDailyTargets(profile), [profile])
  const canStart = useMemo(() => connectionState === "idle" || connectionState === "error", [connectionState])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY)
      if (!raw) return
      const stored = JSON.parse(raw) as StoredSession
      if (Array.isArray(stored.messages) && stored.messages.length) setMessages(stored.messages)
      if (stored.profile) setProfile(stored.profile)
      if (typeof stored.latestPlan === "string") setLatestPlan(stored.latestPlan)

      const today = new Date().toISOString().slice(0, 10)
      if (stored.lastActiveDate && stored.lastActiveDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
        setDayStreak(stored.lastActiveDate === yesterday ? Math.max(1, (stored.dayStreak || 1) + 1) : 1)
      } else {
        setDayStreak(stored.dayStreak || 1)
      }
    } catch {
      // ignore bad storage
    }
  }, [])

  useEffect(() => {
    try {
      const payload: StoredSession = {
        messages: messages.slice(-36),
        profile,
        latestPlan,
        lastActiveDate: new Date().toISOString().slice(0, 10),
        dayStreak,
      }
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
    } catch {
      // ignore
    }
  }, [messages, profile, latestPlan, dayStreak])

  useEffect(() => {
    return () => {
      void cleanupConversation()
    }
  }, [])

  useEffect(() => {
    if (!chatScrollRef.current) return
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [messages])

  function replaceActions() {
    setMessages((prev) => sanitizeActions(prev))
  }

  function addUserMessage(content: string) {
    replaceActions()
    setMessages((prev) => [...prev, makeMessage("user", content)])
  }

  function addAssistantMessage(content: string, actions?: ChatAction[]) {
    replaceActions()
    setMessages((prev) => [...prev, makeMessage("assistant", content, actions)])
  }

  function sendTextToCoach(text: string) {
    const channel = dcRef.current
    if (!channel || channel.readyState !== "open") {
      addAssistantMessage("Tap to Talk first so George can answer this out loud.")
      return false
    }

    channel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
      }),
    )
    channel.send(JSON.stringify({ type: "response.create" }))
    return true
  }

  function appendOrUpdateAssistantPartial(delta: string, isFinal = false) {
    if (!delta) return

    if (!currentAssistantMessageIdRef.current) {
      replaceActions()
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
    setMessages((prev) => prev.map((m) => (m.id === targetId ? { ...m, content: currentAssistantTextRef.current } : m)))

    if (isFinal) {
      currentAssistantMessageIdRef.current = null
      currentAssistantTextRef.current = ""
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
      case "conversation.item.input_audio_transcription.completed": {
        const text = typeof event.transcript === "string" ? event.transcript.trim() : ""
        if (text) addUserMessage(text)
        break
      }
      case "response.output_item.done": {
        const content = Array.isArray(event?.item?.content) ? event.item.content : []
        const transcript = content
          .map((part: any) => (typeof part?.transcript === "string" ? part.transcript : typeof part?.text === "string" ? part.text : ""))
          .filter(Boolean)
          .join("\n")
        if (transcript) appendOrUpdateAssistantPartial(transcript, true)
        break
      }
      case "error":
        setError(event?.error?.message || "George hit a voice error.")
        break
      default:
        break
    }
  }

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

  async function startConversation() {
    if (!canStart) return

    await cleanupConversation()
    setConnectionState("connecting")
    setError(null)

    try {
      const sessionResponse = await fetch("/api/george-session", { method: "GET", cache: "no-store" })
      const sessionData = await sessionResponse.json().catch(() => null)
      if (!sessionResponse.ok) {
        throw new Error(typeof sessionData?.error === "string" ? sessionData.error : "Could not create live session")
      }

      const ephemeralKey = sessionData?.client_secret?.value || sessionData?.value
      if (!ephemeralKey) throw new Error("Live voice token missing.")

      const pc = new RTCPeerConnection()
      pcRef.current = pc

      const remoteAudio = document.createElement("audio")
      remoteAudio.autoplay = true
      remoteAudio.setAttribute("playsinline", "true")
      audioRef.current = remoteAudio

      pc.ontrack = (event) => {
        const [stream] = event.streams
        if (stream) {
          remoteAudio.srcObject = stream
          void remoteAudio.play().catch(() => {})
        }
      }

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = micStream
      micStream.getTracks().forEach((track) => pc.addTrack(track, micStream))

      const dataChannel = pc.createDataChannel("oai-events")
      dcRef.current = dataChannel

      dataChannel.addEventListener("open", () => {
        setConnectionState("connected")
        const onboardingPrompt =
          "Introduce yourself as Coach George in a short friendly way, then ask one onboarding question about the user's goal."
        dataChannel.send(JSON.stringify({ type: "response.create", response: { instructions: onboardingPrompt } }))
      })

      dataChannel.addEventListener("message", (event) => {
        try {
          handleRealtimeEvent(JSON.parse(event.data))
        } catch {
          // ignore malformed events
        }
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
        throw new Error(answer || "Could not connect George")
      }

      await pc.setRemoteDescription({ type: "answer", sdp: answer })

      pc.addEventListener("connectionstatechange", () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
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
    setConnectionState("idle")
    setError(null)
  }

  function buildMyPlan() {
    const result = buildMealPlan(profile)
    const formatted = result.plan
      .map(
        (meal, index) =>
          `Meal ${index + 1}: ${meal.name}\n${meal.ingredients
            .map((ingredient) => `${foods.find((f) => f.id === ingredient.foodId)?.name || ingredient.foodId} ${ingredient.grams}g`)
            .join("\n")}`,
      )
      .join("\n\n")

    const summary = `Daily Plan\n${formatted}`
    setLatestPlan(summary)
    addUserMessage("Build my plan")
    addAssistantMessage(summary, [
      { id: "looks-good", label: "Looks good", prompt: "Looks good, keep this plan.", kind: "looks-good" },
      { id: "change-something", label: "Change something", prompt: "Change something in this plan.", kind: "change-something" },
    ])

    sendTextToCoach(`Build and explain this exact meal plan with portions:\n${summary}`)
  }

  function updateWeight() {
    const raw = window.prompt("Enter your current weight in kg")
    if (!raw) return
    const value = Number(raw)
    if (!Number.isFinite(value) || value < 35 || value > 350) {
      setError("Please enter a valid weight in kg.")
      return
    }

    setError(null)
    setProfile((prev) => ({ ...prev, currentWeightKg: value }))
    addUserMessage(`Update weight to ${value}kg`)
    addAssistantMessage(`Nice one — updated your weight to ${value}kg and refreshed your targets.`, [
      { id: "rebuild-plan", label: "Rebuild plan", prompt: "Rebuild my plan with my updated weight.", kind: "rebuild-plan" },
      { id: "keep-plan", label: "Keep current plan", prompt: "Keep my current plan for now.", kind: "keep-plan" },
    ])
    sendTextToCoach(`My weight is now ${value}kg. Confirm updated targets and coach me.`)
  }

  function resetGoalsAndStats() {
    window.localStorage.removeItem(SESSION_KEY)
    setProfile(DEFAULT_PROFILE)
    setDayStreak(1)
    setLatestPlan("No plan built yet.")
    setMessages(INITIAL_MESSAGES)
    sendTextToCoach("I reset my goals and stats. Start onboarding me from scratch now.")
  }

  function onAction(action: ChatAction) {
    addUserMessage(action.label)

    switch (action.kind) {
      case "confirm-targets":
        buildMyPlan()
        break
      case "adjust-targets":
        addAssistantMessage(
          "Tell me what to adjust (goal, activity level, meals per day, dietary preference, allergies, dislikes, or weight) and I'll update it with you.",
        )
        sendTextToCoach(action.prompt)
        break
      case "looks-good":
        addAssistantMessage("Perfect — locking this in.")
        sendTextToCoach(action.prompt)
        break
      case "change-something":
        addAssistantMessage("No problem. I'll suggest a swap.", [
          { id: "swap-works", label: "That works", prompt: "That swap works for me.", kind: "swap-works" },
          { id: "swap-again", label: "Try another option", prompt: "Try another option.", kind: "swap-again" },
        ])
        sendTextToCoach(action.prompt)
        break
      case "rebuild-plan":
        buildMyPlan()
        break
      case "keep-plan":
        addAssistantMessage("Great, we'll keep this plan.")
        sendTextToCoach(action.prompt)
        break
      case "swap-works":
        addAssistantMessage("Excellent. We'll run with that swap.")
        sendTextToCoach(action.prompt)
        break
      case "swap-again":
        addAssistantMessage("Got it — trying another swap now.", [
          { id: "swap-works", label: "That works", prompt: "That works.", kind: "swap-works" },
          { id: "swap-again", label: "Try another option", prompt: "Try another option.", kind: "swap-again" },
        ])
        sendTextToCoach(action.prompt)
        break
      default:
        break
    }
  }

  return (
    <section className="bg-[#060a12] px-4 py-6 text-white sm:py-8">
      <div className="mx-auto w-full max-w-[920px] rounded-[30px] border border-white/10 bg-gradient-to-b from-[#0f1727] to-[#090f1a] p-4 shadow-[0_0_80px_rgba(93,123,255,0.12)] sm:p-5">
        <div className="rounded-3xl border border-white/10 bg-[#0a1120]/90 p-4">
          <button
            type="button"
            onClick={connectionState === "connected" ? stopConversation : startConversation}
            disabled={connectionState === "connecting"}
            className={`mx-auto flex h-[170px] w-[170px] items-center justify-center rounded-full transition ${connectionState === "connected" ? "animate-pulse" : ""}`}
            style={{ background: "radial-gradient(circle at 32% 26%, #284775 0%, #1a2e52 52%, #0d1a33 100%)" }}
          >
            {connectionState === "connecting" ? <Loader2 className="h-10 w-10 animate-spin" /> : <Mic className="h-10 w-10" />}
          </button>
          <p className="mt-3 text-center text-lg font-semibold">Tap to Talk</p>
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-[#0c1424] p-4">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-2xl bg-white/5 p-3"><p className="text-[#8ea5cc]">Total Calories</p><p className="mt-1 text-xl font-semibold">{targets.calories}</p></div>
            <div className="rounded-2xl bg-white/5 p-3"><p className="text-[#8ea5cc]">Current Weight</p><p className="mt-1 text-xl font-semibold">{profile.currentWeightKg}kg</p></div>
            <div className="rounded-2xl bg-white/5 p-3"><p className="text-[#8ea5cc]">Day Streak</p><p className="mt-1 inline-flex items-center gap-1 text-xl font-semibold"><Flame className="h-4 w-4 text-orange-300" />{dayStreak}</p></div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-2xl bg-white/5 p-3"><p className="text-[#8ea5cc]">Protein</p><p className="mt-1 text-lg font-semibold">{targets.protein}g</p></div>
            <div className="rounded-2xl bg-white/5 p-3"><p className="text-[#8ea5cc]">Carbs</p><p className="mt-1 text-lg font-semibold">{targets.carbs}g</p></div>
            <div className="rounded-2xl bg-white/5 p-3"><p className="text-[#8ea5cc]">Fats</p><p className="mt-1 text-lg font-semibold">{targets.fat}g</p></div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <button onClick={buildMyPlan} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-medium text-[#d5e3ff]">Build My Plan</button>
          <button onClick={updateWeight} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-medium text-[#d5e3ff]">Update Weight</button>
          <button onClick={resetGoalsAndStats} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-medium text-[#d5e3ff]">Reset Goals & Stats</button>
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-[#0a1222] p-3">
          <div className="mb-3 flex items-center gap-2 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1b2a44] text-[#9cb7e4]">
              <MessageSquareText className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9fb4dc]">Transcript</p>
          </div>

          <div ref={chatScrollRef} className="h-[420px] space-y-3 overflow-y-auto rounded-2xl bg-white/[0.03] p-3">
            {messages.map((message) => {
              const isUser = message.role === "user"
              return (
                <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[90%]">
                    <div className={`rounded-2xl px-3 py-2 text-sm leading-6 ${isUser ? "bg-[#365fa5] text-white" : "border border-white/10 bg-[#121f35] text-[#dce8ff]"}`}>
                      {message.content}
                    </div>
                    {!isUser && message.actions?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.actions.map((action) => (
                          <button
                            key={action.id}
                            type="button"
                            onClick={() => onAction(action)}
                            className="rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-[#d9e6ff] transition hover:bg-white/10"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {error ? <p className="mt-4 text-center text-sm font-medium text-[#ff8892]">{error}</p> : null}
      </div>
    </section>
  )
}
