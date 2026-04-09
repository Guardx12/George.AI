export const runtime = 'nodejs'

const ZAP_WEBHOOK_URL =
  process.env.PLACESFORPEOPLE_USAGE_WEBHOOK_URL ||
  process.env.ALDERWOOD_USAGE_WEBHOOK_URL ||
  'https://hooks.zapier.com/hooks/catch/24591341/u7taw5v/'

const BUSINESS_SLUG = process.env.PLACESFORPEOPLE_USAGE_BUSINESS || 'placesforpeople'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const minutes = Math.max(0.1, Math.round(Number(body?.minutes || 0) * 10) / 10)
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return Response.json({ error: 'Minutes must be a positive number.' }, { status: 400 })
    }
    const url = new URL(ZAP_WEBHOOK_URL)
    url.searchParams.set('business', BUSINESS_SLUG)
    url.searchParams.set('minutes', String(minutes))
    url.searchParams.set('t', String(Date.now()))
    const response = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
    })
    if (!response.ok) {
      const details = await response.text().catch(() => '')
      return Response.json({ error: details || 'Could not forward Places for People usage to Zapier.' }, { status: response.status || 500 })
    }
    return Response.json({ ok: true, business: BUSINESS_SLUG, minutes }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Places for People usage route error', error)
    return Response.json({ error: 'Could not log usage right now.' }, { status: 500 })
  }
}
