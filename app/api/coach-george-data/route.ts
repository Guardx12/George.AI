import { getCoachGeorgeData } from "@/lib/coach-george/coach-george-sheet-data"

export const runtime = "nodejs"

export async function GET() {
  try {
    const data = await getCoachGeorgeData()
    return Response.json(data, {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
