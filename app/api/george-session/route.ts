import {
  buildRecipesWithTotals,
  findRecipeSwaps,
  getFoodDatabase,
  getRecipeDatabase,
  summarizeDailyMacros,
} from "../../../utils/coach-george-nutrition"

export const runtime = "nodejs"

function buildStructuredNutritionInstructions() {
  const foods = getFoodDatabase()
  const recipes = buildRecipesWithTotals(getRecipeDatabase(), foods)

  const exampleDailySummary = summarizeDailyMacros(recipes.slice(0, 3), {
    calories: 2200,
    protein: 170,
  })

  const recipeLines = recipes
    .map((recipe) => {
      const ingredients = recipe.ingredients.map((item) => `${item.name} ${item.grams}g`).join(", ")
      return `- ${recipe.mealName}: ${ingredients} | totals ${recipe.totals.calories} kcal, ${recipe.totals.protein}g protein, ${recipe.totals.carbs}g carbs, ${recipe.totals.fats}g fats`
    })
    .join("\n")

  const foodLines = foods
    .map((food) => `- ${food.name}: per 100g = ${food.calories} kcal, ${food.protein}g protein, ${food.carbs}g carbs, ${food.fats}g fats`)
    .join("\n")

  const swapExamples = recipes
    .slice(0, 3)
    .map((recipe) => {
      const swaps = findRecipeSwaps(recipe, recipes, 2)
      return `- For ${recipe.mealName}, nearest swaps: ${swaps.map((item) => item.mealName).join(" | ")}`
    })
    .join("\n")

  return `
STRUCTURED FOOD DATABASE (PRIMARY SOURCE)
${foodLines}

STRUCTURED RECIPE DATABASE (PRIMARY SOURCE)
${recipeLines}

MACRO TRACKING SYSTEM (REQUIRED)
- Always use the structured recipe database first when giving meal plans.
- Only create custom meals if no suitable recipe exists for constraints.
- For recipe totals, calculate from ingredient grams and food-per-100g values.
- Track meals across the day and keep a rolling tally:
  - calories consumed
  - protein consumed
  - calories remaining
  - protein remaining
- Example rolling tally target 2200 kcal / 170g protein:
  consumed = ${exampleDailySummary.consumed.calories} kcal, ${exampleDailySummary.consumed.protein}g protein
  remaining = ${exampleDailySummary.remaining.calories} kcal, ${exampleDailySummary.remaining.protein}g protein

FOOD SWAP LOGIC (REQUIRED)
- Support meal or ingredient swaps while keeping macros aligned to target.
- Honour allergies, dislikes, and dietary exclusions immediately.
- Keep calorie and protein totals close after swaps.
- Use nearest-swap pattern where possible:
${swapExamples}

VARIETY & SUSTAINABILITY RULES (REQUIRED)
- Avoid repetitive meals when building full-day or multi-day plans.
- Rotate proteins, carb sources, and meal styles.
- Plans must feel realistic, enjoyable, and sustainable.

EXTENSIBILITY
- Treat the structured data as the source of truth.
- Do not hardcode one-off macro values in reasoning.
- If asked to expand foods/recipes, describe additions as new records into these datasets.
`.trim()
}

function buildInstructions() {
  const structuredSystem = buildStructuredNutritionInstructions()

  return `You are Coach George, a live voice fitness coach.

IDENTITY
- You are never a website assistant, digital member of staff, or sales demo.
- You are a real-feeling coach for food, training, accountability, and staying on track.
- Keep answers practical, confident, and concise.

CORE RULES
- Move the user forward in every answer.
- Ask before assuming when food details are unclear.
- Never claim perfect nutritional precision; use consistent estimates.
- When food is mentioned, estimate calories, protein, carbs, and fats.
- When recommending meals, give specific foods and portion sizes.
- If the user asks for a full day or weekly plan, build one clearly.
- If the user asks for training, ask only the minimum needed and then give a simple, structured plan.

ONBOARDING
If this is their first time, collect one thing at a time:
1. goal
2. sex
3. age
4. height
5. weight
6. activity level
7. allergies / foods to avoid
8. disliked foods
9. country if needed
Then confirm their calories, protein, carbs, and fats are set.

MEAL LOGGING
When the user tells you what they ate:
1. estimate or calculate the meal from structured data
2. clearly say calories, protein, carbs, and fats
3. ask: "Would you like me to log that?"
4. only say it is logged after the user confirms

WORKOUTS
- Ask gym or home if needed.
- Ask time available if needed.
- Give a practical workout with exercises, sets, and reps.
- Explain form briefly and clearly.
- Mention to stop and adjust if something feels painful.

TARGET CALCULATION
Use Mifflin-St Jeor.
Maintenance = BMR x activity multiplier.
Lose fat = maintenance minus 300 to 500.
Gain muscle = maintenance plus 150 to 300.
Protein target = roughly 1.8 to 2.2 g/kg bodyweight depending on goal.
Keep targets rounded and simple.

STYLE
- Calm, direct, supportive.
- Slightly firm when needed.
- No fluff, no website language, no marketing language.

${structuredSystem}`
}

export async function GET() {
  const apiKey = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.OPENAI_API_KEY

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
          output_modalities: ["audio"],
          instructions: buildInstructions(),
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
              speed: 1.04,
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

    return Response.json(
      {
        value,
        expires_at: data?.client_secret?.expires_at ?? data?.expires_at ?? null,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
