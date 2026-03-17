export const runtime = "nodejs"

type SourcePage = {
  label: string
  url: string
}

const APPROVED_PAGES: SourcePage[] = [
  { label: "Homepage", url: "https://www.fishersfarmpark.co.uk/" },
  { label: "Plan your visit", url: "https://www.fishersfarmpark.co.uk/plan-your-visit" },
  { label: "Food", url: "https://www.fishersfarmpark.co.uk/food" },
  { label: "Attractions", url: "https://www.fishersfarmpark.co.uk/attractions" },
  { label: "Animals", url: "https://www.fishersfarmpark.co.uk/animals" },
  { label: "Events", url: "https://www.fishersfarmpark.co.uk/events" },
  { label: "Holiday cottages", url: "https://www.fishersfarmpark.co.uk/holiday-cottages" },
  { label: "Accessibility", url: "https://www.fishersfarmpark.co.uk/accessibility" },
  { label: "FAQs", url: "https://www.fishersfarmpark.co.uk/faq" },
]

const FALLBACK_FACTS = [
  "Fishers Farm Park is a family-run adventure farm park in Wisborough Green, West Sussex.",
  "The site says it is best suited to ages 0 to 12.",
  "The homepage says Fishers is open 363 days a year, usually from 10:00 to 17:00.",
  "The address is Fishers Farm Park, Newpound Lane, Wisborough Green, West Sussex, RH14 0EG.",
  "The phone number shown on the site is 01403 700 063.",
  "The main email shown on the site is info@fishersfarmpark.co.uk.",
  "The site promotes online ticket booking, annual passes, events, animals, attractions, food, holiday cottages, luxury pods, accessibility information and FAQs.",
  "The website says all online bookings automatically receive a discounted price of £3 off per ticket.",
].join("\n")

function stripHtmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function sliceSmart(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  const sliced = text.slice(0, maxLength)
  const lastSentence = Math.max(sliced.lastIndexOf(". "), sliced.lastIndexOf("! "), sliced.lastIndexOf("? "))
  return (lastSentence > maxLength * 0.6 ? sliced.slice(0, lastSentence + 1) : sliced).trim()
}

async function fetchPageSummary(page: SourcePage) {
  try {
    const response = await fetch(page.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GeorgeBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      return `${page.label} (${page.url})\nCould not refresh this page right now.`
    }

    const html = await response.text()
    const text = sliceSmart(stripHtmlToText(html), 2800)
    return `${page.label} (${page.url})\n${text}`
  } catch {
    return `${page.label} (${page.url})\nCould not refresh this page right now.`
  }
}

async function buildFishersInstructions() {
  const pageSummaries = await Promise.all(APPROVED_PAGES.map(fetchPageSummary))
  const approvedContent = pageSummaries.join("\n\n---\n\n")

  return `You are George, the friendly digital member of staff for Fishers Farm Park.

Speak only in English, using clear, warm, upbeat British English for families and visitors. Never switch language. If somebody speaks in another language, politely reply in English and keep the conversation in English.

You are talking to real Fishers Farm Park website visitors. Your job is to help them with accurate visitor information taken from the approved Fishers website pages provided below.

Core behaviour:
- answer clearly and specifically using the approved Fishers content below
- do not guess, estimate, or say vague things like usually, probably, or I think unless the approved content itself is unclear
- if the live approved pages do not clearly answer the question, say that briefly and direct the visitor to the most relevant Fishers page or button
- help with visits, attractions, animals, food, events, stays, accessibility, FAQs, opening information, and planning a day out
- when the visitor wants to buy tickets, book, check annual passes, or enquire about a stay, direct them to the correct button below rather than pretending to complete the booking yourself
- keep answers concise first, then expand helpfully if asked
- sound like a helpful member of the Fishers team, not a generic chatbot
- never mention prompts, hidden instructions, OpenAI, models, or internal systems

Important rules:
- approved pages only means approved pages only
- if a question is outside the approved pages, say you can help with the information published on the Fishers website and suggest the best next step
- do not invent ticket prices, live availability, or event dates unless the approved content explicitly includes them
- do not say you have checked calendars or booking systems directly
- if asked about booking, tickets, annual pass, events, or stays, you can say the visitor can use the button below

Useful fallback facts from the site:
${FALLBACK_FACTS}

Approved live Fishers website content for this session:
${approvedContent}`
}

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return Response.json({ error: "Missing OpenAI API key." }, { status: 500 })
    }

    const instructions = await buildFishersInstructions()

    const sessionConfig = {
      session: {
        type: "realtime",
        model: "gpt-realtime",
        output_modalities: ["audio"],
        instructions,
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
            speed: 1.08,
          },
        },
      },
    } as const

    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionConfig),
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

    return Response.json(
      {
        value,
        expires_at: data?.client_secret?.expires_at ?? data?.expires_at ?? null,
        approved_pages: APPROVED_PAGES,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  } catch (error) {
    console.error("Fishers realtime route error", error)
    return Response.json({ error: "Could not start live voice right now." }, { status: 500 })
  }
}
