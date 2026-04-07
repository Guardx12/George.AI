export const runtime = "nodejs"

function buildZapierUrl(baseUrl: string, business: string, minutes: number, timestamp: number) {
  const url = new URL(baseUrl)
  url.searchParams.set("business", business)
  url.searchParams.set("minutes", String(minutes))
  url.searchParams.set("t", String(timestamp))
  return url.toString()
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { business?: string; minutes?: number | string; timestamp?: number | string }
      | null

    const business = typeof body?.business === "string" && body.business.trim() ? body.business.trim() : "alderwood-ponds"
    const minutesNumber = Number(body?.minutes)
    const timestampNumber = Number(body?.timestamp || Date.now())

    if (!Number.isFinite(minutesNumber) || minutesNumber <= 0) {
      return Response.json({ error: "Minutes must be a positive number." }, { status: 400 })
    }

    const webhookUrl = process.env.ALDERWOOD_USAGE_WEBHOOK_URL || process.env.GEORGE_USAGE_WEBHOOK_URL

    if (!webhookUrl) {
      return Response.json(
        { ok: true, skipped: true, reason: "Usage webhook URL is not configured yet." },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      )
    }

    const response = await fetch(buildZapierUrl(webhookUrl, business, minutesNumber, timestampNumber), {
      method: "GET",
      cache: "no-store",
    })

    if (!response.ok) {
      const details = await response.text().catch(() => "")
      return Response.json({ error: details || "Could not report Alderwood usage." }, { status: response.status })
    }

    return Response.json({ ok: true }, { status: 200, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Alderwood usage route error", error)
    return Response.json({ error: "Could not report Alderwood usage." }, { status: 500 })
  }
}
