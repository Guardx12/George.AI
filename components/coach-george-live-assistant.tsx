"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Mic, Send, Square } from "lucide-react";

type ConnectionState = "idle" | "connecting" | "connected" | "error";
type MessageRole = "assistant" | "user";
type Goal = "fat-loss" | "strength" | "boxing" | "running" | "general-health" | "maintenance" | "muscle" | "unknown";
type TrackerApp = "NutriCheck" | "MyFitnessPal" | "Cronometer" | "Lose It" | "Other" | "None yet" | "unknown";
type OnboardingStep = "goal" | "weight" | "target" | "training" | "struggle" | "tracker" | "ready";

type LiveMessage = { id: string; role: MessageRole; content: string; createdAt: string };

type CoachProfile = {
  name: string;
  goal: Goal;
  currentWeightKg: string;
  targetWeightKg: string;
  trainingFocus: string;
  biggestStruggle: string;
  foodStyle: string;
  trackerApp: TrackerApp;
  calorieTarget: string;
  proteinTarget: string;
  onboardingStep: OnboardingStep;
};

type CoachingMemory = {
  notes: string[];
  patterns: string[];
  lastSummary: string;
  updatedAt: string | null;
};

type CoachState = {
  profile: CoachProfile;
  memory: CoachingMemory;
  messages: LiveMessage[];
  voiceReplies: boolean;
};

const STORAGE_KEY = "coach-george-conversation-v1";
const LEGACY_KEYS = ["coach-george-voice-first-v1", "coach-george-transformation-v5", "coach-george-transformation-v3"];

const GOAL_LABELS: Record<Goal, string> = {
  "fat-loss": "fat loss",
  strength: "strength",
  boxing: "boxing fitness",
  running: "running fitness",
  "general-health": "general health",
  maintenance: "maintenance",
  muscle: "building muscle",
  unknown: "your goal",
};

function uid(prefix = "id") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeMessage(role: MessageRole, content: string): LiveMessage {
  return { id: uid(role), role, content, createdAt: new Date().toISOString() };
}

function normalize(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function defaultProfile(): CoachProfile {
  return {
    name: "",
    goal: "unknown",
    currentWeightKg: "",
    targetWeightKg: "",
    trainingFocus: "",
    biggestStruggle: "",
    foodStyle: "",
    trackerApp: "unknown",
    calorieTarget: "",
    proteinTarget: "",
    onboardingStep: "goal",
  };
}

const INITIAL_STATE: CoachState = {
  profile: defaultProfile(),
  memory: { notes: [], patterns: [], lastSummary: "", updatedAt: null },
  messages: [makeMessage("assistant", "Before I coach you properly, let me learn a bit about you. What are we working towards?")],
  voiceReplies: true,
};

function buildVoiceRendererInstructions() {
  return [
    "You are Coach George's voice renderer.",
    "Only speak the exact text provided by the app.",
    "Do not add, remove, reword, explain, diagnose, or improvise.",
    "Sound warm, calm, straight-talking and human. Never sound robotic.",
  ].join(" ");
}

function buildRealtimeSessionPayload(instructions: string) {
  return {
    type: "realtime",
    instructions,
    audio: {
      input: {
        transcription: { model: "gpt-4o-mini-transcribe", language: "en" },
        turn_detection: { type: "semantic_vad", eagerness: "high", create_response: false, interrupt_response: true },
      },
      output: { voice: "cedar", speed: 0.98 },
    },
  };
}

function isInScope(text: string) {
  return /(food|meal|eat|eating|hungry|hunger|craving|snack|calorie|macro|protein|carb|fat|tracker|nutricheck|myfitnesspal|fitness pal|cronometer|lose it|weight|scale|weigh|gain|lost|loss|fat|muscle|training|workout|gym|run|running|boxing|cardio|strength|steps|walk|motivation|struggling|quit|give up|reset|goal|routine|habit|sleep|stress|water|takeaway|restaurant|off plan|bad day|binge|injury|pain|hurt|tired|energy|recovery|breakfast|lunch|dinner|tonight|today|tomorrow|weekend|start|learn|coach|track|progress|body|shape|fit|fitness|health|diet|cut|bulk|maintain|kilogram|kg|stone)/.test(text);
}

function detectGoal(text: string): Goal | null {
  if (/fat loss|lose weight|lose fat|weight loss|cut|slim/.test(text)) return "fat-loss";
  if (/boxing|fight|bag work|pads/.test(text)) return "boxing";
  if (/strength|stronger|weights|powerlifting/.test(text)) return "strength";
  if (/running|run|10k|5k|marathon/.test(text)) return "running";
  if (/maintenance|maintain/.test(text)) return "maintenance";
  if (/muscle|bulk|build size|hypertrophy/.test(text)) return "muscle";
  if (/general health|healthier|fitness|fit/.test(text)) return "general-health";
  return null;
}

function detectTracker(text: string): TrackerApp | null {
  if (/nutricheck/.test(text)) return "NutriCheck";
  if (/myfitnesspal|fitness pal/.test(text)) return "MyFitnessPal";
  if (/cronometer/.test(text)) return "Cronometer";
  if (/lose it/.test(text)) return "Lose It";
  if (/no tracker|none yet|don t track|dont track|not tracking/.test(text)) return "None yet";
  if (/tracker|tracking app|food app/.test(text)) return "Other";
  return null;
}

function detectWeight(text: string) {
  const kg = text.match(/\b(\d{2,3}(?:\.\d)?)\s*(kg|kilos|kilograms)\b/);
  if (kg) return kg[1];
  const plain = text.match(/(?:weigh|weight|currently|i m|im|i am|about|around|roughly)\s*(\d{2,3}(?:\.\d)?)/);
  if (plain) return plain[1];
  const number = text.match(/\b(\d{2,3}(?:\.\d)?)\b/);
  return number?.[1] || "";
}

function updateProfileFromText(raw: string, current: CoachProfile): CoachProfile {
  const text = normalize(raw);
  const next = { ...current };
  const goal = detectGoal(text);
  const tracker = detectTracker(text);
  const weight = detectWeight(text);

  if (goal) next.goal = goal;
  if (tracker) next.trackerApp = tracker;

  if (/(target|goal weight|want to be|get to|down to|aiming for|eventually)/.test(text) && weight) next.targetWeightKg = weight;
  else if (weight && !next.currentWeightKg && next.onboardingStep === "weight") next.currentWeightKg = weight;
  else if (weight && !next.targetWeightKg && next.onboardingStep === "target") next.targetWeightKg = weight;

  if (/boxing|bag|pads|fight/.test(text)) next.trainingFocus = "boxing and conditioning";
  else if (/running|run|10k|5k|marathon/.test(text)) next.trainingFocus = "running";
  else if (/gym|weights|strength/.test(text)) next.trainingFocus = "gym strength training";
  else if (/home|kettlebell|bodyweight/.test(text)) next.trainingFocus = "home training";
  else if (/walking|steps/.test(text)) next.trainingFocus = "walking and steps";
  else if (/nothing yet|not training|no training|starting from scratch/.test(text)) next.trainingFocus = "starting from scratch";

  if (/late night|night eating|evening|after dinner/.test(text)) next.biggestStruggle = "late-night eating";
  else if (/hunger|hungry|cravings|starving/.test(text)) next.biggestStruggle = "hunger and cravings";
  else if (/motivation|consistency|fall off|quit|momentum/.test(text)) next.biggestStruggle = "consistency";
  else if (/scale|weigh|weigh in/.test(text)) next.biggestStruggle = "scale anxiety";
  else if (/weekend|takeaway|alcohol|social/.test(text)) next.biggestStruggle = "weekends and social food";

  if (/simple|easy|same meals|repeat/.test(text)) next.foodStyle = "simple repeatable meals";
  else if (/flexible|variety|normal food/.test(text)) next.foodStyle = "flexible normal food";

  return advanceOnboarding(next);
}

function advanceOnboarding(profile: CoachProfile): CoachProfile {
  let step: OnboardingStep = "ready";
  if (profile.goal === "unknown") step = "goal";
  else if (!profile.currentWeightKg) step = "weight";
  else if (profile.goal === "fat-loss" && !profile.targetWeightKg) step = "target";
  else if (!profile.trainingFocus) step = "training";
  else if (!profile.biggestStruggle) step = "struggle";
  else if (profile.trackerApp === "unknown") step = "tracker";
  return { ...profile, onboardingStep: step };
}

function nextOnboardingReply(profile: CoachProfile) {
  switch (profile.onboardingStep) {
    case "goal":
      return "Before I coach you properly, let me learn a bit about you. What are we working towards?";
    case "weight":
      return `${GOAL_LABELS[profile.goal]} — got it. Roughly what do you weigh at the moment?`;
    case "target":
      return "Good. What would you like to get down to eventually? Rough number is fine.";
    case "training":
      return "What training are we working with right now — gym, home, walking, running, boxing, or nothing yet?";
    case "struggle":
      return "What normally knocks you off track — hunger, evenings, weekends, motivation, or the scale?";
    case "tracker":
      return "Do you track exact numbers anywhere — a tracking app, notes, or not yet?";
    case "ready":
      return "Perfect. I’ve got enough to coach you properly. Talk to me — what’s the situation today?";
  }
}

function addUnique(existing: string[], incoming: string[], max = 18) {
  const seen = new Set(existing.map((item) => item.toLowerCase()));
  const merged = [...existing];
  incoming.forEach((item) => { if (!seen.has(item.toLowerCase())) merged.push(item); });
  return merged.slice(-max);
}

function inferMemory(raw: string) {
  const text = normalize(raw);
  const notes: string[] = [];
  const patterns: string[] = [];
  if (/hungry|starving|craving|snack/.test(text)) { notes.push("Hunger came up."); patterns.push("Hunger may be a recurring challenge."); }
  if (/weight went up|scale|heavier|gained/.test(text)) { notes.push("Scale worry came up."); patterns.push("Reassure using trends, not single weigh-ins."); }
  if (/messed up|fell off|binge|bad day|takeaway|ruined/.test(text)) { notes.push("Rescue mode came up."); patterns.push("Bad days need calm reset coaching, not guilt."); }
  if (/late night|night|evening/.test(text)) { notes.push("Evening risk came up."); patterns.push("Evenings may be a weak point."); }
  if (/motivation|quit|give up|struggling/.test(text)) { notes.push("Motivation dip came up."); patterns.push("Short next actions work better than big lectures."); }
  if (/boxing|fight|bag|conditioning/.test(text)) { notes.push("Boxing identity came up."); patterns.push("Boxing goals can be used as motivation."); }
  return { notes, patterns };
}

function profileSnapshot(profile: CoachProfile) {
  const bits = [];
  if (profile.goal !== "unknown") bits.push(GOAL_LABELS[profile.goal]);
  if (profile.currentWeightKg) bits.push(`${profile.currentWeightKg}kg`);
  if (profile.targetWeightKg) bits.push(`target ${profile.targetWeightKg}kg`);
  if (profile.biggestStruggle) bits.push(profile.biggestStruggle);
  return bits.join(" · ");
}

function buildCoachReply(rawInput: string, state: CoachState, profileAfterInput: CoachProfile) {
  const input = normalize(rawInput);
  const wasOnboarding = state.profile.onboardingStep !== "ready";

  if (!isInScope(input)) {
    return "I’m your coach, mate — food, training, weight, habits, bad days, and staying on track. Bring me the thing that’s trying to knock you off course and I’ll help with that.";
  }

  if (wasOnboarding && profileAfterInput.onboardingStep !== "ready") return nextOnboardingReply(profileAfterInput);
  if (wasOnboarding && profileAfterInput.onboardingStep === "ready") return nextOnboardingReply(profileAfterInput);

  if (/which tracker|what tracker|tracking app|what app|nutricheck|myfitnesspal|fitness pal|cronometer|lose it/.test(input)) {
    return "Use any tracker you like for exact numbers — NutriCheck, MyFitnessPal, Cronometer, Lose It, whatever works. Give me the situation and I’ll help you make the right decision.";
  }

  if (/hungry|starving|craving|snack/.test(input)) {
    const struggle = state.profile.biggestStruggle ? `I know ${state.profile.biggestStruggle} can be a weak spot for you, so we keep this simple.` : "We keep this simple.";
    return `${struggle} Is this real hunger, boredom, or stress? If it’s real hunger, go protein plus volume first — then tell me what you’ve got available.`;
  }

  if (/what should i eat|what to eat|eat tonight|dinner|next meal|lunch|breakfast/.test(input)) {
    return "Give me three things: what you’ve eaten today, how hungry you are, and whether you’re training. Then I’ll tell you the best type of meal to go for — exact grams can stay in your tracker.";
  }

  if (/messed up|fell off|off plan|bad day|binge|ruined|takeaway|pizza|kebab/.test(input)) {
    return "You haven’t ruined anything. Don’t turn one rough meal into a rough week. Water, next normal meal, protein high, routine back on. What happened — takeaway, snacks, alcohol, or just a messy day?";
  }

  if (/weight went up|scale went up|gained|heavier|water weight|stall|plateau/.test(input)) {
    return "Don’t react to one weigh-in. Usually it’s water, food, salt, soreness, stress or sleep — not sudden fat gain. Tell me: is the 7-day trend up, flat, or still coming down?";
  }

  if (/workout|training|gym|home|boxing|run|running|cardio|strength/.test(input)) {
    if (!/home|gym|boxing|running|run|strength|weights|walk|kettlebell|bodyweight|minutes|hour/.test(input)) return "I’ll make it specific. Where are you training and how long have you got?";
    if (/boxing/.test(input) || state.profile.goal === "boxing") return "Boxing focus today: warm up, controlled rounds, then a small strength finisher. Build the engine — don’t bury yourself. How fit are you feeling out of 10?";
    if (/running|run/.test(input) || state.profile.goal === "running") return "Keep it easy enough that you could repeat it. We’re building consistency first. Are your joints feeling okay today?";
    return "Simple and repeatable: squat, push, pull, carry, then a short finisher. Don’t chase hero sessions. How long have you got?";
  }

  if (/calorie|macro|protein|target|left/.test(input)) {
    return "Use your tracker for the exact numbers. Send me calories left, protein left, hunger level, and training today — I’ll tell you the smartest move.";
  }

  if (/injury|pain|hurt|dizzy|chest pain|faint|sick/.test(input)) {
    return "Play this safe. Don’t push through pain, dizziness, chest pain or anything worrying. I can help you adjust around minor aches, but proper symptoms need a professional.";
  }

  if (/reset|change goal|new goal|start again|different goal|switch/.test(input)) {
    return "We can change direction without wiping everything. Tell me what’s changed: the goal, the training, the food approach, or your motivation?";
  }

  if (/motivation|struggling|can t be bothered|cant be bothered|quit|give up|no motivation/.test(input)) {
    return "Right, we shrink the day. Don’t solve your whole life. Win the next 30 minutes: water, one decent meal, or a walk. Which one is easiest right now?";
  }

  return "Talk me through it like you would with a real coach. What’s happened, what are you tempted to do, and what do you need from me right now?";
}

export function CoachGeorgeLiveAssistant() {
  const [state, setState] = useState<CoachState>(INITIAL_STATE);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [textInput, setTextInput] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const stateRef = useRef<CoachState>(INITIAL_STATE);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const greetedSessionRef = useRef(false);
  const lastHandledRef = useRef<{ text: string; at: number } | null>(null);

  const latestAssistant = useMemo(
    () => [...state.messages].reverse().find((message) => message.role === "assistant")?.content || "Talk to me. What’s the situation today?",
    [state.messages],
  );

  const visibleMessages = useMemo(() => state.messages.slice(-18), [state.messages]);
  const canStart = hydrated && (connectionState === "idle" || connectionState === "error");
  const voiceLive = connectionState === "connected";
  const snapshot = profileSnapshot(state.profile);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY) || LEGACY_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CoachState>;
        const profile = advanceOnboarding({ ...defaultProfile(), ...(parsed.profile || {}) });
        setState({
          ...INITIAL_STATE,
          ...parsed,
          profile,
          memory: { ...INITIAL_STATE.memory, ...(parsed.memory || {}) },
          messages: (parsed.messages || INITIAL_STATE.messages).slice(-60),
          voiceReplies: parsed.voiceReplies ?? true,
        });
      }
    } catch {
      // keep clean initial state
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, messages: state.messages.slice(-60) }));
  }, [state, hydrated]);

  useEffect(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, [state.messages]);
  useEffect(() => () => { void cleanupConversation(); }, []);

  function appendMessage(role: MessageRole, content: string) {
    setState((prev) => ({ ...prev, messages: [...prev.messages.slice(-59), makeMessage(role, content)] }));
  }

  function speakIfConnected(textToSpeak: string) {
    if (!stateRef.current.voiceReplies) return;
    const channel = dcRef.current;
    const safeText = textToSpeak.trim();
    if (!safeText || !channel || channel.readyState !== "open") return;
    channel.send(JSON.stringify({
      type: "response.create",
      response: {
        conversation: "none",
        output_modalities: ["audio"],
        input: [{
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: `Speak this exact text only. Do not add anything.\n\n${safeText}` }],
        }],
      },
    }));
  }

  function respond(content: string) {
    appendMessage("assistant", content);
    speakIfConnected(content);
  }

  function handleUserInput(raw: string) {
    const cleaned = raw.trim();
    if (!cleaned) return;
    const normalized = normalize(cleaned);
    const last = lastHandledRef.current;
    if (last && last.text === normalized && Date.now() - last.at < 1200) return;
    lastHandledRef.current = { text: normalized, at: Date.now() };

    const current = stateRef.current;
    const nextProfile = updateProfileFromText(cleaned, current.profile);
    const reply = buildCoachReply(cleaned, current, nextProfile);
    const { notes, patterns } = inferMemory(cleaned);

    setState((prev) => ({
      ...prev,
      profile: updateProfileFromText(cleaned, prev.profile),
      messages: [...prev.messages.slice(-58), makeMessage("user", cleaned), makeMessage("assistant", reply)],
      memory: notes.length || patterns.length ? {
        notes: addUnique(prev.memory.notes, notes),
        patterns: addUnique(prev.memory.patterns, patterns),
        lastSummary: notes[0] || prev.memory.lastSummary,
        updatedAt: new Date().toISOString(),
      } : prev.memory,
    }));

    speakIfConnected(reply);
  }

  function handleTextSubmit(event?: FormEvent) {
    event?.preventDefault();
    const value = textInput;
    setTextInput("");
    handleUserInput(value);
  }

  async function cleanupConversation() {
    dcRef.current?.close();
    dcRef.current = null;
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => sender.track?.stop());
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }
  }

  async function startConversation() {
    if (!canStart) return;
    greetedSessionRef.current = false;
    await cleanupConversation();
    setConnectionState("connecting");
    setError(null);
    try {
      const tokenResponse = await fetch("/api/george-session", { method: "GET", cache: "no-store" });
      const tokenData = await tokenResponse.json().catch(() => null);
      if (!tokenResponse.ok) throw new Error(tokenData?.error || "Could not create a secure live session.");
      const ephemeralKey = tokenData?.value || tokenData?.client_secret?.value;
      if (!ephemeralKey) throw new Error("Live voice token was missing.");

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const remoteAudio = document.createElement("audio");
      remoteAudio.autoplay = true;
      remoteAudio.setAttribute("playsinline", "true");
      remoteAudio.preload = "auto";
      remoteAudio.style.display = "none";
      document.body.appendChild(remoteAudio);
      audioRef.current = remoteAudio;

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) {
          remoteAudio.srcObject = remoteStream;
          void remoteAudio.play().catch(() => setError("Audio playback was blocked by the browser."));
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const dataChannel = pc.createDataChannel("oai-events");
      dcRef.current = dataChannel;
      dataChannel.addEventListener("open", () => {
        setConnectionState("connected");
        dataChannel.send(JSON.stringify({ type: "session.update", session: buildRealtimeSessionPayload(buildVoiceRendererInstructions()) }));
        if (!greetedSessionRef.current) {
          greetedSessionRef.current = true;
          const opener = getOpeningLine(stateRef.current);
          appendMessage("assistant", opener);
          speakIfConnected(opener);
        }
      });
      dataChannel.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === "conversation.item.input_audio_transcription.completed") {
            handleUserInput(typeof payload.transcript === "string" ? payload.transcript : "");
          }
          if (payload?.type === "error") setError(payload?.error?.message || "George hit a voice error.");
        } catch {
          // ignore malformed events
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${ephemeralKey}`, "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      const answer = await sdpResponse.text();
      if (!sdpResponse.ok) throw new Error(answer || "Could not connect George.");
      await pc.setRemoteDescription({ type: "answer", sdp: answer });
      pc.addEventListener("connectionstatechange", () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) setConnectionState("error");
      });
    } catch (err) {
      await cleanupConversation();
      setConnectionState("error");
      setError(err instanceof Error ? err.message : "Could not connect George right now.");
    }
  }

  async function stopConversation() {
    greetedSessionRef.current = false;
    await cleanupConversation();
    setConnectionState("idle");
    setError(null);
  }

  function getOpeningLine(current: CoachState) {
    if (current.profile.onboardingStep !== "ready") return nextOnboardingReply(current.profile);
    const pattern = current.memory.patterns.slice(-1)[0];
    if (pattern) return `I remember this pattern: ${pattern} What’s the situation today?`;
    return "Talk to me. What’s the situation today?";
  }

  const statusText = connectionState === "connected" ? "Listening" : connectionState === "connecting" ? "Connecting" : "Tap to talk";

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#050608] text-white">
      <div className="absolute inset-0 bg-[url('/coach-george-gym-bg.jpeg')] bg-cover bg-center opacity-[0.18] blur-[5px] scale-110" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(244,219,176,0.20),rgba(16,17,20,0.28)_32%,rgba(0,0,0,0.95)_78%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.14),rgba(0,0,0,0.78)_55%,rgba(0,0,0,0.98))]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-5 pb-4 pt-7 sm:px-6">
        <div className="text-center">
          <button
            onClick={connectionState === "connected" || connectionState === "connecting" ? stopConversation : startConversation}
            disabled={!hydrated}
            className={`relative mx-auto flex h-[188px] w-[188px] items-center justify-center rounded-full border bg-black/62 p-[4px] transition disabled:opacity-60 ${voiceLive ? "border-[#f3dca3]/90 shadow-[0_0_90px_rgba(243,220,163,0.36)]" : "border-[#f3dca3]/48 shadow-[0_0_64px_rgba(243,220,163,0.20)]"}`}
            aria-label={voiceLive ? "Stop talking to Coach George" : "Talk to Coach George"}
          >
            <span className={`absolute inset-[-12px] rounded-full border border-[#f3dca3]/18 ${voiceLive ? "animate-pulse" : ""}`} />
            <span className="absolute left-[-72px] right-[-72px] top-1/2 h-px -translate-y-1/2 bg-[linear-gradient(90deg,transparent,rgba(243,220,163,.38),transparent)]" />
            <img src="/coach-george-avatar.png" alt="Coach George" className="relative h-full w-full rounded-full object-cover" />
            <span className="absolute bottom-3 right-3 flex h-14 w-14 items-center justify-center rounded-full border border-[#f3dca3]/55 bg-[#0b0b0c]/92 shadow-[0_0_30px_rgba(243,220,163,.24)]">
              {voiceLive ? <Square className="h-6 w-6 fill-[#f3dca3] text-[#f3dca3]" /> : <Mic className="h-7 w-7 text-[#f3dca3]" />}
            </span>
          </button>

          <h1 className="mt-5 text-[36px] font-semibold tracking-[-0.055em] text-white">Coach George</h1>
          <p className="mt-2 text-[15px] leading-6 text-white/66">Your coach for food, training and staying on track.</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#f3dca3]/85">{statusText}</p>
          {snapshot ? <p className="mx-auto mt-3 max-w-[340px] truncate text-xs text-white/38">{snapshot}</p> : null}
          {error ? <p className="mx-auto mt-3 max-w-[340px] text-center text-xs leading-5 text-red-200">{error}</p> : null}
        </div>

        <div className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.065] p-5 shadow-[0_18px_80px_rgba(0,0,0,0.44)] backdrop-blur-2xl">
          <p className="text-[17px] leading-7 text-white/92">{latestAssistant}</p>
        </div>

        <div ref={chatScrollRef} className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 pb-2">
          {visibleMessages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] whitespace-pre-wrap rounded-[24px] px-4 py-3 text-sm leading-6 shadow-[0_10px_32px_rgba(0,0,0,0.26)] ${message.role === "user" ? "bg-[#735f3c] text-white" : "border border-white/10 bg-white/[0.075] text-white/88 backdrop-blur-xl"}`}>
                {message.content}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleTextSubmit} className="mt-3 rounded-[26px] border border-white/10 bg-white/[0.075] p-2.5 backdrop-blur-2xl">
          <input
            value={textInput}
            onChange={(event) => setTextInput(event.target.value)}
            placeholder="Talk to George…"
            className="block w-full bg-transparent px-4 pb-3 pt-3 text-[15px] text-white outline-none placeholder:text-white/35"
          />
          <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-[20px] bg-[#735f3c] text-sm font-semibold text-white transition hover:bg-[#826d46]">
            Send <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </section>
  );
}
