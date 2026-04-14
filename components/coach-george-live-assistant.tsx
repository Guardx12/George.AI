"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Flame, Loader2, MessageSquareText, Mic, Weight } from "lucide-react"
import {
  buildMealPlan,
  foods,
  type ActivityLevel,
  type DietaryPreference,
  type Goal,
  type Profile,
  type Sex,
} from "@/lib/coach-george/coach-george-nutrition"

type LiveMessage = {
  id: string
  role: "assistant" | "user" | "system"
  content: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error"
type CoachingStyle = "supportive" | "balanced" | "strict"

type StatsState = {
  caloriesLeft: number
  proteinLeft: number
  currentWeightKg: number
  mealsToday: number
  dayStreak: number
}

type StoredSession = {
  messages: LiveMessage[]
  visitorName: string | null
  updatedAt: number
  profile: Profile
  coachingStyle: CoachingStyle
  stats: StatsState
  lastActiveDate: string
}

const SESSION_KEY = "coach-george-session-v2"

const INITIAL_MESSAGES: LiveMessage[] = [
  {
    id: "intro",
    role: "assistant",
    content: "Hi — I'm Coach George. Complete your profile, then tap to talk and I'll coach your meals and training.",
  },
]

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

function trimMessagesForStorage(messages: LiveMessage[]) {
  return messages.slice(-36)
}

export function CoachGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<LiveMessage[]>(INITIAL_MESSAGES)
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [hasStoredSession, setHasStoredSession] = useState(false)
  const [visitorName, setVisitorName] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [coachingStyle, setCoachingStyle] = useState<CoachingStyle>("balanced")
  const [planSummary, setPlanSummary] = useState<string>("No plan built yet.")
  const [latestWeightInput, setLatestWeightInput] = useState<string>(DEFAULT_PROFILE.currentWeightKg.toString())

  const [stats, setStats] = useState<StatsState>({
    caloriesLeft: 0,
    proteinLeft: 0,
    currentWeightKg: DEFAULT_PROFILE.currentWeightKg,
    mealsToday: 0,
    dayStreak: 1,
  })

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentAssistantTextRef = useRef("")
  const currentAssistantMessageIdRef = useRef<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)

  const canStart = useMemo(() => connectionState === "idle" || connectionState === "error", [connectionState])

  useEffect(() => {
    const computed = buildMealPlan(profile)
    setStats((prev) => ({
      ...prev,
      caloriesLeft: Math.max(0, computed.targets.calories - computed.totals.calories),
      proteinLeft: Math.max(0, computed.targets.protein - computed.totals.protein),
      currentWeightKg: profile.currentWeightKg,
    }))
  }, [profile])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY)
      if (!raw) return
      const stored = JSON.parse(raw) as StoredSession
      if (!Array.isArray(stored.messages)) return
      setMessages(stored.messages.length ? stored.messages : INITIAL_MESSAGES)
      setProfile(stored.profile ?? DEFAULT_PROFILE)
      setCoachingStyle(stored.coachingStyle ?? "balanced")
      setStats(stored.stats)
      setLatestWeightInput((stored.profile?.currentWeightKg ?? DEFAULT_PROFILE.currentWeightKg).toString())
      setHasStoredSession(true)
      setVisitorName(stored.visitorName || detectVisitorName(stored.messages))

      const today = new Date().toISOString().slice(0, 10)
      if (stored.lastActiveDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
        setStats((prev) => ({ ...prev, mealsToday: 0, dayStreak: stored.lastActiveDate === yesterday ? prev.dayStreak + 1 : 1 }))
      }
    } catch {
      // ignore corrupted storage
    }
  }, [])

  useEffect(() => {
    try {
      const trimmed = trimMessagesForStorage(messages)
      const detectedName = visitorName || detectVisitorName(trimmed)
      if (detectedName && detectedName !== visitorName) setVisitorName(detectedName)
      if (!trimmed.length) return
      const payload: StoredSession = {
        messages: trimmed,
        visitorName: detectedName,
        updatedAt: Date.now(),
        profile,
        coachingStyle,
        stats,
        lastActiveDate: new Date().toISOString().slice(0, 10),
      }
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
      setHasStoredSession(true)
    } catch {
      // ignore storage errors
    }
  }, [messages, visitorName, profile, coachingStyle, stats])

  useEffect(() => {
    return () => {
      void cleanupConversation()
    }
  }, [])

  useEffect(() => {
    if (!chatScrollRef.current) return
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [messages])

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

  function sendTextToCoach(text: string) {
    const channel = dcRef.current
    if (!channel || channel.readyState !== "open") {
      setMessages((prev) => [
        ...prev,
        makeMessage("assistant", "Connect voice first, then I'll answer and coach this live in chat too."),
      ])
      return
    }

    channel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
      }),
    )
    channel.send(JSON.stringify({ type: "response.create" }))
  }

  async function startConversation() {
    if (!canStart) return
    await cleanupConversation()
    setConnectionState("connecting")
    setError(null)

    try {
      const tokenResponse = await fetch("/api/george-session", {
        method: "GET",
        cache: "no-store",
      })

      const tokenData = await tokenResponse.json().catch(() => null)
      if (!tokenResponse.ok) throw new Error(tokenData?.error || "Could not create a secure live session.")

      const ephemeralKey = tokenData?.client_secret?.value || tokenData?.value
      if (!ephemeralKey) throw new Error("Live voice token was missing.")

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
        const intro = hasStoredSession
          ? `Welcome back${visitorName ? ` ${visitorName}` : ""}. Continue coaching me in a ${coachingStyle} style. My goal is ${profile.goal}.`
          : `Introduce yourself as Coach George and ask one question so we can start the fitness session.`
        dataChannel.send(JSON.stringify({ type: "response.create", response: { instructions: intro } }))
      })

      dataChannel.addEventListener("message", (event) => {
        try {
          handleRealtimeEvent(JSON.parse(event.data))
        } catch {
          // ignore bad payloads
        }
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${ephemeralKey}`, "Content-Type": "application/sdp" },
        body: offer.sdp,
      })

      const answer = await sdpResponse.text()
      if (!sdpResponse.ok) throw new Error(answer || "Could not connect George.")

      await pc.setRemoteDescription({ type: "answer", sdp: answer })
      pc.addEventListener("connectionstatechange", () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) setConnectionState("error")
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

  function buildMyPlan() {
    const result = buildMealPlan(profile)
    const summary = [
      `Target: ${result.targets.calories} kcal | ${result.targets.protein}g protein`,
      ...result.plan.map(
        (meal, index) =>
          `${index + 1}. ${meal.name} (${meal.nutrition.calories} kcal, ${meal.nutrition.protein}g protein) - ${meal.ingredients
            .map((i) => `${foods.find((f) => f.id === i.foodId)?.name || i.foodId} ${i.grams}g`)
            .join(", ")}`,
      ),
    ].join("\n")

    setPlanSummary(summary)
    setStats((prev) => ({
      ...prev,
      caloriesLeft: Math.max(0, result.targets.calories - result.totals.calories),
      proteinLeft: Math.max(0, result.targets.protein - result.totals.protein),
      mealsToday: result.plan.length,
    }))

    const coachingPrompt = `Build my daily plan from this profile: ${JSON.stringify(profile)}. Keep coaching style ${coachingStyle}.`
    setMessages((prev) => [...prev, makeMessage("user", "Build my plan from my saved profile."), makeMessage("assistant", summary)])
    sendTextToCoach(coachingPrompt)
  }

  function updateWeight() {
    const value = Number(latestWeightInput)
    if (!Number.isFinite(value) || value < 35 || value > 350) {
      setError("Please enter a valid weight in kg.")
      return
    }
    setError(null)
    setProfile((prev) => ({ ...prev, currentWeightKg: value }))
    setStats((prev) => ({ ...prev, currentWeightKg: value }))
    setMessages((prev) => [...prev, makeMessage("assistant", `Weight updated to ${value}kg. Targets refreshed.`)])
  }

  function resetGoalsAndStats() {
    setProfile(DEFAULT_PROFILE)
    setCoachingStyle("balanced")
    setStats({ caloriesLeft: 0, proteinLeft: 0, currentWeightKg: DEFAULT_PROFILE.currentWeightKg, mealsToday: 0, dayStreak: 1 })
    setPlanSummary("No plan built yet.")
    setMessages(INITIAL_MESSAGES)
    window.localStorage.removeItem(SESSION_KEY)
    setHasStoredSession(false)
  }

  return (
    <section className="bg-[#060a12] px-3 py-4 text-white sm:px-4 sm:py-8">
      <div className="mx-auto grid w-full max-w-[1080px] gap-4 lg:grid-cols-[350px,1fr]">
        <aside className="rounded-[28px] border border-white/10 bg-gradient-to-b from-[#0f1727] to-[#090f1a] p-4 shadow-[0_0_80px_rgba(93,123,255,0.12)] sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#9fb4dc]">Profile</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <label className="col-span-2">Goal
              <select value={profile.goal} onChange={(e) => setProfile((p) => ({ ...p, goal: e.target.value as Goal }))} className="mt-1 w-full rounded-xl bg-white/5 p-2">
                <option value="lose-fat">Lose fat</option><option value="recomp">Recomp</option><option value="gain-muscle">Gain muscle</option>
              </select>
            </label>
            <label>Sex<select value={profile.sex} onChange={(e) => setProfile((p) => ({ ...p, sex: e.target.value as Sex }))} className="mt-1 w-full rounded-xl bg-white/5 p-2"><option value="male">Male</option><option value="female">Female</option></select></label>
            <label>Age<input value={profile.age} onChange={(e) => setProfile((p) => ({ ...p, age: Number(e.target.value) || 0 }))} type="number" className="mt-1 w-full rounded-xl bg-white/5 p-2" /></label>
            <label>Height (cm)<input value={profile.heightCm} onChange={(e) => setProfile((p) => ({ ...p, heightCm: Number(e.target.value) || 0 }))} type="number" className="mt-1 w-full rounded-xl bg-white/5 p-2" /></label>
            <label>Weight (kg)<input value={profile.currentWeightKg} onChange={(e) => setProfile((p) => ({ ...p, currentWeightKg: Number(e.target.value) || 0 }))} type="number" className="mt-1 w-full rounded-xl bg-white/5 p-2" /></label>
            <label className="col-span-2">Activity<select value={profile.activityLevel} onChange={(e) => setProfile((p) => ({ ...p, activityLevel: e.target.value as ActivityLevel }))} className="mt-1 w-full rounded-xl bg-white/5 p-2"><option value="sedentary">Sedentary</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="active">Active</option><option value="very-active">Very active</option></select></label>
            <label className="col-span-2">Allergies (comma separated)<input value={profile.allergies.join(", ")} onChange={(e) => setProfile((p) => ({ ...p, allergies: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) }))} className="mt-1 w-full rounded-xl bg-white/5 p-2" /></label>
            <label className="col-span-2">Disliked foods<input value={profile.dislikedFoods.join(", ")} onChange={(e) => setProfile((p) => ({ ...p, dislikedFoods: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) }))} className="mt-1 w-full rounded-xl bg-white/5 p-2" /></label>
            <label>Meals/day<select value={profile.mealsPerDay} onChange={(e) => setProfile((p) => ({ ...p, mealsPerDay: Number(e.target.value) as 3 | 4 | 5 }))} className="mt-1 w-full rounded-xl bg-white/5 p-2"><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option></select></label>
            <label>Diet<select value={profile.dietaryPreference} onChange={(e) => setProfile((p) => ({ ...p, dietaryPreference: e.target.value as DietaryPreference }))} className="mt-1 w-full rounded-xl bg-white/5 p-2"><option value="omnivore">Omnivore</option><option value="vegetarian">Vegetarian</option><option value="pescatarian">Pescatarian</option><option value="vegan">Vegan</option></select></label>
            <label className="col-span-2">Coaching style<select value={coachingStyle} onChange={(e) => setCoachingStyle(e.target.value as CoachingStyle)} className="mt-1 w-full rounded-xl bg-white/5 p-2"><option value="supportive">Supportive</option><option value="balanced">Balanced</option><option value="strict">Strict</option></select></label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 text-sm">
            <button onClick={buildMyPlan} type="button" className="rounded-2xl border border-white/20 bg-[#17325b] px-3 py-2 font-semibold">Build My Plan</button>
            <div className="flex gap-2"><input value={latestWeightInput} onChange={(e) => setLatestWeightInput(e.target.value)} placeholder="Weight kg" className="min-w-0 flex-1 rounded-2xl bg-white/5 px-3 py-2" />
              <button onClick={updateWeight} type="button" className="rounded-2xl border border-white/20 bg-white/10 px-3"><Weight className="h-4 w-4"/></button></div>
            <button onClick={resetGoalsAndStats} type="button" className="rounded-2xl border border-red-300/30 bg-red-950/20 px-3 py-2">Reset Goals / Stats</button>
          </div>
        </aside>

        <div className="rounded-[28px] border border-white/10 bg-gradient-to-b from-[#0f1727] to-[#090f1a] p-4 shadow-[0_0_80px_rgba(93,123,255,0.12)] sm:p-5">
          <div className="rounded-3xl border border-white/10 bg-[#0a1120]/90 p-4">
            <button
              type="button"
              onClick={connectionState === "connected" ? stopConversation : startConversation}
              disabled={connectionState === "connecting"}
              className={`mx-auto flex h-[150px] w-[150px] items-center justify-center rounded-full ${connectionState === "connected" ? "animate-pulse" : ""}`}
              style={{ background: "radial-gradient(circle at 32% 26%, #284775 0%, #1a2e52 52%, #0d1a33 100%)" }}
            >
              {connectionState === "connecting" ? <Loader2 className="h-10 w-10 animate-spin" /> : <Mic className="h-10 w-10" />}
            </button>
            <p className="mt-3 text-center text-lg font-semibold">Tap to Talk</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Calories left</p><p className="text-xl font-semibold">{stats.caloriesLeft}</p></div>
            <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Protein left</p><p className="text-xl font-semibold">{stats.proteinLeft}g</p></div>
            <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Current weight</p><p className="text-xl font-semibold">{stats.currentWeightKg}kg</p></div>
            <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Meals today</p><p className="text-xl font-semibold">{stats.mealsToday}</p></div>
            <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-[#8ea5cc]">Day streak</p><p className="inline-flex items-center gap-1 text-xl font-semibold"><Flame className="h-4 w-4 text-orange-300" />{stats.dayStreak}</p></div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <button onClick={buildMyPlan} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-medium text-[#d5e3ff]">Build My Plan</button>
            <button onClick={updateWeight} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-medium text-[#d5e3ff]">Update Weight</button>
            <button onClick={resetGoalsAndStats} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-medium text-[#d5e3ff]">Reset Goals / Stats</button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-[#0a1222] p-3 text-xs text-[#c9d9f8] whitespace-pre-wrap">{planSummary}</div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-[#0a1222] p-3">
            <div className="mb-3 flex items-center gap-2 px-1"><MessageSquareText className="h-4 w-4" /><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9fb4dc]">Live Chat</p></div>
            <div ref={chatScrollRef} className="h-[320px] sm:h-[400px] space-y-3 overflow-y-auto rounded-2xl bg-white/[0.03] p-3">
              {messages.map((message) => {
                const isUser = message.role === "user"
                return (
                  <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-6 ${isUser ? "bg-[#365fa5] text-white" : "border border-white/10 bg-[#121f35] text-[#dce8ff]"}`}>
                      {message.content}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button onClick={() => sendTextToCoach("Build me a training plan for 45 minutes today.")} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1">Workout now</button>
            <button onClick={() => sendTextToCoach("I went off track. Help me reset today.")} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1">Went off track</button>
            <button onClick={() => sendTextToCoach("What should I eat for my next meal based on my plan?")} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1">What should I eat</button>
          </div>

          {error ? <p className="mt-3 text-sm text-[#ff8892]">{error}</p> : null}
          {hasStoredSession ? <p className="mt-2 text-[11px] text-[#8ea5cc]">Session restored from this device.</p> : null}
        </div>
      </div>
    </section>
  )
}
