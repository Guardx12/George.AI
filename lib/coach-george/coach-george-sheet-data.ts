import localFoodsData from "./data/foods.json"
import localRecipesData from "./data/recipes.json"
import type { DietaryPreference, Food, Nutrition, Profile, Recipe } from "./coach-george-nutrition"

const FOOD_SHEET_ID = "1-ntS3chNb93e6t-cu3A9vmL3WvNsLfzxtKYbedhsjJg"
const RECIPE_SHEET_ID = "1oVN4XUX3mqnTzvncww1z_mWxwPA8vzKrU05Hh9gXCGo"

export type CoachGeorgeData = {
  foods: Food[]
  recipes: Recipe[]
  source: "google-sheets" | "local-fallback"
}

const LOCAL_FOODS = localFoodsData as Food[]
const LOCAL_RECIPES = localRecipesData as Recipe[]

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === ',') {
      row.push(cell.trim())
      cell = ""
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i++
      row.push(cell.trim())
      if (row.some((item) => item.length > 0)) rows.push(row)
      row = []
      cell = ""
      continue
    }

    cell += char
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim())
    if (row.some((item) => item.length > 0)) rows.push(row)
  }

  return rows
}

function normalizeFoodName(name: string) {
  return name.trim().toLowerCase()
}

function inferAllergens(name: string) {
  const value = name.toLowerCase()
  const allergens = new Set<string>()
  if (/salmon|tuna|cod|prawn|mackerel|sardine|smoked salmon/.test(value)) allergens.add("fish")
  if (/prawn/.test(value)) allergens.add("shellfish")
  if (/yogurt|cheese|milk|butter|ricotta|feta|halloumi|mozzarella|whey|cottage/.test(value)) allergens.add("milk")
  if (/egg/.test(value)) allergens.add("egg")
  if (/tofu|soy/.test(value)) allergens.add("soy")
  if (/bread|pasta|wrap|naan|bagel|pitta|couscous|bulgur|freekeh|weetabix|croissant|crackers|flatbread|bun|sourdough|rye/.test(value)) allergens.add("gluten")
  if (/almond|walnut|mixed nuts|peanut butter/.test(value)) allergens.add("nuts")
  if (/seeds/.test(value)) allergens.add("seeds")
  return [...allergens]
}

function inferDietaryTags(name: string, category: string) {
  const value = name.toLowerCase()
  const tags = new Set<string>()
  if (category) tags.add(category.toLowerCase())
  if (/chicken|turkey|beef|steak|pork|bacon|ham|duck|lamb|venison|pepperoni|sausage|liver/.test(value)) tags.add("meat")
  if (/salmon|tuna|cod|prawn|mackerel|sardine/.test(value)) tags.add("fish")
  if (/tofu|lentils|beans|chickpeas|falafel|tempeh/.test(value)) tags.add("plant-based")
  if (/whey|yogurt|cheese|milk|egg/.test(value)) tags.add("vegetarian")
  if (/(rice|oats|pasta|bread|potato|noodles|wrap|bagel|pitta|quinoa|couscous|weetabix)/.test(value)) tags.add("carb")
  return [...tags]
}

function inferDietaryFromRecipe(recipeName: string, ingredientNames: string[]): DietaryPreference[] {
  const text = `${recipeName} ${ingredientNames.join(" ")}`.toLowerCase()
  const hasMeat = /(chicken|turkey|beef|steak|pork|bacon|ham|duck|lamb|venison|pepperoni|sausage|liver)/.test(text)
  const hasFish = /(salmon|tuna|cod|prawn|mackerel|sardine)/.test(text)
  const hasAnimal = hasMeat || hasFish || /(egg|milk|cheese|yogurt|whey|butter|mayonnaise)/.test(text)

  if (hasMeat) return ["omnivore"]
  if (hasFish) return ["omnivore", "pescatarian"]
  if (hasAnimal) return ["omnivore", "vegetarian"]
  return ["omnivore", "vegetarian", "pescatarian", "vegan"]
}

function inferMealType(recipeName: string): Recipe["mealType"] {
  const value = recipeName.toLowerCase()
  if (/(omelette|weetabix|breakfast|oats|pancake|waffle)/.test(value)) return "breakfast"
  if (/(snack|shake|yogurt|fruit bowl|protein bowl)/.test(value)) return "snack"
  if (/(sandwich|wrap|toastie|salad|soup)/.test(value)) return "lunch"
  return "dinner"
}

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildFoods(rows: string[][]): Food[] {
  const dataRows = rows.slice(1).filter((row) => row[0])
  return dataRows.map((row) => {
    const [name, category, calories, protein, carbs, fat] = row
    return {
      id: slugify(name),
      name: name.trim(),
      allergens: inferAllergens(name),
      dietaryTags: inferDietaryTags(name, category || ""),
      nutritionPer100g: {
        calories: toNumber(calories),
        protein: toNumber(protein),
        carbs: toNumber(carbs),
        fat: toNumber(fat),
      },
    }
  })
}

function buildRecipes(rows: string[][], foods: Food[]): Recipe[] {
  const dataRows = rows.slice(1).filter((row) => row[0] && row[1])
  const foodByName = new Map(foods.map((food) => [normalizeFoodName(food.name), food]))
  const grouped = new Map<string, Array<{ ingredient: string; grams: number }>>()

  for (const row of dataRows) {
    const [recipeName, ingredientName, grams] = row
    const list = grouped.get(recipeName) || []
    list.push({ ingredient: ingredientName.trim(), grams: toNumber(grams) })
    grouped.set(recipeName, list)
  }

  return [...grouped.entries()].map(([recipeName, ingredients]) => {
    const ingredientNames = ingredients.map((item) => item.ingredient)
    return {
      id: slugify(recipeName),
      name: recipeName.trim(),
      mealType: inferMealType(recipeName),
      dietary: inferDietaryFromRecipe(recipeName, ingredientNames),
      ingredients: ingredients.map((item) => ({
        foodId: foodByName.get(normalizeFoodName(item.ingredient))?.id || slugify(item.ingredient),
        grams: item.grams,
      })),
    }
  })
}

async function fetchSheetCsv(sheetId: string) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error(`Google Sheet fetch failed (${response.status})`)
  return response.text()
}

export async function getCoachGeorgeData(): Promise<CoachGeorgeData> {
  try {
    const [foodsCsv, recipesCsv] = await Promise.all([fetchSheetCsv(FOOD_SHEET_ID), fetchSheetCsv(RECIPE_SHEET_ID)])
    const foods = buildFoods(parseCsv(foodsCsv))
    const recipes = buildRecipes(parseCsv(recipesCsv), foods)

    if (!foods.length || !recipes.length) throw new Error("Parsed sheets were empty")

    return {
      foods,
      recipes,
      source: "google-sheets",
    }
  } catch {
    return {
      foods: LOCAL_FOODS,
      recipes: LOCAL_RECIPES,
      source: "local-fallback",
    }
  }
}
