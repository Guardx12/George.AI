export const runtime = 'nodejs'

const HARDCODED_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1OGdvSXrnrFeN9TPiMQKAOsmZh06DYK8yudCmG_-AfGY/edit?usp=sharing'

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
  process.env.PLACESFORPEOPLE_STATS_CSV_URL ||
  process.env.NEXT_PUBLIC_PLACESFORPEOPLE_STATS_CSV_URL ||
  googleSheetToCsvUrl(HARDCODED_SHEET_URL)

const BUSINESS_ALIASES = (
  process.env.PLACESFORPEOPLE_USAGE_ALIASES ||
  'placesforpeople,PlacesForPeople,Places For People,Places-For-People,Steyning Leisure Centre,Places Leisure Steyning'
)
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

type Stats = {
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

function normalise(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/'s\b/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
}

function rowKey(row: Record<string, string>) {
  return [
    row.business,
    row.Business,
    row.page,
    row.Page,
    row.name,
    row.Name,
  ]
    .map((value) => normalise(value))
    .find(Boolean) || ''
}

async function fetchCsv(url: string) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'text/csv,text/plain,*/*' },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Request failed with status ${response.status}`)
  }

  return response.text()
}

function parseRows(csv: string) {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) return []

  const headers = parseCsvLine(lines[0])

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}

export async function GET() {
  try {
    const csv = await fetchCsv(CSV_URL)
    const rows = parseRows(csv)
    const aliases = new Set(BUSINESS_ALIASES.map((item) => normalise(item)))

    const matchingRows = rows.filter((row) => aliases.has(rowKey(row)))

    const totals = matchingRows.reduce<Stats>(
      (acc, row) => ({
        total: acc.total + toNumber(row.total ?? row.Total ?? row.visitors ?? row.Visitors ?? row.count ?? row.Count),
        minutes: acc.minutes + toNumber(row.minutes ?? row.Minutes),
      }),
      { total: 0, minutes: 0 },
    )

    return Response.json(totals, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Places for People stats route error', error)
    return Response.json({ total: 0, minutes: 0 }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
