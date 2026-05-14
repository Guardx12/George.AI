export const runtime = "nodejs"

type ChatMessage = {
  role: "assistant" | "user"
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

const SYSTEM_PROMPT = `You are Coach George, a premium voice-first fitness and weight-loss coach.

PRODUCT DEFINITION
You are not a general assistant. You are not a calorie tracking app. You are a focused coach for food, training, fat loss, consistency, motivation, cravings, weigh-ins, routines, body transformation, and staying on track.

CORE JOB
Help the user make the next right decision. Coach them like a supportive, direct human coach. Ask useful follow-up questions. Do not rely on canned scripts. Do not repeat the same answer every time.

TONE
- Warm, direct, calm, and human.
- Short replies by default: 2 to 6 sentences.
- Sound like a real coach, not a corporate app.
- Use simple language.
- Do not over-explain.
- No cheesy hype. No robotic phrases like "I am here for the next decision".

TRACKING APPS
George sits beside trackers. If exact calories/grams are needed, say to use "your tracker" or "a tracking app like NutriCheck, MyFitnessPal, Cronometer, Lose It, or whatever you prefer." Do not push only NutriCheck.

ONBOARDING
If you do not know enough about the user, ask naturally one question at a time. Good order:
1. What are we working towards?
2. Roughly what do you weigh now?
3. What would you like to get down to or achieve?
4. What usually knocks you off track?
5. Do you train at the moment?
6. Do you use a food tracker?
If they answer one question, accept it and move to the next. Never loop on the same question if they already answered.

MEMORY
Use the supplied memory to personalise replies. Notice patterns from the conversation such as late-night hunger, scale anxiety, missed training, all-or-nothing thinking, or repeated bad days. Mention patterns naturally only when useful.

BOUNDARIES
Stay within coaching for food, training, habit change, weight-loss, consistency, motivation, recovery, and progress. If asked about unrelated topics, politely redirect in a warm way.

SAFETY
Do not support starvation, extreme rapid weight loss, punishment workouts, steroid abuse, dangerous supplement advice, or medical diagnosis. For pain, injury, worrying symptoms, eating disorder signs, or medical issues, give conservative general guidance and suggest a qualified professional. Do not shame the user.

OUTPUT FORMAT
Return ONLY valid JSON with this shape:
{
  "reply": "what George says to the user",
  "memory": { updated memory object },
  "memoryNote": "one short private summary of anything important learned, or empty string",
  "outOfScope": false
}
No markdown outside JSON.`

function safeMemory(value: unknown): CoachMemory {
  if (!value || typeof value !== "object") return {}
  const input = value as Record<string, unknown>
  return {
    name: typeof input.name === "string" ? input.name : undefined,
    goal: typeof input.goal === "string" ? input.goal : undefined,
    currentWeightKg: typeof input.currentWeightKg === "string" ? input.currentWeightKg : undefined,
    targetWeightKg: typeof input.targetWeightKg === "string" ? input.targetWeightKg : undefined,
    trainingFocus: typeof input.trainingFocus === "string" ? input.trainingFocus : undefined,
    tracker: typeof input.tracker === "string" ? input.tracker : undefined,
    foodPreferences: Array.isArray(input.foodPreferences) ? input.foodPreferences.filter((x): x is string => typeof x === "string").slice(0, 12) : undefined,
    struggles: Array.isArray(input.struggles) ? input.struggles.filter((x): x is string => typeof x === "string").slice(0, 12) : undefined,
    patterns: Array.isArray(input.patterns) ? input.patterns.filter((x): x is string => typeof x === "string").slice(0, 12) : undefined,
    coachingStyle: typeof input.coachingStyle === "string" ? input.coachingStyle : undefined,
    lastSummary: typeof input.lastSummary === "string" ? input.lastSummary : undefined,
  }
}

function fallbackReply(message: string, memory: CoachMemory) {
  const lower = message.toLowerCase()
  const nextMemory = { ...memory }

  const weightMatch = lower.match(/(\d{2,3}(?:\.\d+)?)\s*(kg|kilos|kilograms)?/)
  if (!nextMemory.goal && /fat loss|lose weight|weight loss|cut|slim/i.test(message)) {
    nextMemory.goal = "fat loss"
    return { reply: "Good. Fat loss it is. Roughly what do you weigh at the moment?", memory: nextMemory, memoryNote: "User's main goal is fat loss.", outOfScope: false }
  }
  if (nextMemory.goal && !nextMemory.currentWeightKg && weightMatch) {
    nextMemory.currentWeightKg = `${weightMatch[1]}kg`
    return { reply: `Got it — ${nextMemory.currentWeightKg}. What would you like to get down to, or what result are you chasing first?`, memory: nextMemory, memoryNote: `User currently weighs about ${nextMemory.currentWeightKg}.`, outOfScope: false }
  }
  if (/hungry|starving|craving/.test(lower)) {
    return { reply: "Alright — proper hunger or just wanting something? Tell me what you’ve eaten today and roughly what time it is for you.", memory: nextMemory, memoryNote: "User mentioned hunger/cravings.", outOfScope: false }
  }
  if (/weight.*up|scale.*up|put.*weight/.test(lower)) {
    return { reply: "Don’t panic yet. One weigh-in is noisy — water, salt, carbs, sleep and soreness can all move it. How many days has it been up for?", memory: { ...nextMemory, patterns: Array.from(new Set([...(nextMemory.patterns || []), "scale anxiety"])).slice(0, 12) }, memoryNote: "User may worry about scale fluctuations.", outOfScope: false }
  }
  return { reply: "Talk me through it. What’s happening today — food, training, hunger, motivation, or the bit that’s trying to knock you off track?", memory: nextMemory, memoryNote: "", outOfScope: false }
}

function extractJson(text: string) {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON object found")
    return JSON.parse(match[0])
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  const body = await request.json().catch(() => ({}))
  const userMessage = typeof body?.message === "string" ? body.message.trim() : ""
  const memory = safeMemory(body?.memory)
  const messages = Array.isArray(body?.messages)
    ? (body.messages as ChatMessage[]).filter((m) => (m.role === "assistant" || m.role === "user") && typeof m.content === "string").slice(-16)
    : []

  if (!userMessage) {
    return Response.json({ reply: "Tell me what’s going on and I’ll coach you through it.", memory, memoryNote: "", outOfScope: false })
  }

  if (!apiKey) {
    return Response.json(fallbackReply(userMessage, memory))
  }

  const conversationText = messages.map((m) => `${m.role === "user" ? "User" : "George"}: ${m.content}`).join("\n")
  const prompt = `MEMORY:\n${JSON.stringify(memory, null, 2)}\n\nRECENT CONVERSATION:\n${conversationText}\n\nNEW USER MESSAGE:\n${userMessage}`

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.COACH_GEORGE_MODEL || "gpt-4.1-mini",
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.55,
      }),
      cache: "no-store",
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      return Response.json(fallbackReply(userMessage, memory))
    }

    const text = typeof data?.output_text === "string" ? data.output_text : data?.output?.flatMap?.((item: any) => item?.content || [])?.map?.((part: any) => part?.text || "")?.join?.("\n") || ""
    const parsed = extractJson(text)
    const updatedMemory = safeMemory(parsed.memory)
    return Response.json({
      reply: typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : fallbackReply(userMessage, memory).reply,
      memory: { ...memory, ...updatedMemory },
      memoryNote: typeof parsed.memoryNote === "string" ? parsed.memoryNote.trim() : "",
      outOfScope: Boolean(parsed.outOfScope),
    })
  } catch {
    return Response.json(fallbackReply(userMessage, memory))
  }
}
