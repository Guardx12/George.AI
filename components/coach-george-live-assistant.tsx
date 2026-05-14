"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Dumbbell,
  Flame,
  Loader2,
  Mic,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Utensils,
  Weight,
  X,
} from "lucide-react";

type ConnectionState = "idle" | "connecting" | "connected" | "error";
type MessageRole = "assistant" | "user" | "system";
type Goal = "fat-loss" | "strength" | "boxing" | "running" | "general-health" | "maintenance" | "muscle";
type CoachingStyle = "straight" | "calm" | "supportive";
type TrackerApp = "NutriCheck" | "MyFitnessPal" | "Cronometer" | "Lose It" | "Other" | "None yet";
type ProfileStatus = "new" | "started" | "complete";

type LiveMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

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

type CoachingMemory = {
  notes: string[];
  lastSummary: string;
  updatedAt: string | null;
};

type CoachState = {
  profile: CoachProfile;
  activePhase: ActivePhase;
  archivedPhases: ActivePhase[];
  progress: ProgressEntry[];
  memory: CoachingMemory;
  messages: LiveMessage[];
  onboardingComplete: boolean;
};

const STORAGE_KEY = "coach-george-transformation-v3";

const GOAL_LABELS: Record<Goal, string> = {
  "fat-loss": "Fat loss",
  strength: "Strength",
  boxing: "Boxing fitness",
  running: "Running fitness",
  "general-health": "General health",
  maintenance: "Maintenance",
  muscle: "Build muscle",
};

const QUICK_ACTIONS = [
  "What should I eat tonight?",
  "I’m struggling today",
  "My weight went up",
];

function uid(prefix = "id") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function makeMessage(role: MessageRole, content: string): LiveMessage {
  return { id: uid(role), role, content, createdAt: new Date().toISOString() };
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
    trackerApp: "NutriCheck",
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
    todayFocus: "Protein, movement, and one clean next decision.",
    status: "active",
  };
}

const INITIAL_STATE: CoachState = {
  profile: defaultProfile(),
  activePhase: defaultPhase("fat-loss"),
  archivedPhases: [],
  progress: [],
  memory: { notes: [], lastSummary: "", updatedAt: null },
  messages: [
    makeMessage(
      "assistant",
      "Tap to talk when you’re ready. Tell me what’s going on — food, training, hunger, weight, motivation, or getting back on track — and I’ll help you make the next good move.",
    ),
  ],
  onboardingComplete: false,
};

function normalize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildVoiceRendererInstructions() {
  return [
    "You are Coach George's voice renderer.",
    "The app decides the exact reply text.",
    "Only speak the exact text provided by the app.",
    "Do not add, remove, summarise, paraphrase, calculate plans, diagnose medical issues, or improvise.",
  ].join(" ");
}

function buildRealtimeSessionPayload(instructions: string) {
  return {
    type: "realtime",
    instructions,
    audio: {
      input: {
        transcription: { model: "gpt-4o-mini-transcribe", language: "en" },
        turn_detection: {
          type: "semantic_vad",
          eagerness: "high",
          create_response: false,
          interrupt_response: true,
        },
      },
      output: { voice: "cedar", speed: 1.0 },
    },
  };
}

function profileCompletion(profile: CoachProfile) {
  const fields = [
    profile.goal,
    profile.currentWeightKg,
    profile.targetWeightKg,
    profile.trainingFocus,
    profile.biggestStruggle,
    profile.foodStyle,
    profile.trackerApp,
  ];
  const complete = fields.filter(Boolean).length;
  return Math.round((complete / fields.length) * 100);
}

function getTrackerPhrase(state: CoachState) {
  if (state.profile.trackerApp && state.profile.trackerApp !== "None yet" && state.profile.trackerApp !== "Other") {
    return `${state.profile.trackerApp}, or any tracker you prefer`;
  }
  return "a tracking app like NutriCheck, MyFitnessPal, Cronometer, Lose It, or whatever you prefer";
}

function isInScope(input: string) {
  return /(food|meal|eat|eating|hungry|hunger|craving|snack|calorie|macro|protein|carb|fat|tracker|nutricheck|myfitnesspal|cronometer|lose it|weight|scale|weigh|gain|lost|loss|fat|muscle|training|workout|gym|run|running|boxing|cardio|strength|steps|walk|motivation|struggling|quit|give up|reset|goal|phase|plan|routine|habit|sleep|stress|water|takeaway|restaurant|off plan|bad day|binge|profile|setup|start|check in|injury|pain|hurt)/.test(input);
}

function buildMemoryLine(state: CoachState) {
  const notes = state.memory.notes.slice(-4).join(" ");
  const target = state.profile.calorieTarget || state.profile.proteinTarget
    ? `Guidance targets: ${state.profile.calorieTarget || "unknown calories"}${state.profile.proteinTarget ? `, ${state.profile.proteinTarget}g protein` : ""}.`
    : "No exact targets saved yet.";
  return `${state.profile.name ? `${state.profile.name}. ` : ""}Goal: ${GOAL_LABELS[state.activePhase.goal]}. ${target} Main struggle: ${state.profile.biggestStruggle || state.activePhase.biggestRisk}. ${notes}`;
}

function inferCoachingNote(input: string) {
  const text = normalize(input);
  if (/hungry|starving|craving/.test(text)) return "User may need hunger-management support and higher-volume protein options.";
  if (/weight went up|scale|heavier|gained/.test(text)) return "User may panic around scale fluctuations; remind them to use trends, not single weigh-ins.";
  if (/messed up|fell off|binge|bad day|takeaway/.test(text)) return "User benefits from rescue-mode coaching after off-plan meals.";
  if (/boxing|fight|bag|conditioning/.test(text)) return "User is interested in boxing-style conditioning and identity-based training.";
  if (/late night|night|evening/.test(text)) return "Evening or late-night eating may be a risk point.";
  return null;
}

function addUniqueNote(notes: string[], note: string) {
  const exists = notes.some((item) => item.toLowerCase() === note.toLowerCase());
  if (exists) return notes;
  return [...notes.slice(-9), note];
}

function getNextOnboardingQuestion(profile: CoachProfile) {
  if (!profile.currentWeightKg) return "Good. What do you weigh roughly at the moment?";
  if (!profile.targetWeightKg && profile.goal === "fat-loss") return "And where would you like to get to eventually? A rough target is fine.";
  if (!profile.trainingFocus) return "What training are you doing, or what do you want to start with?";
  if (!profile.biggestStruggle) return "What normally knocks you off track — hunger, evenings, motivation, the scale, weekends, or something else?";
  if (!profile.trackerApp || profile.trackerApp === "None yet") return "Are you using a tracking app for exact numbers, like NutriCheck, MyFitnessPal, Cronometer, Lose It, or something else?";
  return "Perfect. I’ve got enough to start coaching you. Tell me what you need help with right now.";
}

function getIntroLine(state: CoachState) {
  if (!state.onboardingComplete || state.profile.profileStatus !== "complete") {
    return "Hi, I’m George. I’ll help you with food, training, motivation, and staying on track. First, what are we working towards — fat loss, boxing, strength, running, or general health?";
  }
  const name = state.profile.name ? ` ${state.profile.name}` : "";
  return `Ready${name}. Current phase: ${GOAL_LABELS[state.activePhase.goal]}. Tell me what’s going on and I’ll help with the next move.`;
}

function buildCoachReply(rawInput: string, state: CoachState) {
  const input = normalize(rawInput);
  const phase = state.activePhase;
  const trackerPhrase = getTrackerPhrase(state);
  const protein = state.profile.proteinTarget ? `${state.profile.proteinTarget}g protein` : "protein";
  const calories = state.profile.calorieTarget ? `around ${state.profile.calorieTarget} calories` : "your calorie range";

  if (!isInScope(input)) {
    return "I’m Coach George, so I’m going to keep us focused on food, training, progress, motivation, and staying on track. Bring me something around your goal and I’ll help you make the next good move.";
  }

  if (/which tracker|what tracker|tracking app|what app/.test(input)) {
    return "Use whichever tracker feels easiest for exact numbers — NutriCheck, MyFitnessPal, Cronometer, Lose It, or another one you already like. I’m here for the coaching: what to eat next, how to handle hunger, what the scale means, and how to stay on track.";
  }

  if (state.profile.profileStatus !== "complete" && /(fat loss|lose weight|lose fat|boxing|strength|running|run|general health|maintenance|muscle|just fat loss)/.test(input)) {
    return getNextOnboardingQuestion(state.profile);
  }

  const clearCoachingRequest = /(what should i eat|what to eat|eat tonight|dinner|next meal|lunch|breakfast|i m hungry|im hungry|starving|craving|weight went up|scale went up|messed up|fell off|off plan|bad day|binge|training today|workout|reset|change goal|motivation|struggling|quit|give up)/.test(input);
  if (state.profile.profileStatus !== "complete" && !clearCoachingRequest) {
    return getNextOnboardingQuestion(state.profile);
  }

  if (/set up|setup|profile|start/.test(input) && !/reset|again/.test(input)) {
    return "Good. We’ll keep this simple. Tell me your goal, rough current weight, training focus, biggest struggle, and what tracker you use for exact numbers. I’ll turn that into practical coaching.";
  }

  if (/what should i eat|what to eat|eat tonight|dinner|next meal|lunch|breakfast/.test(input)) {
    return `Go protein first. Pick something like chicken, lean mince, eggs, fish, Greek yogurt, tofu, or beans. Add veg or salad. Add carbs if you’ve trained, you’re active, or your tracker says you’ve got room. Use ${trackerPhrase} for the exact grams — I’ll help you choose the right kind of meal.`;
  }

  if (/hungry|starving|craving|snack/.test(input)) {
    return "No panic. Hunger is a signal, not a failure. First move: protein plus volume. Think Greek yogurt, protein shake, eggs, lean meat, soup, salad, fruit, or veg. Don’t slash tomorrow’s food as punishment. Win the next decision and stay calm.";
  }

  if (/messed up|fell off|off plan|bad day|binge|ruined|takeaway|pizza|kebab/.test(input)) {
    return "You haven’t ruined anything. One rough meal only becomes a problem if you turn it into a rough week. Do not punish yourself. Next move: water, normal next meal, protein high, and back to routine. The reset starts with the next decision, not Monday.";
  }

  if (/weight went up|scale went up|gained|heavier|water weight|stall|plateau/.test(input)) {
    return "Don’t react to one weigh-in. A sudden jump is usually water, carbs, salt, stress, soreness, sleep, or digestion — not instant fat gain. Look at the 7-day trend. If the trend is flat for two honest weeks, then we adjust. Until then, stay steady.";
  }

  if (/calorie|macro|protein|target/.test(input)) {
    return `Use ${trackerPhrase} for exact logging. My job is to help you use the numbers calmly. For this phase, the big rocks are ${calories}, ${protein}, consistent meals, and training you can repeat. Paste your totals and I’ll tell you what they mean and what to do next.`;
  }

  if (/workout|training|gym|home|boxing|run|running|cardio|strength/.test(input)) {
    if (/boxing/.test(input) || phase.goal === "boxing") {
      return "Boxing focus today: warm up for 5 minutes, then do 6 to 8 rounds of 2 minutes shadowboxing, bag work, or skipping with 1 minute rest. Finish with simple strength: squats, push-ups, rows, and carries. Keep it repeatable — we’re building the engine.";
    }
    if (/running|run/.test(input) || phase.goal === "running") {
      return "Running focus today: keep it controlled. Start with an easy walk-jog or steady zone-2 effort. Don’t turn every run into a test. The goal is consistency, joints feeling good, and building the habit without blowing up.";
    }
    return "Training today should be simple and repeatable: legs, push, pull, and a short finisher. Don’t chase perfect. Do a session you can recover from and repeat. Tell me home or gym and I’ll make it more specific.";
  }

  if (/injury|pain|hurt|dizzy|chest pain|faint|sick/.test(input)) {
    return "Play this safe. Don’t push through pain, dizziness, chest pain, or anything that feels wrong. I can help you adjust training around minor aches, but anything worrying needs proper medical or professional advice. Today’s priority is not being stupid with your body.";
  }

  if (/reset|change goal|new goal|start again|different goal|switch/.test(input)) {
    return "We can change direction safely. Small tweaks adjust this phase. A new goal starts a new phase and keeps your old history archived. A full reset clears everything. Don’t reset because of one bad day — only reset if the direction has genuinely changed.";
  }

  if (/motivation|struggling|can t be bothered|cant be bothered|quit|give up/.test(input)) {
    return "Don’t try to win the whole transformation today. Win the next action. One meal. One walk. One workout. One honest check-in. You don’t need a perfect day — you need proof you’re still the kind of person who keeps going.";
  }

  if (/nutricheck|myfitnesspal|fitness pal|cronometer|lose it|tracker/.test(input)) {
    return `Perfect — use ${trackerPhrase} as the source of truth for exact calories and grams. Bring me the situation: what you’ve eaten, what’s left, how hungry you are, and what you’re tempted to do. I’ll coach the next move.`;
  }

  return "I’m here for the next decision. Ask me what to eat, how to train, what your weight change means, how to recover from a bad day, or how to stay on track tonight. Use a tracker for exact numbers — bring me the situation and I’ll coach the move.";
}

function extractProfileFromText(input: string, current: CoachProfile): CoachProfile {
  const text = normalize(input);
  const next = { ...current };
  const goalMatch = text.match(/fat loss|lose weight|lose fat|boxing|strength|running|run|general health|maintenance|muscle/);
  if (goalMatch) {
    if (/boxing/.test(goalMatch[0])) next.goal = "boxing";
    else if (/strength/.test(goalMatch[0])) next.goal = "strength";
    else if (/running|run/.test(goalMatch[0])) next.goal = "running";
    else if (/maintenance/.test(goalMatch[0])) next.goal = "maintenance";
    else if (/muscle/.test(goalMatch[0])) next.goal = "muscle";
    else if (/general/.test(goalMatch[0])) next.goal = "general-health";
    else next.goal = "fat-loss";
  }
  const weightMatch = text.match(/(?:weigh|weight|currently|i m|im|i am)\s*(\d{2,3}(?:\.\d)?)(?:\s*kg)?/);
  if (weightMatch && !next.currentWeightKg) next.currentWeightKg = weightMatch[1];
  const targetMatch = text.match(/(?:target|goal weight|want to be|get to|down to)\s*(\d{2,3}(?:\.\d)?)(?:\s*kg)?/);
  if (targetMatch && !next.targetWeightKg) next.targetWeightKg = targetMatch[1];
  if (/nutricheck/.test(text)) next.trackerApp = "NutriCheck";
  if (/myfitnesspal|fitness pal/.test(text)) next.trackerApp = "MyFitnessPal";
  if (/cronometer/.test(text)) next.trackerApp = "Cronometer";
  if (/lose it/.test(text)) next.trackerApp = "Lose It";
  if (/late night|night eating|evening/.test(text)) next.biggestStruggle = "Late-night eating";
  if (/hunger|hungry|cravings/.test(text)) next.biggestStruggle = "Hunger and cravings";
  if (/motivation|consistency|fall off|quit/.test(text)) next.biggestStruggle = "Consistency";
  if (/boxing|gym|home|weights|running/.test(text)) next.trainingFocus = rawTrainingFocus(input);
  next.profileStatus = profileCompletion(next) >= 70 ? "complete" : "started";
  return next;
}

function rawTrainingFocus(input: string) {
  if (/boxing/i.test(input)) return "Boxing and conditioning";
  if (/running|run/i.test(input)) return "Running fitness";
  if (/gym|weights|strength/i.test(input)) return "Gym strength training";
  if (/home/i.test(input)) return "Home training";
  return "General training";
}

function statusBadge(status: ProfileStatus) {
  if (status === "complete") return "Profile ready";
  if (status === "started") return "Profile started";
  return "New setup";
}

export function CoachGeorgeLiveAssistant() {
  const [state, setState] = useState<CoachState>(INITIAL_STATE);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showChangePanel, setShowChangePanel] = useState(false);
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
  const completion = profileCompletion(state.profile);
  const latestProgress = state.progress[0];

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CoachState;
        setState({
          ...INITIAL_STATE,
          ...parsed,
          profile: { ...defaultProfile(), ...(parsed.profile || {}) },
          activePhase: parsed.activePhase || defaultPhase(parsed.profile?.goal || "fat-loss"),
          archivedPhases: parsed.archivedPhases || [],
          progress: parsed.progress || [],
          memory: parsed.memory || INITIAL_STATE.memory,
          messages: (parsed.messages || INITIAL_STATE.messages).slice(-80),
        });
      }
    } catch {
      // ignore corrupted local storage
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, messages: state.messages.slice(-80) }));
  }, [state, hydrated]);

  useEffect(() => {
    if (!chatScrollRef.current) return;
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [state.messages]);

  useEffect(() => {
    return () => {
      void cleanupConversation();
    };
  }, []);

  function appendMessage(role: MessageRole, content: string) {
    setState((prev) => ({ ...prev, messages: [...prev.messages.slice(-79), makeMessage(role, content)] }));
  }

  function speakIfConnected(textToSpeak: string) {
    const channel = dcRef.current;
    if (!channel || channel.readyState !== "open") return;
    const safeText = textToSpeak.trim();
    if (!safeText) return;
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
                  text: `Speak the following text exactly as written. Do not add, remove, summarise, paraphrase, change, or answer anything else.\n\n${safeText}`,
                },
              ],
            },
          ],
        },
      }),
    );
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
    const note = inferCoachingNote(cleaned);
    const nextStateForReply = {
      ...stateRef.current,
      profile: nextProfile,
      activePhase: { ...stateRef.current.activePhase, goal: nextProfile.goal, title: GOAL_LABELS[nextProfile.goal] },
    };
    const reply = buildCoachReply(cleaned, nextStateForReply);

    setState((prev) => {
      const updatedProfile = extractProfileFromText(cleaned, prev.profile);
      const maybePhase = updatedProfile.goal !== prev.activePhase.goal && prev.profile.profileStatus === "new"
        ? { ...prev.activePhase, goal: updatedProfile.goal, title: GOAL_LABELS[updatedProfile.goal] }
        : prev.activePhase;
      return {
        ...prev,
        profile: updatedProfile,
        activePhase: maybePhase,
        onboardingComplete: updatedProfile.profileStatus === "complete" ? true : prev.onboardingComplete,
        memory: note
          ? {
              notes: addUniqueNote(prev.memory.notes, note),
              lastSummary: `Latest useful signal: ${note}`,
              updatedAt: new Date().toISOString(),
            }
          : prev.memory,
      };
    });

    respond(reply);
  }

  function handleQuickPrompt(prompt: string) {
    handleUserInput(prompt);
  }

  function handleTextSubmit(event?: FormEvent) {
    event?.preventDefault();
    const value = textInput;
    setTextInput("");
    handleUserInput(value);
  }

  function updateProfile(patch: Partial<CoachProfile>) {
    setState((prev) => {
      const profile = { ...prev.profile, ...patch };
      profile.profileStatus = profileCompletion(profile) >= 70 ? "complete" : "started";
      const activePhase = patch.goal ? { ...prev.activePhase, goal: profile.goal, title: GOAL_LABELS[profile.goal] } : prev.activePhase;
      return { ...prev, profile, activePhase, onboardingComplete: profile.profileStatus === "complete" ? true : prev.onboardingComplete };
    });
  }

  function saveProgressEntry(entry: Partial<ProgressEntry>) {
    const item: ProgressEntry = {
      id: uid("progress"),
      date: todayIso(),
      note: entry.note || "Quick check-in saved.",
      ...entry,
    };
    setState((prev) => ({ ...prev, progress: [item, ...prev.progress].slice(0, 60) }));
    respond("Check-in saved. I’ll use that context when I coach the next decision.");
  }

  function startNewPhase(goal: Goal) {
    setState((prev) => ({
      ...prev,
      archivedPhases: [{ ...prev.activePhase, status: "archived" }, ...prev.archivedPhases].slice(0, 12),
      activePhase: defaultPhase(goal),
      profile: { ...prev.profile, goal, profileStatus: prev.profile.profileStatus === "new" ? "started" : prev.profile.profileStatus },
      messages: [
        ...prev.messages,
        makeMessage("system", `New phase started: ${GOAL_LABELS[goal]}. Previous phase archived, not deleted.`),
      ],
    }));
    setShowChangePanel(false);
    respond(`New phase started: ${GOAL_LABELS[goal]}. I’ve archived the old phase instead of deleting it, so your history stays safe.`);
  }

  function resetCurrentPhase() {
    setState((prev) => ({
      ...prev,
      activePhase: defaultPhase(prev.profile.goal),
      progress: [],
      memory: { ...prev.memory, lastSummary: "Current phase was reset. Profile and archived phases kept.", updatedAt: new Date().toISOString() },
      messages: [...prev.messages, makeMessage("system", "Current phase reset. Profile kept. Archived phases kept.")],
    }));
    setShowChangePanel(false);
    respond("Current phase reset. I’ve kept your profile and archived history, but cleared this phase’s progress so we can start clean.");
  }

  function deleteAllData() {
    if (!pendingDeleteConfirm) {
      setPendingDeleteConfirm(true);
      return;
    }
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    setPendingDeleteConfirm(false);
    setShowChangePanel(false);
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
      remoteAudio.playsInline = true;
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
        dataChannel.send(
          JSON.stringify({ type: "session.update", session: buildRealtimeSessionPayload(buildVoiceRendererInstructions()) }),
        );
        if (!greetedSessionRef.current) {
          greetedSessionRef.current = true;
          respond(getIntroLine(stateRef.current));
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
          // ignore bad payloads
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

  const dashboardCards = useMemo(
    () => [
      { label: "Current Phase", value: GOAL_LABELS[state.activePhase.goal], icon: Target },
      { label: "Today’s Focus", value: state.activePhase.todayFocus, icon: Flame },
      { label: "Biggest Risk", value: state.profile.biggestStruggle || state.activePhase.biggestRisk, icon: AlertTriangle },
    ],
    [state.activePhase, state.profile.biggestStruggle],
  );

  return (
    <section className="relative mx-auto min-h-screen max-w-[1180px] overflow-hidden px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(72,164,255,0.22),rgba(72,164,255,0)_68%)]" />
      <div className="pointer-events-none absolute right-[-120px] top-[260px] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(138,92,255,0.16),rgba(138,92,255,0)_65%)]" />

      <div className="relative grid gap-5 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-5">
          <div className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.045))] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                <Sparkles className="h-4 w-4 text-sky-300" />
                {statusBadge(state.profile.profileStatus)} · {completion}%
              </div>
              <button
                type="button"
                onClick={() => setShowProfile((value) => !value)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/[0.1]"
              >
                Coach Profile <ChevronDown className={`h-4 w-4 transition ${showProfile ? "rotate-180" : ""}`} />
              </button>
            </div>

            <div className="mt-8 text-center">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">
                Meet Coach George
              </h1>
              <p className="mx-auto mt-4 max-w-[660px] text-lg leading-8 text-white/72 sm:text-xl">
                Your coach for food, training, daily guidance, and getting back on track when life happens.
              </p>
              <p className="mx-auto mt-3 max-w-[620px] text-sm leading-6 text-white/52">
                Use your favourite tracker for exact numbers. Use George for the next decision.
              </p>
            </div>

            <div className="mx-auto mt-8 flex max-w-[300px] flex-col items-center">
              <button
                type="button"
                onClick={connectionState === "connected" ? stopConversation : startConversation}
                disabled={!hydrated || connectionState === "connecting"}
                className={`group relative flex h-[190px] w-[190px] items-center justify-center rounded-full border border-sky-200/35 bg-[radial-gradient(circle_at_50%_35%,rgba(125,211,252,0.34),rgba(59,130,246,0.2)_35%,rgba(8,13,24,0.92)_72%)] shadow-[0_0_42px_rgba(56,189,248,0.34),0_18px_70px_rgba(0,0,0,0.55),inset_0_0_28px_rgba(255,255,255,0.08)] transition duration-300 hover:scale-[1.015] disabled:opacity-60 sm:h-[226px] sm:w-[226px] ${connectionState === "connected" ? "animate-pulse" : ""}`}
              >
                <span className="absolute inset-[12px] rounded-full border border-white/10" />
                <span className="absolute inset-[-12px] rounded-full border border-sky-300/10 opacity-0 transition group-hover:opacity-100" />
                <div className="flex flex-col items-center gap-3">
                  {connectionState === "connecting" ? (
                    <Loader2 className="h-11 w-11 animate-spin text-white" />
                  ) : (
                    <Mic className="h-12 w-12 text-white" />
                  )}
                  <span className="text-2xl font-semibold tracking-tight text-white">
                    {connectionState === "connected" ? "Listening" : "Tap to Talk"}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.22em] text-sky-100/65">
                    {connectionState === "connected" ? "Tap to stop" : "George is ready"}
                  </span>
                </div>
              </button>
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <div className="mx-auto mt-8 grid max-w-[720px] gap-2 sm:grid-cols-3">
              {QUICK_ACTIONS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleQuickPrompt(prompt)}
                  className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-left text-sm font-semibold text-white/86 transition hover:border-sky-200/30 hover:bg-white/[0.09]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {dashboardCards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-[26px] border border-white/10 bg-white/[0.055] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-300/10 text-sky-200">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">{label}</p>
                <p className="mt-2 text-base font-semibold leading-6 text-white/90">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 rounded-[24px] border border-white/10 bg-white/[0.035] p-3 text-sm text-white/65">
            <button onClick={() => saveProgressEntry({ weightKg: state.profile.currentWeightKg, note: "Quick check-in saved from dashboard." })} className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/[0.08]">Save check-in</button>
            <button onClick={() => handleQuickPrompt("Training today")} className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/[0.08]">Training idea</button>
            <button onClick={() => setShowChangePanel(true)} className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/[0.08]">Change goal safely</button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[34px] border border-white/10 bg-[#08101d]/80 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.44)] backdrop-blur-2xl sm:p-5">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-sm font-semibold text-white">Coach conversation</p>
                <p className="mt-1 text-xs text-white/45">Voice or type. George stores useful summaries, not messy transcripts forever.</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-semibold text-white/60">
                {connectionState}
              </div>
            </div>

            <div ref={chatScrollRef} className="mt-4 h-[510px] space-y-3 overflow-y-auto pr-1">
              {state.messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[86%] whitespace-pre-wrap rounded-[22px] px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-sky-400 text-[#06111f]" : message.role === "system" ? "border border-white/10 bg-white/[0.04] text-white/50" : "bg-white/[0.075] text-white/86"}`}>
                    {message.content}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleTextSubmit} className="mt-4 flex gap-2">
              <input
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                placeholder="Type what you need help with…"
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-sky-300/40"
              />
              <button type="submit" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-300 text-[#06111f] transition hover:bg-sky-200">
                <Send className="h-5 w-5" />
              </button>
            </form>
          </div>

          <details className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 text-white/70">
            <summary className="cursor-pointer text-sm font-semibold text-white/85">Coaching memory and latest check-in</summary>
            <p className="mt-3 text-sm leading-6 text-white/58">{buildMemoryLine(state)}</p>
            <p className="mt-3 text-sm leading-6 text-white/50">{latestProgress ? `${latestProgress.date}: ${latestProgress.note}` : "No check-in yet."}</p>
          </details>
        </div>
      </div>

      {showProfile ? (
        <ProfilePanel state={state} updateProfile={updateProfile} onClose={() => setShowProfile(false)} />
      ) : null}

      {showChangePanel ? (
        <ChangePanel
          state={state}
          onClose={() => { setShowChangePanel(false); setPendingDeleteConfirm(false); }}
          onStartPhase={startNewPhase}
          onResetPhase={resetCurrentPhase}
          onDeleteAll={deleteAllData}
          pendingDeleteConfirm={pendingDeleteConfirm}
        />
      ) : null}
    </section>
  );
}

function ProfilePanel({
  state,
  updateProfile,
  onClose,
}: {
  state: CoachState;
  updateProfile: (patch: Partial<CoachProfile>) => void;
  onClose: () => void;
}) {
  const profile = state.profile;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-[32px] border border-white/10 bg-[#08101d] p-5 shadow-[0_28px_120px_rgba(0,0,0,0.7)] sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/70">Coach profile</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Teach George how to coach you</h2>
            <p className="mt-2 text-sm text-white/55">Quick details George uses to keep the coaching personal. No long age/sex/macro form.</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-white/10 bg-white/[0.06] p-2 text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input value={profile.name} onChange={(e) => updateProfile({ name: e.target.value })} placeholder="Optional" className="field" />
          </Field>
          <Field label="Main goal">
            <select value={profile.goal} onChange={(e) => updateProfile({ goal: e.target.value as Goal })} className="field">
              {Object.entries(GOAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Current weight">
            <input value={profile.currentWeightKg} onChange={(e) => updateProfile({ currentWeightKg: e.target.value })} placeholder="kg" className="field" />
          </Field>
          <Field label="Target weight">
            <input value={profile.targetWeightKg} onChange={(e) => updateProfile({ targetWeightKg: e.target.value })} placeholder="kg or leave blank" className="field" />
          </Field>
          <Field label="Training focus">
            <input value={profile.trainingFocus} onChange={(e) => updateProfile({ trainingFocus: e.target.value })} placeholder="Boxing, gym, running, home workouts…" className="field" />
          </Field>
          <Field label="Biggest struggle">
            <input value={profile.biggestStruggle} onChange={(e) => updateProfile({ biggestStruggle: e.target.value })} placeholder="Hunger, nights, consistency, scale panic…" className="field" />
          </Field>
          <Field label="Food style">
            <input value={profile.foodStyle} onChange={(e) => updateProfile({ foodStyle: e.target.value })} placeholder="Simple meals, high protein, family meals…" className="field" />
          </Field>
          <Field label="Tracker used">
            <select value={profile.trackerApp} onChange={(e) => updateProfile({ trackerApp: e.target.value as TrackerApp })} className="field">
              <option>NutriCheck</option>
              <option>MyFitnessPal</option>
              <option>Cronometer</option>
              <option>Lose It</option>
              <option>Other</option>
              <option>None yet</option>
            </select>
          </Field>
          <Field label="Calorie target, if known">
            <input value={profile.calorieTarget} onChange={(e) => updateProfile({ calorieTarget: e.target.value })} placeholder="e.g. 2800" className="field" />
          </Field>
          <Field label="Protein target, if known">
            <input value={profile.proteinTarget} onChange={(e) => updateProfile({ proteinTarget: e.target.value })} placeholder="e.g. 200" className="field" />
          </Field>
          <Field label="Coaching style">
            <select value={profile.coachingStyle} onChange={(e) => updateProfile({ coachingStyle: e.target.value as CoachingStyle })} className="field">
              <option value="straight">Straight-talking</option>
              <option value="calm">Calm and reassuring</option>
              <option value="supportive">Supportive</option>
            </select>
          </Field>
        </div>
        <button onClick={onClose} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-sky-300 px-5 py-3 font-semibold text-[#06111f] hover:bg-sky-200">
          Save profile <CheckCircle2 className="h-5 w-5" />
        </button>
      </div>
      <style jsx>{`
        .field {
          margin-top: 0.35rem;
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.06);
          padding: 0.8rem 0.9rem;
          color: white;
          outline: none;
        }
        .field::placeholder { color: rgba(255,255,255,0.35); }
        .field option { color: #08101d; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="text-sm font-medium text-white/82">{label}{children}</label>;
}

function ChangePanel({
  state,
  onClose,
  onStartPhase,
  onResetPhase,
  onDeleteAll,
  pendingDeleteConfirm,
}: {
  state: CoachState;
  onClose: () => void;
  onStartPhase: (goal: Goal) => void;
  onResetPhase: () => void;
  onDeleteAll: () => void;
  pendingDeleteConfirm: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-[720px] rounded-[32px] border border-white/10 bg-[#08101d] p-5 shadow-[0_28px_120px_rgba(0,0,0,0.7)] sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/70">Safe change controls</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Change direction without wrecking history</h2>
            <p className="mt-2 text-sm text-white/55">Current phase: {GOAL_LABELS[state.activePhase.goal]}. Old phases are archived, not deleted.</p>
          </div>
          <button onClick={onClose} className="rounded-full border border-white/10 bg-white/[0.06] p-2 text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(GOAL_LABELS).map(([value, label]) => (
            <button key={value} onClick={() => onStartPhase(value as Goal)} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-left text-white transition hover:bg-white/[0.09]">
              <span>Start {label} phase</span><ArrowRight className="h-4 w-4 text-sky-200" />
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button onClick={onResetPhase} className="rounded-2xl border border-amber-200/20 bg-amber-400/10 px-4 py-3 text-left font-semibold text-amber-100 hover:bg-amber-400/15">
            <RefreshCw className="mb-2 h-5 w-5" /> Reset current phase only
            <p className="mt-1 text-sm font-normal text-amber-100/65">Keeps profile and archived phases.</p>
          </button>
          <button onClick={onDeleteAll} className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-left font-semibold text-red-100 hover:bg-red-500/15">
            <Trash2 className="mb-2 h-5 w-5" /> {pendingDeleteConfirm ? "Click again to delete all data" : "Delete all data"}
            <p className="mt-1 text-sm font-normal text-red-100/65">Full wipe. Use only if you really mean it.</p>
          </button>
        </div>
      </div>
    </div>
  );
}
