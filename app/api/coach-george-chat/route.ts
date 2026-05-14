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

const SYSTEM_PROMPT = `You are Coach George.

This is intentionally simple: you are basically ChatGPT, but you are ONLY a fitness, food, fat-loss, training, motivation, habits, consistency, and staying-on-track coach.

Your job is to talk like a real coach, not like a nutrition article, not like a corporate app, and not like a scripted bot.

HOW TO COACH
- Think from context and memory, then answer naturally.
- Keep replies short: usually 1 to 5 sentences.
- Ask ONE useful question at a time when more context is needed.
- Focus on the next useful move, not a lecture.
- Be warm, direct, practical, and human.
- Use plain English. A UK tone is fine.
- Do not sound clinical, corporate, salesy, or over-optimised.
- Do not say robotic phrases like "hunger is data", "source of truth", or "next best decision" unless it genuinely sounds natural.
- Do not ask weird generic wellness-bot questions such as "do you have access to a fridge or cooler?".

WHAT GEORGE IS
George is the coach in the user's pocket. He helps the user talk through food, training, motivation, weight changes, cravings, bad days, routines, and getting back on track.

WHAT GEORGE IS NOT
- Not a general assistant.
- Not a calorie database.
- Not a medical professional.
- Not a meal-plan robot.
- Not a canned FAQ bot.

TRACKING APPS
George can sit beside any tracker. If exact calories or grams are needed, say "use your tracker" or "a tracking app like NutriCheck, MyFitnessPal, Cronometer, Lose It, or whatever you prefer." Do not repeatedly push one specific app.

ONBOARDING
Let the conversation feel natural. If you do not know the person yet, gradually learn:
1. goal
2. current weight
3. target/result
4. what usually knocks them off track
5. training situation
6. food tracking preference

If they answer one of these, accept it and move on. NEVER repeat the same question after they have answered it.

MEMORY
Use memory to personalise replies. Save useful facts and patterns, not every detail.
Examples of memory worth saving:
- Goal: fat loss
- Current weight: 159kg
- Target: 115kg
- Struggle: always on the go / time poor / grab-and-go food
- Pattern: scale anxiety / late-night eating / all-or-nothing thinking

RESPONSE EXAMPLES
User: "I'm hungry"
Good: "Alright — is this proper hunger or boredom/stress? What have you eaten so far today?"
Bad: "Hunger is data, not failure. Get protein and volume."

User: "I'm on the go all day and struggle making food"
Good: "Right, then we don’t build the plan around perfect meal prep. We build around better grab-and-go defaults. What do you usually end up buying when you're out?"
Bad: "Do you have access to a fridge or cooler during your day?"

User: "Weight went up"
Good: "Don’t panic yet. One weigh-in means very little. How many days has it been up for?"

BOUNDARIES
If the user asks about unrelated topics, redirect warmly:
"I’ll keep you focused as your coach. Bring me food, training, weight, motivation, or whatever’s trying to knock you off track."

SAFETY
Do not support starvation, dangerous rapid weight loss, punishment workouts, steroid abuse, dangerous supplement advice, or medical diagnosis. If there is pain, injury, worrying symptoms, eating disorder signs, or medical concerns, be conservative and suggest a qualified professional.

OUTPUT FORMAT
Return ONLY valid JSON with this exact shape:
{
  "reply": "what George says to the user",
  "memory": { updated memory object },
  "memoryNote": "one short private summary of anything important learned, or empty string",
  "outOfScope": false
}`

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

function addUnique(list: string[] | undefined, item: string) {
  return Array.from(new Set([...(list || []), item].filter(Boolean))).slice(0, 12)
}

function fallbackReply(message: string, memory: CoachMemory) {
  const lower = message.toLowerCase()
  const nextMemory: CoachMemory = { ...memory }
  const weightMatch = lower.match(/(\d{2,3}(?:\.\d+)?)\s*(kg|kilos|kilograms)?/)

  if (/politics|football score|weather|write.*code|business plan|website|email|essay/i.test(message)) {
    return { reply: "I’ll keep you focused as your coach. Bring me food, training, weight, motivation, or whatever’s trying to knock you off track.", memory: nextMemory, memoryNote: "", outOfScope: true }
  }

  if (!nextMemory.goal && /fat loss|lose weight|weight loss|cut|slim|drop weight/i.test(message)) {
    nextMemory.goal = "fat loss"
    return { reply: "Good — fat loss it is. Roughly what do you weigh at the moment?", memory: nextMemory, memoryNote: "User's main goal is fat loss.", outOfScope: false }
  }

  if (nextMemory.goal && !nextMemory.currentWeightKg && weightMatch) {
    nextMemory.currentWeightKg = `${weightMatch[1]}kg`
    return { reply: `Got it — ${nextMemory.currentWeightKg}. What would you like to get down to, roughly?`, memory: nextMemory, memoryNote: `User currently weighs about ${nextMemory.currentWeightKg}.`, outOfScope: false }
  }

  if (nextMemory.currentWeightKg && !nextMemory.targetWeightKg && weightMatch) {
    nextMemory.targetWeightKg = `${weightMatch[1]}kg`
    return { reply: `Nice — ${nextMemory.targetWeightKg} gives us a clear direction. What usually knocks you off track?`, memory: nextMemory, memoryNote: `User target weight is about ${nextMemory.targetWeightKg}.`, outOfScope: false }
  }

  if (/time|busy|on the go|rushing|grab|quick|convenience/.test(lower)) {
    nextMemory.struggles = addUnique(nextMemory.struggles, "time poor / on the go")
    return { reply: "Right, then we don’t build this around perfect meal prep. We build around better grab-and-go defaults. What do you usually end up buying when you’re out?", memory: nextMemory, memoryNote: "User struggles with time and convenience eating.", outOfScope: false }
  }

  if (/hungry|starving|craving|snack/.test(lower)) {
    nextMemory.patterns = addUnique(nextMemory.patterns, "hunger or cravings")
    return { reply: "Alright — is it proper hunger, or more boredom/stress? What have you eaten so far today?", memory: nextMemory, memoryNote: "User mentioned hunger or cravings.", outOfScope: false }
  }

  if (/weight.*up|scale.*up|put.*weight|weigh.*more/.test(lower)) {
    nextMemory.patterns = addUnique(nextMemory.patterns, "scale anxiety")
    return { reply: "Don’t panic yet. One weigh-in means very little. How many days has it been up for?", memory: nextMemory, memoryNote: "User may worry about scale fluctuations.", outOfScope: false }
  }

  if (/what.*suggest|what.*eat|food|meal|lunch|dinner|breakfast/.test(lower)) {
    return { reply: "Depends what the day looks like so far. Are you trying to keep it quick, keep calories controlled, or get more protein in?", memory: nextMemory, memoryNote: "", outOfScope: false }
  }

  return { reply: "Talk me through it. What’s happening today — food, training, weight, motivation, or the bit that’s trying to knock you off track?", memory: nextMemory, memoryNote: "", outOfScope: false }
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
    ? (body.messages as ChatMessage[]).filter((m) => (m.role === "assistant" || m.role === "user") && typeof m.content === "string").slice(-24)
    : []

  if (!userMessage) return Response.json({ reply: "Tell me what’s going on and I’ll coach you through it.", memory, memoryNote: "", outOfScope: false })
  if (!apiKey) return Response.json(fallbackReply(userMessage, memory))

  const conversationText = messages.map((m) => `${m.role === "user" ? "User" : "George"}: ${m.content}`).join("\n")
  const prompt = `MEMORY:\n${JSON.stringify(memory, null, 2)}\n\nRECENT CONVERSATION:\n${conversationText}\n\nNEW USER MESSAGE:\n${userMessage}\n\nRemember: answer like a real coach, not an article. Short, natural, one useful question if needed.`

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
        temperature: 0.72,
      }),
      cache: "no-store",
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) return Response.json(fallbackReply(userMessage, memory))

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
