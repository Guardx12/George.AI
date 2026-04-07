export const runtime = "nodejs"

const BUSINESS_CANDIDATES = ["alderwood-ponds", "alderwood ponds", "alderwood"]

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[_\s]+/g, "-")
}

function parseNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function extractStatsFromObject(row: Record<string, unknown>) {
  const visitors = parseNumber(row.total ?? row.visitors ?? row.conversations)
  const minutes = parseNumber(row.minutes ?? row.total_minutes ?? row.totalMinutes)
  return { visitors, minutes }
}

function findMatchingRow(rows: Array<Record<string, unknown>>) {
  return rows.find((row) => {
    const rawBusiness = String(row.business ?? row.page ?? row.name ?? "")
    const normalized = normalize(rawBusiness)
    return BUSINESS_CANDIDATES.some((candidate) => normalized === normalize(candidate))
  })
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ""
  let insideQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        insideQuotes = !insideQuotes
      }
      continue
    }

    if (char === "," && !insideQuotes) {
      cells.push(current)
      current = ""
      continue
    }

    current += char
  }

  cells.push(current)
  return cells.map((cell) => cell.trim())
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0])

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return headers.reduce<Record<string, string>>((accumulator, header, index) => {
      accumulator[header] = values[index] ?? ""
      return accumulator
    }, {})
  })
}

export async function GET() {
  try {
    const jsonUrl = process.env.ALDERWOOD_STATS_JSON_URL || process.env.GEORGE_STATS_JSON_URL
    const csvUrl = process.env.ALDERWOOD_STATS_CSV_URL || process.env.GEORGE_STATS_CSV_URL

    if (jsonUrl) {
      const response = await fetch(jsonUrl, { cache: "no-store" })
      const data = (await response.json().catch(() => null)) as unknown

      if (response.ok) {
        const rows = Array.isArray(data)
          ? (data as Array<Record<string, unknown>>)
          : Array.isArray((data as { rows?: unknown[] } | null)?.rows)
            ? (((data as { rows?: unknown[] }).rows ?? []) as Array<Record<string, unknown>>)
            : []

        const row = findMatchingRow(rows)
        if (row) {
          return Response.json(extractStatsFromObject(row), {
            status: 200,
            headers: { "Cache-Control": "no-store" },
          })
        }
      }
    }

    if (csvUrl) {
      const response = await fetch(csvUrl, { cache: "no-store" })
      const text = await response.text().catch(() => "")
      if (response.ok && text) {
        const rows = parseCsv(text)
        const row = findMatchingRow(rows)
        if (row) {
          return Response.json(extractStatsFromObject(row), {
            status: 200,
            headers: { "Cache-Control": "no-store" },
          })
        }
      }
    }

    return Response.json({ visitors: 0, minutes: 0, source: "fallback" }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("Alderwood stats route error", error)
    return Response.json({ visitors: 0, minutes: 0, source: "fallback" }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    })
  }
}
