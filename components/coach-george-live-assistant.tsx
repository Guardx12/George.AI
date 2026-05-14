"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, Mic, Send, Settings2, Trash2, Volume2, VolumeX, X } from "lucide-react";

type ConnectionState = "idle" | "connecting" | "connected" | "error";
type MessageRole = "assistant" | "user" | "system";
type Goal = "fat-loss" | "strength" | "boxing" | "running" | "general-health" | "maintenance" | "muscle";
type TrackerApp = "NutriCheck" | "MyFitnessPal" | "Cronometer" | "Lose It" | "Other" | "None yet";
type ProfileStatus = "new" | "started" | "complete";

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
  profileStatus: ProfileStatus;
};

type ActivePhase = {
  id: string;
  title: string;
  goal: Goal;
  startedAt: string;
  status: "active" | "paused" | "archived";
};

type CoachingMemory = {
  notes: string[];
  patterns: string[];
  lastSummary: string;
  updatedAt: string | null;
};

type CoachState = {
  profile: CoachProfile;
  activePhase: ActivePhase;
  archivedPhases: ActivePhase[];
  memory: CoachingMemory;
  messages: LiveMessage[];
  voiceReplies: boolean;
};

const STORAGE_KEY = "coach-george-voice-first-v1";
const LEGACY_KEYS = ["coach-george-transformation-v5", "coach-george-transformation-v3"];

const GOAL_LABELS: Record<Goal, string> = {
  "fat-loss": "Fat loss",
  strength: "Strength",
  boxing: "Boxing fitness",
  running: "Running fitness",
  "general-health": "General health",
  maintenance: "Maintenance",
  muscle: "Build muscle",
};

const TRACKERS: TrackerApp[] = ["None yet", "NutriCheck", "MyFitnessPal", "Cronometer", "Lose It", "Other"];
const PROMPTS = ["I’m hungry", "Weight went up", "Bad day"];

function uid(prefix = "id") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
    goal: "fat-loss",
    currentWeightKg: "",
    targetWeightKg: "",
    trainingFocus: "",
    biggestStruggle: "",
    foodStyle: "Flexible, simple meals",
    trackerApp: "None yet",
    calorieTarget: "",
    proteinTarget: "",
    profileStatus: "new",
  };
}

function defaultPhase(goal: Goal = "fat-loss"): ActivePhase {
  return { id: uid("phase"), title: GOAL_LABELS[goal], goal, startedAt: todayIso(), status: "active" };
}

const INITIAL_STATE: CoachState = {
  profile: defaultProfile(),
  activePhase: defaultPhase("fat-loss"),
  archivedPhases: [],
  memory: { notes: [], patterns: [], lastSummary: "", updatedAt: null },
  messages: [makeMessage("assistant", "Talk to me. What’s the situation today?")],
  voiceReplies: true,
};

function profileCompletion(profile: CoachProfile) {
  const fields = [profile.goal, profile.currentWeightKg, profile.trainingFocus, profile.biggestStruggle, profile.foodStyle];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function markProfileStatus(profile: CoachProfile): CoachProfile {
  return { ...profile, profileStatus: profileCompletion(profile) >= 80 ? "complete" : profileCompletion(profile) > 20 ? "started" : "new" };
}

function buildVoiceRendererInstructions() {
  return [
    "You are Coach George's voice renderer.",
    "Only speak the exact text provided by the app.",
    "Do not add, remove, reword, explain, diagnose, or improvise.",
    "Sound calm, warm, straight-talking and natural.",
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

function isInScope(input: string) {
  return /(food|meal|eat|eating|hungry|hunger|craving|snack|calorie|macro|protein|carb|fat|tracker|nutricheck|myfitnesspal|fitness pal|cronometer|lose it|weight|scale|weigh|gain|lost|loss|fat|muscle|training|workout|gym|run|running|boxing|cardio|strength|steps|walk|motivation|struggling|quit|give up|reset|goal|phase|plan|routine|habit|sleep|stress|water|takeaway|restaurant|off plan|bad day|binge|profile|setup|start|check in|injury|pain|hurt|tired|energy|recovery|coffee|breakfast|lunch|dinner|tonight|today|tomorrow|weekend)/.test(input);
}

function trackerPhrase(profile: CoachProfile) {
  if (profile.trackerApp && profile.trackerApp !== "None yet" && profile.trackerApp !== "Other") return profile.trackerApp;
  return "your tracker";
}

function extractProfileFromText(input: string, current: CoachProfile): CoachProfile {
  const text = normalize(input);
  const next = { ...current };

  if (/fat loss|lose weight|lose fat|just fat loss|weight loss/.test(text)) next.goal = "fat-loss";
  else if (/boxing|fight|bag work/.test(text)) next.goal = "boxing";
  else if (/strength|weights|stronger/.test(text)) next.goal = "strength";
  else if (/running|run|10k|5k/.test(text)) next.goal = "running";
  else if (/maintenance|maintain/.test(text)) next.goal = "maintenance";
  else if (/muscle|bulk|build size/.test(text)) next.goal = "muscle";
  else if (/general health|healthier|fitness/.test(text)) next.goal = "general-health";

  const number = text.match(/\b(\d{2,3}(?:\.\d)?)\s*(kg|kilos|kilograms|stone|st)?\b/);
  const currentWeight = text.match(/(?:weigh|weight|currently|i m|im|i am)\s*(\d{2,3}(?:\.\d)?)/);
  const targetMatch = text.match(/(?:target|goal weight|want to be|get to|down to|aiming for)\s*(\d{2,3}(?:\.\d)?)/);

  if (targetMatch) next.targetWeightKg = targetMatch[1];
  else if (currentWeight && !next.currentWeightKg) next.currentWeightKg = currentWeight[1];
  else if (number && !next.currentWeightKg) next.currentWeightKg = number[1];
  else if (number && next.currentWeightKg && !next.targetWeightKg && next.profileStatus !== "complete") next.targetWeightKg = number[1];

  if (/nutricheck/.test(text)) next.trackerApp = "NutriCheck";
  else if (/myfitnesspal|fitness pal/.test(text)) next.trackerApp = "MyFitnessPal";
  else if (/cronometer/.test(text)) next.trackerApp = "Cronometer";
  else if (/lose it/.test(text)) next.trackerApp = "Lose It";
  else if (/no tracker|none yet|don t track|dont track/.test(text)) next.trackerApp = "None yet";
  else if (/tracker|tracking app|food app/.test(text) && next.trackerApp === "None yet") next.trackerApp = "Other";

  if (/late night|night eating|evening|after dinner/.test(text)) next.biggestStruggle = "Late-night eating";
  else if (/hunger|hungry|cravings|starving/.test(text)) next.biggestStruggle = "Hunger and cravings";
  else if (/motivation|consistency|fall off|quit|momentum/.test(text)) next.biggestStruggle = "Consistency";
  else if (/scale|weigh|weigh in/.test(text)) next.biggestStruggle = "Scale anxiety";
  else if (/weekend|takeaway|alcohol/.test(text)) next.biggestStruggle = "Weekends and social food";

  if (/boxing|bag|pads|fight/.test(text)) next.trainingFocus = "Boxing and conditioning";
  else if (/running|run|10k|5k/.test(text)) next.trainingFocus = "Running fitness";
  else if (/gym|weights|strength/.test(text)) next.trainingFocus = "Gym strength training";
  else if (/home|kettlebell|bodyweight/.test(text)) next.trainingFocus = "Home training";
  else if (/walking|steps/.test(text)) next.trainingFocus = "Walking and steps";
  else if (/nothing yet|not training|no training/.test(text)) next.trainingFocus = "Starting from scratch";

  return markProfileStatus(next);
}

function nextOnboardingQuestion(profile: CoachProfile) {
  if (!profile.currentWeightKg) return `${GOAL_LABELS[profile.goal]} — nice. Roughly what do you weigh at the moment?`;
  if (!profile.targetWeightKg && profile.goal === "fat-loss") return "Got it. What would you like to get down to eventually? Rough number is fine.";
  if (!profile.trainingFocus) return "What training are we working with right now — gym, home, walking, running, boxing, or nothing yet?";
  if (!profile.biggestStruggle) return "What usually knocks you off track — hunger, evenings, weekends, motivation, or the scale?";
  if (!profile.trackerApp || profile.trackerApp === "None yet") return "Do you track exact numbers anywhere — NutriCheck, MyFitnessPal, Cronometer, Lose It, another app, or not yet?";
  return "Perfect. I’ve got enough to coach you properly. What do you need help with right now?";
}

function inferCoachingSignals(input: string) {
  const text = normalize(input);
  const signals: string[] = [];
  const patterns: string[] = [];
  if (/hungry|starving|craving|snack/.test(text)) { signals.push("Hunger came up today."); patterns.push("Hunger management may be important."); }
  if (/weight went up|scale|heavier|gained/.test(text)) { signals.push("Scale anxiety came up."); patterns.push("Reassure using trends, not single weigh-ins."); }
  if (/messed up|fell off|binge|bad day|takeaway|ruined/.test(text)) { signals.push("Rescue mode came up."); patterns.push("Bad days need quick reset coaching, not guilt."); }
  if (/late night|night|evening/.test(text)) { signals.push("Evening risk came up."); patterns.push("Evenings may be a weak point."); }
  if (/motivation|quit|give up|struggling/.test(text)) { signals.push("Motivation dip came up."); patterns.push("Short next actions work better than long lectures."); }
  if (/boxing|fight|bag|conditioning/.test(text)) { signals.push("Boxing identity came up."); patterns.push("Boxing goals can be used as motivation."); }
  return { signals, patterns };
}

function addUnique(existing: string[], incoming: string[], max = 14) {
  const seen = new Set(existing.map((item) => item.toLowerCase()));
  const merged = [...existing];
  incoming.forEach((item) => { if (!seen.has(item.toLowerCase())) merged.push(item); });
  return merged.slice(-max);
}

function buildCoachReply(rawInput: string, state: CoachState) {
  const input = normalize(rawInput);
  const profile = state.profile;
  const tracker = trackerPhrase(profile);
  const cals = profile.calorieTarget ? `${profile.calorieTarget} calories` : "your calorie range";
  const protein = profile.proteinTarget ? `${profile.proteinTarget}g protein` : "enough protein";

  if (!isInScope(input)) {
    return "I’m your coach for food, training, progress and staying on track. Bring me the thing that’s trying to knock you off course and I’ll help with the next move.";
  }

  if (/which tracker|what tracker|tracking app|what app/.test(input)) {
    return "Use whichever tracker you like for exact numbers — NutriCheck, MyFitnessPal, Cronometer, Lose It, or anything that works for you. I’ll help you turn the numbers into decisions.";
  }

  if (profile.profileStatus !== "complete") {
    const hasSpecificProblem = /(hungry|weight went up|scale|bad day|messed up|training|workout|what should i eat|eat tonight|dinner|motivation|struggling|reset)/.test(input);
    if (!hasSpecificProblem || /(fat loss|boxing|strength|running|general health|maintenance|muscle|\b\d{2,3}\b|nutricheck|myfitnesspal|tracker|late night|hunger|motivation|scale|gym|home|walking)/.test(input)) {
      return nextOnboardingQuestion(profile);
    }
  }

  if (/what should i eat|what to eat|eat tonight|dinner|next meal|lunch|breakfast/.test(input)) {
    return `Keep it simple: protein first, then veg or salad. Add carbs if you trained or ${tracker} says you’ve got room. Give me what you’ve eaten so far and I’ll narrow it down.`;
  }

  if (/hungry|starving|craving|snack/.test(input)) {
    return "Right, don’t panic. Hunger is data, not failure. Before you go hunting snacks, get protein and volume in: Greek yogurt, eggs, lean meat, soup, fruit, veg, or a shake.";
  }

  if (/messed up|fell off|off plan|bad day|binge|ruined|takeaway|pizza|kebab/.test(input)) {
    return "You haven’t ruined anything. One rough meal only becomes a rough week if you let it. Water, normal next meal, protein high, routine back on. Reset now.";
  }

  if (/weight went up|scale went up|gained|heavier|water weight|stall|plateau/.test(input)) {
    return "Don’t panic about one weigh-in. A jump is usually water, food, salt, stress, soreness or sleep — not sudden fat gain. Give it 3 honest days and watch the trend.";
  }

  if (/calorie|macro|protein|target/.test(input)) {
    return `Use ${tracker} for exact logging. I’ll help interpret it. For this phase: ${cals}, ${protein}, simple meals, and training you can recover from. Paste your totals and I’ll call the next move.`;
  }

  if (/workout|training|gym|home|boxing|run|running|cardio|strength/.test(input)) {
    if (!/home|gym|boxing|running|run|strength|weights|walk|kettlebell|bodyweight/.test(input)) return "I’ll make it specific. Are you training at home or in the gym, and how long have you got?";
    if (/boxing/.test(input) || state.activePhase.goal === "boxing") return "Boxing day: warm up, then controlled rounds. Shadowboxing, bag, pads or skipping. Finish with legs, push, pull and carries. Build the engine — don’t bury yourself.";
    if (/running|run/.test(input) || state.activePhase.goal === "running") return "Keep it controlled. Easy effort first. Don’t test yourself every run. We’re building consistency and protecting your joints.";
    return "Simple session: squat pattern, push, pull, carry, then a short finisher. Repeatable beats heroic. Leave enough in the tank to train again.";
  }

  if (/injury|pain|hurt|dizzy|chest pain|faint|sick/.test(input)) {
    return "Play this safe. Don’t push through pain, dizziness, chest pain or anything worrying. I can help adjust around minor aches, but proper symptoms need professional advice.";
  }

  if (/reset|change goal|new goal|start again|different goal|switch/.test(input)) {
    return "We can change direction without wiping your history. Small tweak, new phase, or full reset — which one do you mean? Don’t reset because of one bad day.";
  }

  if (/motivation|struggling|can t be bothered|cant be bothered|quit|give up|no motivation/.test(input)) {
    return "Forget the whole mountain. Win the next action. One meal, one walk, one honest check-in. You don’t need perfect — you need proof you’re still moving.";
  }

  if (/nutricheck|myfitnesspal|fitness pal|cronometer|lose it|tracker/.test(input)) {
    return "Good. Let the tracker handle exact calories and grams. Bring me what it says, what you’re tempted to do, and how hungry you are — I’ll coach the decision.";
  }

  return "Talk me through the situation. Food, hunger, training, weight, motivation, or a bad day — I’ll keep it practical and give you the next move.";
}

function memoryLine(state: CoachState) {
  const p = state.profile;
  const basics = [
    `Goal: ${GOAL_LABELS[p.goal]}`,
    p.currentWeightKg ? `Current weight: ${p.currentWeightKg}kg` : "Current weight not saved yet",
    p.targetWeightKg ? `Target: ${p.targetWeightKg}kg` : "Target not saved yet",
    p.biggestStruggle ? `Main struggle: ${p.biggestStruggle}` : "Main struggle not saved yet",
    p.trackerApp && p.trackerApp !== "None yet" ? `Tracker: ${p.trackerApp}` : "Tracker not saved yet",
  ];
  const patterns = state.memory.patterns.length ? state.memory.patterns.slice(-4).join(" ") : "No repeated patterns spotted yet.";
  return `${basics.join(". ")}. Patterns: ${patterns}`;
}

export function CoachGeorgeLiveAssistant() {
  const [state, setState] = useState<CoachState>(INITIAL_STATE);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [pendingDeleteConfirm, setPendingDeleteConfirm] = useState(false);

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

  const visibleMessages = useMemo(
    () => state.messages.filter((message) => message.role !== "system").slice(-14),
    [state.messages],
  );

  const canStart = hydrated && (connectionState === "idle" || connectionState === "error");
  const voiceLive = connectionState === "connected";

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY) || LEGACY_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CoachState>;
        setState({
          ...INITIAL_STATE,
          ...parsed,
          profile: markProfileStatus({ ...defaultProfile(), ...(parsed.profile || {}) }),
          activePhase: parsed.activePhase || defaultPhase(parsed.profile?.goal || "fat-loss"),
          archivedPhases: parsed.archivedPhases || [],
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

    appendMessage("user", cleaned);

    const nextProfile = extractProfileFromText(cleaned, stateRef.current.profile);
    const nextState: CoachState = {
      ...stateRef.current,
      profile: nextProfile,
      activePhase: { ...stateRef.current.activePhase, goal: nextProfile.goal, title: GOAL_LABELS[nextProfile.goal] },
    };
    const reply = buildCoachReply(cleaned, nextState);
    const { signals, patterns } = inferCoachingSignals(cleaned);

    setState((prev) => {
      const profile = extractProfileFromText(cleaned, prev.profile);
      return {
        ...prev,
        profile,
        activePhase: { ...prev.activePhase, goal: profile.goal, title: GOAL_LABELS[profile.goal] },
        memory: signals.length || patterns.length ? {
          notes: addUnique(prev.memory.notes, signals),
          patterns: addUnique(prev.memory.patterns, patterns),
          lastSummary: signals[0] || prev.memory.lastSummary,
          updatedAt: new Date().toISOString(),
        } : prev.memory,
      };
    });

    respond(reply);
  }

  function handleTextSubmit(event?: FormEvent) {
    event?.preventDefault();
    const value = textInput;
    setTextInput("");
    handleUserInput(value);
  }

  function updateProfile(patch: Partial<CoachProfile>) {
    setState((prev) => {
      const profile = markProfileStatus({ ...prev.profile, ...patch });
      return { ...prev, profile, activePhase: { ...prev.activePhase, goal: profile.goal, title: GOAL_LABELS[profile.goal] } };
    });
  }

  function startNewPhase(goal: Goal) {
    setState((prev) => ({
      ...prev,
      archivedPhases: [{ ...prev.activePhase, status: "archived" }, ...prev.archivedPhases].slice(0, 12),
      activePhase: defaultPhase(goal),
      profile: markProfileStatus({ ...prev.profile, goal }),
    }));
    respond(`New ${GOAL_LABELS[goal]} phase started. I’ve kept the old phase in your history.`);
  }

  function deleteAllData() {
    if (!pendingDeleteConfirm) { setPendingDeleteConfirm(true); return; }
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    setPendingDeleteConfirm(false);
    setState(INITIAL_STATE);
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
          respond(getOpeningLine(stateRef.current));
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
    if (current.profile.profileStatus !== "complete") return "Before we get going properly, what are we working towards? Fat loss, boxing, strength, running, or just general health?";
    const pattern = current.memory.patterns.slice(-1)[0];
    if (pattern) return `I remember this pattern: ${pattern} What’s the situation today?`;
    return "Talk to me. What’s the situation today?";
  }

  const statusText = connectionState === "connected" ? "Listening" : connectionState === "connecting" ? "Connecting" : "George is ready";

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0 bg-[url('/coach-george-gym-bg.jpeg')] bg-cover bg-center opacity-28 blur-[3px] scale-110" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(229,205,157,0.18),rgba(10,10,10,0.36)_34%,rgba(0,0,0,0.94)_78%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.2),rgba(0,0,0,0.82)_58%,rgba(0,0,0,0.98))]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-5 pb-4 pt-5 sm:px-6">
        <header className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/46">Coach</div>
          <button onClick={() => setShowProfile(true)} className="rounded-full border border-white/10 bg-white/[0.045] p-2.5 text-white/70 backdrop-blur-xl transition hover:bg-white/[0.09] hover:text-white" aria-label="Open coaching settings">
            <Settings2 className="h-5 w-5" />
          </button>
        </header>

        <div className="pt-7 text-center">
          <div className="relative mx-auto h-[138px] w-[138px] rounded-full border border-[#ead7aa]/75 bg-black/55 p-[3px] shadow-[0_0_55px_rgba(234,215,170,0.34)]">
            <div className={`absolute inset-[-9px] rounded-full border border-[#ead7aa]/20 ${voiceLive ? "animate-pulse" : ""}`} />
            <div className="absolute left-[-52px] right-[-52px] top-1/2 h-px -translate-y-1/2 bg-[linear-gradient(90deg,transparent,rgba(234,215,170,.42),transparent)]" />
            <img src="/coach-george-avatar.png" alt="Coach George" className="relative h-full w-full rounded-full object-cover" />
          </div>
          <h1 className="mt-5 text-[34px] font-semibold tracking-[-0.045em] text-white">Coach George</h1>
          <p className="mt-2 text-sm leading-6 text-[#ead7aa]/90">Your coach for food, training and staying on track.</p>
        </div>

        <div className="mt-6 rounded-[26px] border border-white/10 bg-white/[0.07] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <p className="text-[17px] leading-7 text-white/92">{latestAssistant}</p>
          <p className="mt-3 text-[11px] text-white/35">George</p>
        </div>

        <div className="mt-4 flex justify-center gap-2">
          {PROMPTS.map((prompt) => (
            <button key={prompt} onClick={() => handleUserInput(prompt)} className="rounded-2xl border border-white/10 bg-white/[0.055] px-3.5 py-2.5 text-xs font-medium text-white/78 backdrop-blur-xl transition hover:bg-white/[0.1]">
              {prompt}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center">
          <button
            onClick={connectionState === "connected" || connectionState === "connecting" ? stopConversation : startConversation}
            disabled={!hydrated}
            className={`relative flex h-[118px] w-[118px] items-center justify-center rounded-full border transition disabled:opacity-60 ${voiceLive ? "border-[#f0dca7] bg-[#ead7aa]/14 shadow-[0_0_70px_rgba(234,215,170,0.38)]" : "border-[#ead7aa]/58 bg-black/48 shadow-[0_0_45px_rgba(234,215,170,0.18)]"}`}
          >
            <Mic className="h-12 w-12 text-[#ead7aa]" />
          </button>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#ead7aa]">{voiceLive ? "Tap to stop" : "Tap to talk"}</p>
          <p className="mt-1 text-xs text-white/42">{statusText}</p>
          {error ? <p className="mt-2 max-w-[320px] text-center text-xs leading-5 text-red-200">{error}</p> : null}
        </div>

        <div ref={chatScrollRef} className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 pb-1">
          {visibleMessages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[86%] whitespace-pre-wrap rounded-[24px] px-4 py-3 text-sm leading-6 shadow-[0_10px_32px_rgba(0,0,0,0.26)] ${message.role === "user" ? "bg-[#8f7247] text-white" : "border border-white/10 bg-white/[0.075] text-white/88 backdrop-blur-xl"}`}>
                {message.content}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleTextSubmit} className="mt-3 rounded-[24px] border border-white/10 bg-white/[0.075] p-2 backdrop-blur-2xl">
          <input
            value={textInput}
            onChange={(event) => setTextInput(event.target.value)}
            placeholder="Type if you’d rather not talk…"
            className="block w-full bg-transparent px-3 pb-2 pt-2 text-sm text-white outline-none placeholder:text-white/35"
          />
          <button type="submit" className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-[18px] bg-[#8f7247] text-sm font-semibold text-white transition hover:bg-[#a78655]">
            Send <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {showProfile ? (
        <ProfilePanel
          state={state}
          updateProfile={updateProfile}
          onClose={() => setShowProfile(false)}
          onStartPhase={startNewPhase}
          onDeleteAll={deleteAllData}
          pendingDeleteConfirm={pendingDeleteConfirm}
          onToggleVoice={() => setState((prev) => ({ ...prev, voiceReplies: !prev.voiceReplies }))}
        />
      ) : null}
    </section>
  );
}

function ProfilePanel({ state, updateProfile, onClose, onStartPhase, onDeleteAll, pendingDeleteConfirm, onToggleVoice }: { state: CoachState; updateProfile: (patch: Partial<CoachProfile>) => void; onClose: () => void; onStartPhase: (goal: Goal) => void; onDeleteAll: () => void; pendingDeleteConfirm: boolean; onToggleVoice: () => void }) {
  const profile = state.profile;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur-md sm:items-center">
      <div className="max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-[32px] border border-white/10 bg-[#080808] p-5 shadow-[0_28px_120px_rgba(0,0,0,0.82)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <button onClick={onClose} className="rounded-full border border-white/10 bg-white/[0.05] p-2 text-white/70 hover:text-white"><ChevronLeft className="h-5 w-5" /></button>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ead7aa]">What George knows</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Your coaching profile</h2>
            <p className="mt-2 text-sm leading-6 text-white/52">George should learn this naturally, but you can edit anything here.</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-white/10 bg-white/[0.05] p-2 text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3">
          <Field label="Name"><input value={profile.name} onChange={(e) => updateProfile({ name: e.target.value })} placeholder="Optional" className="field" /></Field>
          <Field label="Goal"><select value={profile.goal} onChange={(e) => updateProfile({ goal: e.target.value as Goal })} className="field">{Object.entries(GOAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Current weight"><input value={profile.currentWeightKg} onChange={(e) => updateProfile({ currentWeightKg: e.target.value })} placeholder="kg" className="field" /></Field>
            <Field label="Target weight"><input value={profile.targetWeightKg} onChange={(e) => updateProfile({ targetWeightKg: e.target.value })} placeholder="kg" className="field" /></Field>
          </div>
          <Field label="Training"><input value={profile.trainingFocus} onChange={(e) => updateProfile({ trainingFocus: e.target.value })} placeholder="Boxing, gym, walking…" className="field" /></Field>
          <Field label="Main struggle"><input value={profile.biggestStruggle} onChange={(e) => updateProfile({ biggestStruggle: e.target.value })} placeholder="Hunger, evenings, scale panic…" className="field" /></Field>
          <Field label="Tracker"><select value={profile.trackerApp} onChange={(e) => updateProfile({ trackerApp: e.target.value as TrackerApp })} className="field">{TRACKERS.map((tracker) => <option key={tracker}>{tracker}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calories"><input value={profile.calorieTarget} onChange={(e) => updateProfile({ calorieTarget: e.target.value })} placeholder="Optional" className="field" /></Field>
            <Field label="Protein"><input value={profile.proteinTarget} onChange={(e) => updateProfile({ proteinTarget: e.target.value })} placeholder="Optional" className="field" /></Field>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <p className="text-sm font-semibold text-white">Memory and patterns</p>
          <p className="mt-2 text-sm leading-6 text-white/55">{memoryLine(state)}</p>
          {state.memory.lastSummary ? <p className="mt-3 text-xs text-[#ead7aa]/80">Latest signal: {state.memory.lastSummary}</p> : null}
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm font-semibold text-white">Change direction safely</p>
          <div className="mt-3 grid gap-2">
            {Object.entries(GOAL_LABELS).map(([value, label]) => (
              <button key={value} onClick={() => onStartPhase(value as Goal)} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-left text-sm text-white/82 transition hover:bg-white/[0.08]">
                <span>Start {label}</span><ArrowRight className="h-4 w-4 text-[#ead7aa]" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <button onClick={() => updateProfile({})} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#8f7247] px-5 py-3 font-semibold text-white hover:bg-[#a78655]">Save <CheckCircle2 className="h-5 w-5" /></button>
          <button onClick={onDeleteAll} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-300/20 bg-red-500/10 px-5 py-3 font-semibold text-red-100 hover:bg-red-500/15"><Trash2 className="h-5 w-5" />{pendingDeleteConfirm ? "Tap again to delete everything" : "Delete all data"}</button>
          <button onClick={onToggleVoice} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-3 font-semibold text-white/80 hover:bg-white/[0.08]">{state.voiceReplies ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />} Voice responses <span className="text-[#ead7aa]">{state.voiceReplies ? "on" : "off"}</span></button>
        </div>
      </div>
      <style jsx>{`
        .field{margin-top:.35rem;width:100%;border-radius:1rem;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);padding:.82rem .9rem;color:white;outline:none}
        .field::placeholder{color:rgba(255,255,255,.35)}
        .field option{color:#090909}
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-medium text-white/82">{label}{children}</label>;
}
