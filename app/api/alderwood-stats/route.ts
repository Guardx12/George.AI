export const runtime = 'nodejs'

// Paste your published Alderwood row source here if you want to hardwire it in code.
// Example CSV export URL:
// https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv&gid=0
const HARDCODED_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1OGdvSXrnrFeN9TPiMQKAOsmZh06DYK8yudCmG_-AfGY/edit?usp=sharing'
const HARDCODED_CSV_URL = ''
const HARDCODED_JSON_URL = ''

const JSON_URL =
  process.env.ALDERWOOD_STATS_JSON_URL ||
  process.env.ALDERWOOD_STATS_URL ||
  process.env.NEXT_PUBLIC_ALDERWOOD_STATS_JSON_URL ||
  HARDCODED_JSON_URL ||
  ''

function googleSheetToCsvUrl(value: string) {
  if (!value) return ''
  if (value.includes('/export?format=csv')) return value

  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) return value

  const gidMatch = value.match(/[?&#]gid=(\d+)/)
  const gid = gidMatch?.[1] || '0'
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`
}

const CSV_URL =
  process.env.ALDERWOOD_STATS_CSV_URL ||
  process.env.NEXT_PUBLIC_ALDERWOOD_STATS_CSV_URL ||
  HARDCODED_CSV_URL ||
  googleSheetToCsvUrl(HARDCODED_SHEET_URL) ||
  ''

const BUSINESS_SLUG = process.env.ALDERWOOD_USAGE_BUSINESS || 'Alderwood-Ponds'

type AlderwoodStats = {
  total: number
  minutes: number
}

function toNumber(value: unknown) {
  const parsed = Number(String(value ?? '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function parseCsvLine(line: string) {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result.map((item) => item.trim())
}

function normaliseBusiness(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/'s\b/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
}

function rowBusiness(row: Record<string, string>) {
  return normaliseBusiness(row.business ?? row.Business ?? row.page ?? row.Page ?? row.name ?? row.Name)
}

function findSlugMatch(rows: Record<string, string>[]) {
  const target = normaliseBusiness(BUSINESS_SLUG)
  const aliases = new Set([target, 'alderwoodponds', 'alderdaleponds'])

  const exact = rows.find((row) => aliases.has(rowBusiness(row)))
  if (exact) return exact

  if (rows.length === 1) return rows[0]

  return rows.find((row) => {
    const business = rowBusiness(row)
    return business.includes('alderwood') || business.includes('alderdale')
  })
}

async function getStatsFromJson(): Promise<AlderwoodStats | null> {
  if (!JSON_URL) return null
  const response = await fetch(JSON_URL, { cache: 'no-store', headers: { 'Cache-Control': 'no-store' } })
  if (!response.ok) throw new Error('Could not fetch Alderwood stats JSON.')
  const data = await response.json().catch(() => null)

  const row = Array.isArray(data)
    ? data.find((item) => normaliseBusiness(item?.business ?? item?.page ?? item?.name) === BUSINESS_SLUG.toLowerCase())
    : data && typeof data === 'object' && 'business' in data
      ? data
      : data?.[BUSINESS_SLUG] ?? null

  if (!row) return null

  return {
    total: toNumber((row as any).total ?? (row as any).Total),
    minutes: toNumber((row as any).minutes ?? (row as any).Minutes),
  }
}

async function getStatsFromCsv(): Promise<AlderwoodStats | null> {
  if (!CSV_URL) return null
  const response = await fetch(CSV_URL, { cache: 'no-store', headers: { 'Cache-Control': 'no-store' } })
  if (!response.ok) throw new Error('Could not fetch Alderwood stats CSV.')
  const csv = await response.text()
  const lines = csv.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return null

  const headers = parseCsvLine(lines[0])
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = cells[index] ?? ''
      return acc
    }, {})
  })

  const row = findSlugMatch(rows)
  if (!row) return null

  return {
    total: toNumber(row.total ?? row.Total),
    minutes: toNumber(row.minutes ?? row.Minutes),
  }
}

export async function GET() {
  try {
    let stats: AlderwoodStats | null = null

    if (JSON_URL) stats = await getStatsFromJson()
    if (!stats && CSV_URL) stats = await getStatsFromCsv()

    return Response.json(
      stats ?? { total: 0, minutes: 0 },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  } catch (error) {
    console.error('Alderwood stats route error', error)
    return Response.json({ total: 0, minutes: 0 }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  }
}
