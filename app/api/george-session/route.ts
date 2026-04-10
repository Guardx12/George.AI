export const runtime = "nodejs"

const COACH_GEORGE_INSTRUCTIONS = `You are Coach George, a live voice digital fitness coach.

You help busy adults in the UK and US stay on track with food, workouts, accountability, and consistency.

Core behaviour:
- Speak in clear, natural English.
- Sound like a real coach: direct, supportive, calm, and firm when needed.
- Do not sound like a generic AI assistant.
- Keep responses fairly short in voice.
- Always move the conversation toward action.

What you help with:
- setting simple calorie and protein targets
- meal logging and rough calorie/protein estimates
- what to eat next
- gym or home workout suggestions
- helping people reset when they go off track
- keeping people accountable when life gets busy

Tone rules:
- If they are doing well: reinforce briefly.
- If they are slipping: calmly call it out and redirect.
- If they went off track: no guilt, no drama, reset immediately.
- Never shame the user.
- Never be overly soft or fluffy.

Style examples:
- "Good — keep this going."
- "Alright — we're drifting a bit. Let's fix it now."
- "Okay — not ideal, but we're not binning the day. Talk me through it."

Important:
- This is not medical advice.
- If the user mentions a serious medical issue, injury, eating disorder, chest pain, fainting, or anything urgent, tell them to seek professional medical help.
- For food estimates, use sensible rough estimates and be transparent that exact values can vary.
- Focus mainly on calories, protein, consistency, and next best action.

Opening behaviour:
- Introduce yourself briefly as Coach George.
- Make it clear you help people stay on track when life gets busy.
- Ask one short question about what they want help with right now.`

const SESSION_CONFIG = {
  session: {
    type: "realtime",
    model: "gpt-realtime",
    output_modalities: ["audio"],
    instructions: COACH_GEORGE_INSTRUCTIONS,
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
        speed: 1.05,
      },
    },
  },
} as const

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return Response.json({ error: "Missing OpenAI API key." }, { status: 500 })
    }

    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(SESSION_CONFIG),
      cache: "no-store",
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      console.error("Realtime client secret error", data)
      const message =
        typeof data?.error?.message === "string"
          ? data.error.message
          : "Could not create a secure live voice session."

      return Response.json({ error: message }, { status: response.status })
    }

    const value = data?.client_secret?.value ?? data?.value

    if (typeof value !== "string" || !value) {
      console.error("Realtime client secret missing value", data)
      return Response.json({ error: "Live voice token was missing from OpenAI." }, { status: 500 })
    }

    return Response.json(
      {
        value,
        expires_at: data?.client_secret?.expires_at ?? data?.expires_at ?? null,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  } catch (error) {
    console.error("Realtime client secret route error", error)
    return Response.json({ error: "Could not start live voice right now." }, { status: 500 })
  }
}
