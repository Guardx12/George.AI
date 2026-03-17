const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; AskGeorgeBot/1.0; +https://askgeorge.app)",
  Accept: "text/html,application/xhtml+xml",
}

type SitePage = {
  slug: string
  title: string
  url: string
  ctaLabel?: string
}

export const FISHERS_PAGES: SitePage[] = [
  { slug: "home", title: "Home", url: "https://www.fishersfarmpark.co.uk/" },
  { slug: "plan", title: "Plan your visit", url: "https://www.fishersfarmpark.co.uk/plan-your-visit", ctaLabel: "Plan your visit" },
  { slug: "food", title: "Food", url: "https://www.fishersfarmpark.co.uk/food", ctaLabel: "Food options" },
  { slug: "attractions", title: "Attractions", url: "https://www.fishersfarmpark.co.uk/attractions", ctaLabel: "What's here" },
  { slug: "animals", title: "Animals", url: "https://www.fishersfarmpark.co.uk/animals", ctaLabel: "Animals" },
  { slug: "events", title: "Events", url: "https://www.fishersfarmpark.co.uk/events", ctaLabel: "What's on" },
  { slug: "stays", title: "Holiday cottages", url: "https://www.fishersfarmpark.co.uk/holiday-cottages", ctaLabel: "Short breaks" },
  { slug: "pods", title: "Luxury pods", url: "https://www.fishersfarmpark.co.uk/posh-pods", ctaLabel: "Luxury pods" },
  { slug: "accessibility", title: "Accessibility", url: "https://www.fishersfarmpark.co.uk/accessibility", ctaLabel: "Accessibility" },
  { slug: "faq", title: "FAQs", url: "https://www.fishersfarmpark.co.uk/faq", ctaLabel: "FAQs" },
  { slug: "contact", title: "Get in touch", url: "https://www.fishersfarmpark.co.uk/get-in-touch", ctaLabel: "Contact" },
]

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2019;|&#8217;/g, "’")
    .replace(/&#x2013;|&#8211;/g, "–")
    .replace(/&#x2014;|&#8212;/g, "—")
    .replace(/&#xA3;|&#163;/g, "£")
    .replace(/&#(\d+);/g, (_, code) => {
      const parsed = Number.parseInt(code, 10)
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : _
    })
}

function normaliseText(html: string) {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/h\d)>/gi, "$1\n")
    .replace(/<[^>]+>/g, " ")

  return decodeHtmlEntities(withoutNoise)
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .trim()
}

function extractTitle(html: string, fallback: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  return decodeHtmlEntities((titleMatch?.[1] || ogTitleMatch?.[1] || fallback).trim())
}

function extractDescription(html: string) {
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
  return descMatch?.[1] ? decodeHtmlEntities(descMatch[1].trim()) : ""
}

async function fetchPage(page: SitePage) {
  try {
    const response = await fetch(page.url, {
      headers: DEFAULT_HEADERS,
      cache: "no-store",
      next: { revalidate: 0 },
    })

    if (!response.ok) {
      return {
        ...page,
        ok: false,
        title: page.title,
        description: "",
        text: "",
        excerpt: "",
        error: `HTTP ${response.status}`,
      }
    }

    const html = await response.text()
    const text = normaliseText(html)
    const description = extractDescription(html)
    const title = extractTitle(html, page.title)
    const excerpt = text.slice(0, 1800)

    return {
      ...page,
      ok: true,
      title,
      description,
      text,
      excerpt,
      error: "",
    }
  } catch (error) {
    return {
      ...page,
      ok: false,
      title: page.title,
      description: "",
      text: "",
      excerpt: "",
      error: error instanceof Error ? error.message : "Unknown fetch error",
    }
  }
}

function compressForInstructions(text: string, maxLength = 1400) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

export async function buildFishersLiveKnowledge() {
  const pages = await Promise.all(FISHERS_PAGES.map(fetchPage))
  const available = pages.filter((page) => page.ok)

  const pageSummaries = available
    .map((page) => {
      const lead = [page.title, page.description].filter(Boolean).join(" — ")
      const body = compressForInstructions(page.excerpt)
      return `PAGE: ${lead}\nURL: ${page.url}\nCONTENT:\n${body}`
    })
    .join("\n\n")

  return {
    fetchedAt: new Date().toISOString(),
    pages,
    pageSummaries,
    approvedPageList: FISHERS_PAGES.map((page) => `- ${page.title}: ${page.url}`).join("\n"),
  }
}
