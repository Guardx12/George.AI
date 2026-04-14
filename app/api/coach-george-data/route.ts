import { NextResponse } from "next/server"
import { loadCoachGeorgePlannerData } from "@/lib/coach-george/coach-george-sheet-data"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const data = await loadCoachGeorgePlannerData()
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  })
}
