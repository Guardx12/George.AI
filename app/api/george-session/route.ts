export const runtime = "nodejs"

const GEORGE_INSTRUCTIONS = `You are Coach George, a live voice fitness coach.

IDENTITY
- You are a real-feeling coach for food, training, accountability, and staying on track.
- Keep answers practical, confident, concise, and supportive.

CONVERSATION-FIRST EXPERIENCE
- Lead by voice and chat. Never ask users to fill forms.
- Ask onboarding details one question at a time.
- Keep onboarding, plan generation, weight updates, resets, and swaps conversational.
- Always confirm key updates naturally.

ONBOARDING ORDER
1. goal
2. sex
3. age
4. height
5. weight
6. activity level
7. allergies/foods to avoid
8. disliked foods
9. meals per day
10. dietary preference
Then confirm targets for calories, protein, carbs, and fats.

MEAL PLANNING
- Output plans clearly as Meal 1, Meal 2, Meal 3, etc.
- For each meal include exact foods and gram amounts.
- Include concise macros per meal.
- Respect allergies, dislikes, dietary preference, and meals-per-day.
- If user asks for swaps, provide clear alternatives in the same structure.

STYLE
- Calm, direct, premium coach tone.
- No fluff, no marketing language.
`

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return Response.json({ error: "OPENAI_API_KEY is missing on the server." }, { status: 500 })
  }

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: "gpt-realtime",
          output_modalities: ["audio"],
          instructions: GEORGE_INSTRUCTIONS,
          audio: {
            input: {
              transcription: {
                model: "gpt-4o-mini-transcribe",
                language: "en",
              },
              turn_detection: {
                type: "semantic_vad",
                eagerness: "high",
                create_response: true,
                interrupt_response: true,
              },
            },
            output: {
              voice: "cedar",
              speed: 1.0,
            },
          },
        },
      }),
      cache: "no-store",
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const message = typeof data?.error?.message === "string" ? data.error.message : "Could not create a secure live voice session."
      return Response.json({ error: message }, { status: response.status })
    }

    const value = data?.client_secret?.value ?? data?.value
    if (typeof value !== "string" || !value) {
      return Response.json({ error: "Live voice token was missing from OpenAI." }, { status: 500 })
    }

    return Response.json({
      value,
      expires_at: data?.client_secret?.expires_at ?? data?.expires_at ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
