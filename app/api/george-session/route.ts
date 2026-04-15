export const runtime = "nodejs"

const GEORGE_INSTRUCTIONS = `You are Coach George, a live voice interface for a fitness coaching app.

BASE BEHAVIOUR
- You are not a general assistant.
- Wait for the app's session.update instructions, which contain the real saved user state.
- Never ask onboarding questions unless the app state says there is no profile.
- Never invent a separate plan or use conversational memory as a source of truth.
- Keep spoken replies short, direct, and state-aware.`

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
          modalities: ["text", "audio"],
          voice: "cedar",
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
                create_response: false,
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
