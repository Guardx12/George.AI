"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Mic,
  Send,
  Settings2,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

type ConnectionState = "idle" | "connecting" | "connected" | "error";
type MessageRole = "assistant" | "user" | "system";
type Goal = "fat-loss" | "strength" | "boxing" | "running" | "general-health" | "maintenance" | "muscle";
type CoachingStyle = "straight" | "calm" | "supportive";
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
  coachingStyle: CoachingStyle;
  profileStatus: ProfileStatus;
};

type ActivePhase = {
  id: string;
  title: string;
  goal: Goal;
  startedAt: string;
  priority: string;
  biggestRisk: string;
  todayFocus: string;
  status: "active" | "paused" | "archived";
};

type ProgressEntry = {
  id: string;
  date: string;
  weightKg?: string;
  adherence?: "low" | "okay" | "good" | "excellent";
  hunger?: "low" | "normal" | "high";
  note: string;
};

type CoachingMemory = { notes: string[]; patterns: string[]; lastSummary: string; updatedAt: string | null };

type CoachState = {
  profile: CoachProfile;
  activePhase: ActivePhase;
  archivedPhases: ActivePhase[];
  progress: ProgressEntry[];
  memory: CoachingMemory;
  messages: LiveMessage[];
  onboardingComplete: boolean;
  voiceReplies: boolean;
};

const STORAGE_KEY = "coach-george-transformation-v5";

const GOAL_LABELS: Record<Goal, string> = {
  "fat-loss": "Fat loss",
  strength: "Strength",
  boxing: "Boxing fitness",
  running: "Running fitness",
  "general-health": "General health",
  maintenance: "Maintenance",
  muscle: "Build muscle",
};

const SUGGESTIONS = ["I'm hungry", "My weight went up", "What should I eat?"];

function uid(prefix = "id") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function todayIso() { return new Date().toISOString().slice(0, 10); }
function makeMessage(role: MessageRole, content: string): LiveMessage { return { id: uid(role), role, content, createdAt: new Date().toISOString() }; }
function normalize(input: string) { return input.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); }

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
    coachingStyle: "straight",
    profileStatus: "new",
  };
}

function defaultPhase(goal: Goal = "fat-loss"): ActivePhase {
  return {
    id: uid("phase"),
    title: GOAL_LABELS[goal],
    goal,
    startedAt: todayIso(),
    priority: "Stay consistent and make the next good decision.",
    biggestRisk: "Losing momentum when life gets messy.",
    todayFocus: "Make the next clean decision.",
    status: "active",
  };
}

const INITIAL_STATE: CoachState = {
  profile: defaultProfile(),
  activePhase: defaultPhase("fat-loss"),
  archivedPhases: [],
  progress: [],
  memory: { notes: [], patterns: [], lastSummary: "", updatedAt: null },
  messages: [makeMessage("assistant", "Talk to me. What’s the situation today?")],
  onboardingComplete: false,
  voiceReplies: true,
};

function buildVoiceRendererInstructions() {
  return [
    "You are Coach George's voice renderer.",
    "Only speak the exact text provided by the app.",
    "Do not add facts, advice, calculations, medical guidance, or extra conversation.",
  ].join(" ");
}

function buildRealtimeSessionPayload(instructions: string) {
  return {
    type: "realtime",
    instructions,
    audio: {
      input: { transcription: { model: "gpt-4o-mini-transcribe", language: "en" }, turn_detection: { type: "semantic_vad", eagerness: "high", create_response: false, interrupt_response: true } },
      output: { voice: "cedar", speed: 1.0 },
    },
  };
}

function profileCompletion(profile: CoachProfile) {
  const fields = [profile.goal, profile.currentWeightKg, profile.trainingFocus, profile.biggestStruggle, profile.foodStyle];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function getTrackerPhrase(state: CoachState) {
  if (state.profile.trackerApp && state.profile.trackerApp !== "None yet" && state.profile.trackerApp !== "Other") return state.profile.trackerApp;
  return "your tracker";
}

function isInScope(input: string) {
  return /(food|meal|eat|eating|hungry|hunger|craving|snack|calorie|macro|protein|carb|fat|tracker|nutricheck|myfitnesspal|cronometer|lose it|weight|scale|weigh|gain|lost|loss|fat|muscle|training|workout|gym|run|running|boxing|cardio|strength|steps|walk|motivation|struggling|quit|give up|reset|goal|phase|plan|routine|habit|sleep|stress|water|takeaway|restaurant|off plan|bad day|binge|profile|setup|start|check in|injury|pain|hurt|tired|energy|recovery)/.test(input);
}

function inferCoachingSignals(input: string) {
  const text = normalize(input);
  const signals: string[] = [];
  const patterns: string[] = [];
  if (/hungry|starving|craving|snack/.test(text)) { signals.push("Hunger/cravings came up."); patterns.push("Hunger management may be important."); }
  if (/weight went up|scale|heavier|gained/.test(text)) { signals.push("Scale anxiety came up."); patterns.push("User may need trend-based reassurance around weigh-ins."); }
  if (/messed up|fell off|binge|bad day|takeaway|ruined/.test(text)) { signals.push("Rescue-mode support came up."); patterns.push("User may benefit from quick reset coaching after off-plan meals."); }
  if (/boxing|fight|bag|conditioning/.test(text)) { signals.push("Boxing/conditioning interest came up."); patterns.push("Boxing identity can be used as motivation."); }
  if (/late night|night|evening/.test(text)) { signals.push("Evening/late-night risk came up."); patterns.push("Evenings may be a weak point."); }
  if (/motivation|quit|give up|struggling/.test(text)) { signals.push("Motivation dip came up."); patterns.push("Short next-action coaching works better than long lectures."); }
  return { signals, patterns };
}

function addUnique(items: string[], incoming: string[], max = 12) {
  const lower = new Set(items.map((i) => i.toLowerCase()));
  const merged = [...items];
  incoming.forEach((item) => { if (!lower.has(item.toLowerCase())) merged.push(item); });
  return merged.slice(-max);
}

function getNextOnboardingQuestion(profile: CoachProfile) {
  if (!profile.currentWeightKg) return "Right, fat loss it is. What do you weigh roughly at the moment?";
  if (!profile.targetWeightKg && profile.goal === "fat-loss") return "Got it. And where would you like to get to eventually? Rough number is fine.";
  if (!profile.trainingFocus) return "What training are we working with — gym, home workouts, walking, running, boxing, or nothing yet?";
  if (!profile.biggestStruggle) return "What usually knocks you off track — hunger, evenings, weekends, motivation, the scale, or something else?";
  if (!profile.trackerApp || profile.trackerApp === "None yet") return "Do you use a tracking app for exact numbers — NutriCheck, MyFitnessPal, Cronometer, Lose It, or something else?";
  return "Good. I’ve got enough to coach you properly. What do you need help with right now?";
}

function getIntroLine(state: CoachState) {
  if (!state.onboardingComplete || state.profile.profileStatus !== "complete") return "Hi, I’m George. I’ll help you stay on track with food, training, motivation and bad days. First — what are we working towards?";
  const name = state.profile.name ? ` ${state.profile.name}` : "";
  const pattern = state.memory.patterns.slice(-1)[0];
  return pattern ? `Ready${name}. I remember this pattern: ${pattern} What’s the situation today?` : `Ready${name}. What’s the situation today?`;
}

function buildMemoryLine(state: CoachState) {
  const bits = [
    `Goal: ${GOAL_LABELS[state.activePhase.goal]}`,
    state.profile.currentWeightKg ? `Current weight: ${state.profile.currentWeightKg}kg` : "No weight saved yet",
    state.profile.targetWeightKg ? `Target: ${state.profile.targetWeightKg}kg` : "No target saved yet",
    state.profile.biggestStruggle ? `Main struggle: ${state.profile.biggestStruggle}` : "Main struggle not saved yet",
  ];
  const patterns = state.memory.patterns.length ? `Patterns: ${state.memory.patterns.slice(-3).join(" ")}` : "No patterns recognised yet.";
  return `${bits.join(". ")}. ${patterns}`;
}

function buildCoachReply(rawInput: string, state: CoachState) {
  const input = normalize(rawInput);
  const tracker = getTrackerPhrase(state);
  const protein = state.profile.proteinTarget ? `${state.profile.proteinTarget}g protein` : "enough protein";
  const calories = state.profile.calorieTarget ? `around ${state.profile.calorieTarget} calories` : "your calorie range";

  if (!isInScope(input)) return "I’m going to keep us focused on food, training, progress, motivation and staying on track. Bring me something around your goal and I’ll help with the next move.";

  if (/which tracker|what tracker|tracking app|what app/.test(input)) return "Use whatever tracker feels easiest for exact numbers — NutriCheck, MyFitnessPal, Cronometer, Lose It, or another one you like. I’m here to turn those numbers into decisions.";

  if (state.profile.profileStatus !== "complete" && /(fat loss|lose weight|lose fat|boxing|strength|running|run|general health|maintenance|muscle|just fat loss)/.test(input)) return getNextOnboardingQuestion(state.profile);

  const clearRequest = /(what should i eat|what to eat|eat tonight|dinner|next meal|lunch|breakfast|i m hungry|im hungry|starving|craving|weight went up|scale went up|messed up|fell off|off plan|bad day|binge|training today|workout|reset|change goal|motivation|struggling|quit|give up)/.test(input);
  if (state.profile.profileStatus !== "complete" && !clearRequest) return getNextOnboardingQuestion(state.profile);

  if (/what should i eat|what to eat|eat tonight|dinner|next meal|lunch|breakfast/.test(input)) return `Protein first. Then veg or salad. Add carbs if you’ve trained, been active, or ${tracker} says you’ve got room. Simple wins: chicken wraps, chilli and rice, eggs on toast, Greek yogurt bowl, lean mince, fish, tofu or beans.`;

  if (/hungry|starving|craving|snack/.test(input)) return "Right, don’t panic. Hunger isn’t failure. Go protein plus volume: Greek yogurt, eggs, lean meat, soup, salad, fruit, veg, or a shake. Eat something controlled before you start hunting snacks.";

  if (/messed up|fell off|off plan|bad day|binge|ruined|takeaway|pizza|kebab/.test(input)) return "You haven’t ruined anything. One rough meal only becomes a rough week if you let it. Water, normal next meal, protein high, routine back on. The reset starts now, not Monday.";

  if (/weight went up|scale went up|gained|heavier|water weight|stall|plateau/.test(input)) return "Don’t panic about one weigh-in. A jump is usually water, food, salt, stress, soreness or sleep — not sudden fat gain. Give it 3 honest days and look at the trend.";

  if (/calorie|macro|protein|target/.test(input)) return `Use ${tracker} for exact logging. I’ll help interpret it. Big rocks for this phase: ${calories}, ${protein}, repeatable meals, and training you can recover from. Paste your totals and I’ll tell you the move.`;

  if (/workout|training|gym|home|boxing|run|running|cardio|strength/.test(input)) {
    if (!/home|gym|boxing|running|run|strength|weights/.test(input)) return "I’ll make it specific. Are you training at home or in the gym, and how long have you got?";
    if (/boxing/.test(input) || state.activePhase.goal === "boxing") return "Boxing day: 5-minute warm-up, then 6 rounds of 2 minutes shadowboxing, bag work or skipping. Finish with squats, push-ups, rows and carries. Build the engine, don’t bury yourself.";
    if (/running|run/.test(input) || state.activePhase.goal === "running") return "Keep it controlled. Easy walk-jog or steady effort. Don’t test yourself every run. We’re building consistency and protecting joints.";
    return "Simple session: squat pattern, push, pull, carry, then a short finisher. Keep it repeatable. A session you recover from beats a hero workout you avoid next time.";
  }

  if (/injury|pain|hurt|dizzy|chest pain|faint|sick/.test(input)) return "Play this safe. Don’t push through pain, dizziness, chest pain or anything worrying. I can help adjust around minor aches, but proper symptoms need professional advice.";

  if (/reset|change goal|new goal|start again|different goal|switch/.test(input)) return "We can change direction without wrecking history. Small tweak, new phase, or full reset — which one do you actually mean? Don’t reset just because of one bad day.";

  if (/motivation|struggling|can t be bothered|cant be bothered|quit|give up/.test(input)) return "Forget the whole mountain. Win the next action. One meal, one walk, one session, one honest check-in. You don’t need perfect — you need proof you’re still moving.";

  if (/nutricheck|myfitnesspal|fitness pal|cronometer|lose it|tracker/.test(input)) return "Good. Let your tracker handle exact calories and grams. Bring me what it says, what you’re tempted to do, and how hungry you are — I’ll coach the decision.";

  return "Talk me through the situation. Food, hunger, training, weight, motivation, or a bad day — I’ll keep it practical and give you the next move.";
}

function extractProfileFromText(input: string, current: CoachProfile): CoachProfile {
  const text = normalize(input);
  const next = { ...current };
  if (/fat loss|lose weight|lose fat/.test(text)) next.goal = "fat-loss";
  else if (/boxing/.test(text)) next.goal = "boxing";
  else if (/strength|weights/.test(text)) next.goal = "strength";
  else if (/running|run/.test(text)) next.goal = "running";
  else if (/maintenance/.test(text)) next.goal = "maintenance";
  else if (/muscle/.test(text)) next.goal = "muscle";
  else if (/general health/.test(text)) next.goal = "general-health";

  const looseNumber = text.match(/\b(\d{2,3}(?:\.\d)?)\s*(kg|kilos|stone|st)?\b/);
  const currentWeight = text.match(/(?:weigh|weight|currently|i m|im|i am)\s*(\d{2,3}(?:\.\d)?)/);
  if (currentWeight && !next.currentWeightKg) next.currentWeightKg = currentWeight[1];
  else if (next.profileStatus !== "complete" && !next.currentWeightKg && looseNumber) next.currentWeightKg = looseNumber[1];

  const targetMatch = text.match(/(?:target|goal weight|want to be|get to|down to)\s*(\d{2,3}(?:\.\d)?)/);
  if (targetMatch && !next.targetWeightKg) next.targetWeightKg = targetMatch[1];

  if (/nutricheck/.test(text)) next.trackerApp = "NutriCheck";
  else if (/myfitnesspal|fitness pal/.test(text)) next.trackerApp = "MyFitnessPal";
  else if (/cronometer/.test(text)) next.trackerApp = "Cronometer";
  else if (/lose it/.test(text)) next.trackerApp = "Lose It";
  else if (/no tracker|none yet|don t track|dont track/.test(text)) next.trackerApp = "None yet";
  else if (/tracker|app/.test(text) && next.trackerApp === "None yet") next.trackerApp = "Other";

  if (/late night|night eating|evening/.test(text)) next.biggestStruggle = "Late-night eating";
  else if (/hunger|hungry|cravings/.test(text)) next.biggestStruggle = "Hunger and cravings";
  else if (/motivation|consistency|fall off|quit/.test(text)) next.biggestStruggle = "Consistency";
  else if (/scale|weigh/.test(text)) next.biggestStruggle = "Scale anxiety";

  if (/boxing/.test(text)) next.trainingFocus = "Boxing and conditioning";
  else if (/running|run/.test(text)) next.trainingFocus = "Running fitness";
  else if (/gym|weights|strength/.test(text)) next.trainingFocus = "Gym strength training";
  else if (/home/.test(text)) next.trainingFocus = "Home training";
  else if (/walking|steps/.test(text)) next.trainingFocus = "Walking and steps";

  next.profileStatus = profileCompletion(next) >= 80 ? "complete" : "started";
  return next;
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

  const canStart = hydrated && (connectionState === "idle" || connectionState === "error");
  const latestAssistant = useMemo(() => [...state.messages].reverse().find((m) => m.role === "assistant")?.content || "Talk to me. What’s the situation today?", [state.messages]);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem("coach-george-transformation-v3");
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CoachState>;
        setState({
          ...INITIAL_STATE,
          ...parsed,
          profile: { ...defaultProfile(), ...(parsed.profile || {}) },
          activePhase: parsed.activePhase || defaultPhase(parsed.profile?.goal || "fat-loss"),
          archivedPhases: parsed.archivedPhases || [],
          progress: parsed.progress || [],
          memory: { ...INITIAL_STATE.memory, ...(parsed.memory || {}) },
          messages: (parsed.messages || INITIAL_STATE.messages).slice(-60),
          voiceReplies: parsed.voiceReplies ?? true,
        });
      }
    } catch {} finally { setHydrated(true); }
  }, []);

  useEffect(() => { if (hydrated && typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, messages: state.messages.slice(-60) })); }, [state, hydrated]);
  useEffect(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, [state.messages]);
  useEffect(() => () => { void cleanupConversation(); }, []);

  function appendMessage(role: MessageRole, content: string) { setState((prev) => ({ ...prev, messages: [...prev.messages.slice(-59), makeMessage(role, content)] })); }

  function speakWithBrowser(text: string) {
    if (typeof window === "undefined" || !stateRef.current.voiceReplies || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.96;
      utterance.pitch = 0.9;
      window.speechSynthesis.speak(utterance);
    } catch {}
  }

  function speakIfConnected(textToSpeak: string) {
    if (!stateRef.current.voiceReplies) return;
    const channel = dcRef.current;
    const safeText = textToSpeak.trim();
    if (!safeText) return;
    if (!channel || channel.readyState !== "open") { speakWithBrowser(safeText); return; }
    channel.send(JSON.stringify({ type: "response.create", response: { conversation: "none", output_modalities: ["audio"], input: [{ type: "message", role: "user", content: [{ type: "input_text", text: `Speak the following text exactly as written. Do not add, remove, summarise, paraphrase, change, or answer anything else.\n\n${safeText}` }] }] } }));
  }

  function respond(content: string) { appendMessage("assistant", content); speakIfConnected(content); }

  function handleUserInput(raw: string) {
    const cleaned = raw.trim();
    if (!cleaned) return;
    const normalized = normalize(cleaned);
    const last = lastHandledRef.current;
    if (last && last.text === normalized && Date.now() - last.at < 1200) return;
    lastHandledRef.current = { text: normalized, at: Date.now() };
    appendMessage("user", cleaned);

    const nextProfile = extractProfileFromText(cleaned, stateRef.current.profile);
    const nextStateForReply: CoachState = { ...stateRef.current, profile: nextProfile, activePhase: { ...stateRef.current.activePhase, goal: nextProfile.goal, title: GOAL_LABELS[nextProfile.goal] } };
    const reply = buildCoachReply(cleaned, nextStateForReply);
    const { signals, patterns } = inferCoachingSignals(cleaned);

    setState((prev) => {
      const updatedProfile = extractProfileFromText(cleaned, prev.profile);
      return {
        ...prev,
        profile: updatedProfile,
        activePhase: { ...prev.activePhase, goal: updatedProfile.goal, title: GOAL_LABELS[updatedProfile.goal] },
        onboardingComplete: updatedProfile.profileStatus === "complete" ? true : prev.onboardingComplete,
        memory: signals.length || patterns.length ? { notes: addUnique(prev.memory.notes, signals), patterns: addUnique(prev.memory.patterns || [], patterns), lastSummary: signals[0] || prev.memory.lastSummary, updatedAt: new Date().toISOString() } : prev.memory,
      };
    });
    respond(reply);
  }

  function handleTextSubmit(event?: FormEvent) { event?.preventDefault(); const value = textInput; setTextInput(""); handleUserInput(value); }
  function updateProfile(patch: Partial<CoachProfile>) { setState((prev) => { const profile = { ...prev.profile, ...patch }; profile.profileStatus = profileCompletion(profile) >= 80 ? "complete" : "started"; return { ...prev, profile, activePhase: { ...prev.activePhase, goal: profile.goal, title: GOAL_LABELS[profile.goal] }, onboardingComplete: profile.profileStatus === "complete" ? true : prev.onboardingComplete }; }); }

  function startNewPhase(goal: Goal) {
    setState((prev) => ({ ...prev, archivedPhases: [{ ...prev.activePhase, status: "archived" }, ...prev.archivedPhases].slice(0, 12), activePhase: defaultPhase(goal), profile: { ...prev.profile, goal, profileStatus: prev.profile.profileStatus === "new" ? "started" : prev.profile.profileStatus }, messages: [...prev.messages, makeMessage("system", `New phase started: ${GOAL_LABELS[goal]}. Previous phase archived.`)] }));
    respond(`New ${GOAL_LABELS[goal]} phase started. I’ve archived the old phase instead of deleting it.`);
  }

  function deleteAllData() {
    if (!pendingDeleteConfirm) { setPendingDeleteConfirm(true); return; }
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    setPendingDeleteConfirm(false);
    setState(INITIAL_STATE);
  }

  async function cleanupConversation() {
    dcRef.current?.close(); dcRef.current = null;
    if (pcRef.current) { pcRef.current.getSenders().forEach((sender) => sender.track?.stop()); pcRef.current.close(); pcRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach((track) => track.stop()); localStreamRef.current = null; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.srcObject = null; audioRef.current.remove(); audioRef.current = null; }
  }

  async function startConversation() {
    if (!canStart) return;
    greetedSessionRef.current = false;
    await cleanupConversation();
    setConnectionState("connecting"); setError(null);
    try {
      const tokenResponse = await fetch("/api/george-session", { method: "GET", cache: "no-store" });
      const tokenData = await tokenResponse.json().catch(() => null);
      if (!tokenResponse.ok) throw new Error(tokenData?.error || "Could not create a secure live session.");
      const ephemeralKey = tokenData?.value || tokenData?.client_secret?.value;
      if (!ephemeralKey) throw new Error("Live voice token was missing.");
      const pc = new RTCPeerConnection(); pcRef.current = pc;
      const remoteAudio = document.createElement("audio"); remoteAudio.autoplay = true; remoteAudio.playsInline = true; remoteAudio.preload = "auto"; remoteAudio.style.display = "none"; document.body.appendChild(remoteAudio); audioRef.current = remoteAudio;
      pc.ontrack = (event) => { const [remoteStream] = event.streams; if (remoteStream) { remoteAudio.srcObject = remoteStream; void remoteAudio.play().catch(() => setError("Audio playback was blocked by the browser.")); } };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); localStreamRef.current = stream; stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const dataChannel = pc.createDataChannel("oai-events"); dcRef.current = dataChannel;
      dataChannel.addEventListener("open", () => { setConnectionState("connected"); dataChannel.send(JSON.stringify({ type: "session.update", session: buildRealtimeSessionPayload(buildVoiceRendererInstructions()) })); if (!greetedSessionRef.current) { greetedSessionRef.current = true; respond(getIntroLine(stateRef.current)); } });
      dataChannel.addEventListener("message", (event) => { try { const payload = JSON.parse(event.data); if (payload?.type === "conversation.item.input_audio_transcription.completed") handleUserInput(typeof payload.transcript === "string" ? payload.transcript : ""); if (payload?.type === "error") setError(payload?.error?.message || "George hit a voice error."); } catch {} });
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", headers: { Authorization: `Bearer ${ephemeralKey}`, "Content-Type": "application/sdp" }, body: offer.sdp });
      const answer = await sdpResponse.text(); if (!sdpResponse.ok) throw new Error(answer || "Could not connect George.");
      await pc.setRemoteDescription({ type: "answer", sdp: answer });
      pc.addEventListener("connectionstatechange", () => { if (["failed", "disconnected", "closed"].includes(pc.connectionState)) setConnectionState("error"); });
    } catch (err) { await cleanupConversation(); setConnectionState("error"); setError(err instanceof Error ? err.message : "Could not connect George right now."); }
  }

  async function stopConversation() { greetedSessionRef.current = false; await cleanupConversation(); setConnectionState("idle"); setError(null); }

  const statusText = connectionState === "connected" ? "Listening" : connectionState === "connecting" ? "Connecting" : "George is ready";

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0 bg-[url('/coach-george-gym-bg.jpeg')] bg-cover bg-center opacity-30 blur-[2px] scale-105" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(199,153,91,0.22),rgba(0,0,0,0.42)_36%,rgba(0,0,0,0.94)_86%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.78)_58%,rgba(0,0,0,0.95))]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-5 pb-4 pt-6 sm:px-6">
        <header className="flex items-center justify-between text-white/70">
          <button onClick={() => setShowProfile(true)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-semibold backdrop-blur-xl"><Settings2 className="h-4 w-4" /> My Coaching</button>
          <button onClick={() => setState((p) => ({ ...p, voiceReplies: !p.voiceReplies }))} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-semibold backdrop-blur-xl">{state.voiceReplies ? <Volume2 className="h-4 w-4 text-[#d8ae72]" /> : <VolumeX className="h-4 w-4" />} Voice {state.voiceReplies ? "on" : "off"}</button>
        </header>

        <div className="pt-7 text-center">
          <div className="relative mx-auto h-32 w-32 rounded-full border border-[#d8ae72]/70 bg-black/40 shadow-[0_0_60px_rgba(216,174,114,0.42)] sm:h-36 sm:w-36">
            <div className="absolute inset-[-8px] rounded-full border border-[#d8ae72]/25 animate-pulse" />
            <img src="/george-logo.png" alt="Coach George" className="h-full w-full rounded-full object-cover" />
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">Coach George</h1>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#d8ae72]">Your coach for food, training and staying on track.</p>
        </div>

        <div className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
          <p className="text-lg leading-8 text-white/90">{latestAssistant}</p>
          <p className="mt-3 text-xs text-white/38">Just now</p>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {SUGGESTIONS.map((item) => (
            <button key={item} onClick={() => handleUserInput(item)} className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm font-medium text-white/86 backdrop-blur-xl transition hover:bg-white/[0.12]">
              {item}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col items-center">
          <button onClick={connectionState === "connected" || connectionState === "connecting" ? stopConversation : startConversation} disabled={!hydrated} className={`relative flex h-28 w-28 items-center justify-center rounded-full border transition sm:h-32 sm:w-32 ${connectionState === "connected" ? "border-[#d8ae72] bg-[#d8ae72]/18 shadow-[0_0_70px_rgba(216,174,114,0.55)]" : "border-[#d8ae72]/70 bg-black/42 shadow-[0_0_45px_rgba(216,174,114,0.28)]"}`}>
            <Mic className="h-12 w-12 text-[#d8ae72]" />
          </button>
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#d8ae72]">{connectionState === "connected" ? "Tap to stop" : "Tap to talk"}</p>
          <p className="mt-1 text-sm text-white/42">{statusText}</p>
          {error ? <p className="mt-2 text-center text-xs text-red-200">{error}</p> : null}
        </div>

        <div ref={chatScrollRef} className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {state.messages.filter((m) => m.role !== "system").slice(-12).map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[84%] whitespace-pre-wrap rounded-[24px] px-4 py-3 text-sm leading-6 shadow-[0_10px_35px_rgba(0,0,0,0.28)] ${message.role === "user" ? "bg-[#b58a53] text-white" : "border border-white/10 bg-white/[0.085] text-white/86 backdrop-blur-xl"}`}>
                {message.content}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleTextSubmit} className="mt-4 rounded-full border border-white/10 bg-white/[0.075] p-2 backdrop-blur-2xl">
          <div className="flex items-center gap-2">
            <input value={textInput} onChange={(event) => setTextInput(event.target.value)} placeholder="Type if you’d rather not talk…" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-white/35" />
            <button type="submit" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#b58a53] text-white transition hover:bg-[#c79b61]"><Send className="h-5 w-5" /></button>
          </div>
        </form>

        <details className="mt-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-white/60 backdrop-blur-xl">
          <summary className="cursor-pointer text-sm font-semibold text-white/80">Memory</summary>
          <p className="mt-3 text-sm leading-6 text-white/55">{buildMemoryLine(state)}</p>
          {state.memory.lastSummary ? <p className="mt-2 text-xs text-[#d8ae72]/80">Latest signal: {state.memory.lastSummary}</p> : null}
        </details>
      </div>

      {showProfile ? <ProfilePanel state={state} updateProfile={updateProfile} onClose={() => setShowProfile(false)} onStartPhase={startNewPhase} onDeleteAll={deleteAllData} pendingDeleteConfirm={pendingDeleteConfirm} /> : null}
    </section>
  );
}

function ProfilePanel({ state, updateProfile, onClose, onStartPhase, onDeleteAll, pendingDeleteConfirm }: { state: CoachState; updateProfile: (patch: Partial<CoachProfile>) => void; onClose: () => void; onStartPhase: (goal: Goal) => void; onDeleteAll: () => void; pendingDeleteConfirm: boolean }) {
  const profile = state.profile;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-md sm:items-center">
      <div className="max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-[32px] border border-white/10 bg-[#090909] p-5 shadow-[0_28px_120px_rgba(0,0,0,0.82)] sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d8ae72]">My Coaching</p><h2 className="mt-1 text-2xl font-semibold text-white">What George remembers</h2><p className="mt-2 text-sm text-white/55">Profile, current phase, recognised patterns, and safe reset controls.</p></div>
          <button onClick={onClose} className="rounded-full border border-white/10 bg-white/[0.06] p-2 text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input value={profile.name} onChange={(e) => updateProfile({ name: e.target.value })} placeholder="Optional" className="field" /></Field>
          <Field label="Main goal"><select value={profile.goal} onChange={(e) => updateProfile({ goal: e.target.value as Goal })} className="field">{Object.entries(GOAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Current weight"><input value={profile.currentWeightKg} onChange={(e) => updateProfile({ currentWeightKg: e.target.value })} placeholder="kg" className="field" /></Field>
          <Field label="Target weight"><input value={profile.targetWeightKg} onChange={(e) => updateProfile({ targetWeightKg: e.target.value })} placeholder="kg or blank" className="field" /></Field>
          <Field label="Training focus"><input value={profile.trainingFocus} onChange={(e) => updateProfile({ trainingFocus: e.target.value })} placeholder="Boxing, gym, walking…" className="field" /></Field>
          <Field label="Biggest struggle"><input value={profile.biggestStruggle} onChange={(e) => updateProfile({ biggestStruggle: e.target.value })} placeholder="Hunger, evenings, scale panic…" className="field" /></Field>
          <Field label="Food style"><input value={profile.foodStyle} onChange={(e) => updateProfile({ foodStyle: e.target.value })} placeholder="Simple meals, high protein…" className="field" /></Field>
          <Field label="Tracker used"><select value={profile.trackerApp} onChange={(e) => updateProfile({ trackerApp: e.target.value as TrackerApp })} className="field"><option>None yet</option><option>NutriCheck</option><option>MyFitnessPal</option><option>Cronometer</option><option>Lose It</option><option>Other</option></select></Field>
          <Field label="Calorie target"><input value={profile.calorieTarget} onChange={(e) => updateProfile({ calorieTarget: e.target.value })} placeholder="Optional" className="field" /></Field>
          <Field label="Protein target"><input value={profile.proteinTarget} onChange={(e) => updateProfile({ proteinTarget: e.target.value })} placeholder="Optional" className="field" /></Field>
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.045] p-4"><p className="text-sm font-semibold text-white">Recognised patterns</p><p className="mt-2 text-sm leading-6 text-white/55">{state.memory.patterns.length ? state.memory.patterns.join(" ") : "George will build this from repeated check-ins, not full transcripts."}</p></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{Object.entries(GOAL_LABELS).map(([value, label]) => <button key={value} onClick={() => onStartPhase(value as Goal)} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-left text-white transition hover:bg-white/[0.09]"><span>Start {label} phase</span><ArrowRight className="h-4 w-4 text-[#d8ae72]" /></button>)}</div>
        <div className="mt-5 flex flex-wrap gap-3"><button onClick={onClose} className="inline-flex items-center gap-2 rounded-2xl bg-[#b58a53] px-5 py-3 font-semibold text-white hover:bg-[#c79b61]">Save <CheckCircle2 className="h-5 w-5" /></button><button onClick={onDeleteAll} className="inline-flex items-center gap-2 rounded-2xl border border-red-300/20 bg-red-500/10 px-5 py-3 font-semibold text-red-100 hover:bg-red-500/15"><Trash2 className="h-5 w-5" />{pendingDeleteConfirm ? "Click again to delete all data" : "Delete all data"}</button></div>
      </div>
      <style jsx>{`.field{margin-top:.35rem;width:100%;border-radius:1rem;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);padding:.8rem .9rem;color:white;outline:none}.field::placeholder{color:rgba(255,255,255,.35)}.field option{color:#090909}.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="text-sm font-medium text-white/82">{label}{children}</label>; }
