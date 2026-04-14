import foodsData from "./data/foods.json"
import recipesData from "./data/recipes.json"
import type { DietaryPreference, Food, Nutrition, Recipe, RecipeIngredient } from "./coach-george-nutrition"

const FOOD_SHEET_ID = "1-ntS3chNb93e6t-cu3A9vmL3WvNsLfzxtKYbedhsjJg"
const RECIPE_SHEET_ID = "1oVN4XUX3mqnTzvncww1z_mWxwPA8vzKrU05Hh9gXCGo"

export type PlannerDataSource = "google_sheets" | "local_fallback"
export type PlannerData = {
  foods: Food[]
  recipes: Recipe[]
  source: PlannerDataSource
}

type CsvRow = Record<string, string>

type RawRecipe = {
  id: string
  name: string
  mealType: Recipe["mealType"]
  dietary: DietaryPreference[]
  ingredients: RecipeIngredient[]
  nutrition?: Nutrition
}

const DEFAULT_FOODS: Food[] = foodsData as Food[]
const DEFAULT_RECIPES: Recipe[] = recipesData as Recipe[]

const DEFAULT_DATA: PlannerData = {
  foods: DEFAULT_FOODS,
  recipes: DEFAULT_RECIPES,
  source: "local_fallback",
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function normalizeHeader(input: string) {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_")
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = []
  let current = ""
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === "," && !inQuotes) {
      row.push(current)
      current = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1
      row.push(current)
      current = ""
      if (row.some((cell) => cell.trim() !== "")) rows.push(row)
      row = []
      continue
    }

    current += char
  }

  if (current.length || row.length) {
    row.push(current)
    if (row.some((cell) => cell.trim() !== "")) rows.push(row)
  }

  if (!rows.length) return []
  const header = rows[0].map((cell) => normalizeHeader(cell))

  return rows.slice(1).map((cells) => {
    const record: CsvRow = {}
    header.forEach((key, index) => {
      record[key] = (cells[index] || "").trim()
    })
    return record
  })
}

function toNumber(value: string | undefined) {
  if (!value) return null
  const cleaned = value.replace(/[^0-9.-]+/g, "")
  if (!cleaned) return null
  const numeric = Number(cleaned)
  return Number.isFinite(numeric) ? numeric : null
}

function splitList(value: string | undefined) {
  if (!value) return []
  return value
    .split(/[,|;/]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

function normalizeMealType(value: string | undefined): Recipe["mealType"] {
  const raw = (value || "").toLowerCase()
  if (raw.includes("break")) return "breakfast"
  if (raw.includes("snack")) return "snack"
  if (raw.includes("dinner") || raw.includes("evening") || raw.includes("supper")) return "dinner"
  return "lunch"
}

function normalizeDietary(raw: string | undefined): DietaryPreference[] {
  const text = (raw || "").toLowerCase()
  if (!text) return ["omnivore", "vegetarian", "pescatarian", "vegan"]
  const options: DietaryPreference[] = []
  if (text.includes("omn")) options.push("omnivore")
  if (text.includes("veg") && !text.includes("vegan")) options.push("vegetarian")
  if (text.includes("pesc")) options.push("pescatarian")
  if (text.includes("vegan")) options.push("vegan")
  if (!options.length) return ["omnivore", "vegetarian", "pescatarian", "vegan"]
  if (options.includes("vegan") && !options.includes("vegetarian")) options.push("vegetarian")
  if (options.includes("pescatarian") && !options.includes("omnivore")) options.push("omnivore")
  return Array.from(new Set(options))
}

function normalizeFoodRow(row: CsvRow): Food | null {
  const name = row.name || row.food || row.ingredient || row.item || row.product
  if (!name) return null

  const calories = toNumber(row.calories || row.kcal)
  const protein = toNumber(row.protein || row.protein_g)
  const carbs = toNumber(row.carbs || row.carbohydrates || row.carbs_g)
  const fat = toNumber(row.fat || row.fats || row.fat_g)

  if ([calories, protein, carbs, fat].some((entry) => entry === null)) return null

  return {
    id: slugify(row.id || name),
    name: name.trim(),
    allergens: splitList(row.allergens || row.allergy || row.contains),
    dietaryTags: splitList(row.dietary_tags || row.tags || row.category || row.tier),
    nutritionPer100g: {
      calories: calories || 0,
      protein: protein || 0,
      carbs: carbs || 0,
      fat: fat || 0,
    },
  }
}

function parseIngredientPairs(value: string, foods: Food[]) {
  const items: RecipeIngredient[] = []
  value
    .split(/\||\n|;/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const match = entry.match(/(.+?)(?:[:\-–]|\s)(\d+(?:\.\d+)?)\s*g?$/i)
      const name = (match?.[1] || entry).trim().toLowerCase()
      const grams = toNumber(match?.[2] || "")
      const food = foods.find((item) => item.name.toLowerCase() === name) || foods.find((item) => item.name.toLowerCase().includes(name))
      if (food && grams) items.push({ foodId: food.id, grams })
    })
  return items
}

function buildIngredientsFromColumns(row: CsvRow, foods: Food[]) {
  const ingredients: RecipeIngredient[] = []

  Object.entries(row).forEach(([key, value]) => {
    if (!value) return
    const ingredientMatch = key.match(/^ingredient_?(\d+)$/)
    if (ingredientMatch) {
      const index = ingredientMatch[1]
      const grams = toNumber(row[`grams_${index}`] || row[`gram_${index}`] || row[`amount_${index}`] || row[`qty_${index}`] || "")
      const target = value.trim().toLowerCase()
      const food = foods.find((item) => item.name.toLowerCase() === target) || foods.find((item) => item.name.toLowerCase().includes(target))
      if (food && grams) ingredients.push({ foodId: food.id, grams })
    }
  })

  return ingredients
}

function normalizeRecipeRow(row: CsvRow, foods: Food[]): RawRecipe | null {
  const name = row.name || row.recipe || row.recipe_name || row.title || row.meal
  if (!name) return null

  let ingredients = buildIngredientsFromColumns(row, foods)
  if (!ingredients.length) {
    const packed = row.ingredients || row.ingredient_list || row.items || row.components
    if (packed) ingredients = parseIngredientPairs(packed, foods)
  }

  const calories = toNumber(row.calories || row.kcal)
  const protein = toNumber(row.protein || row.protein_g)
  const carbs = toNumber(row.carbs || row.carbohydrates || row.carbs_g)
  const fat = toNumber(row.fat || row.fats || row.fat_g)

  const nutrition = [calories, protein, carbs, fat].every((value) => value !== null)
    ? { calories: calories || 0, protein: protein || 0, carbs: carbs || 0, fat: fat || 0 }
    : undefined

  return {
    id: slugify(row.id || name),
    name: name.trim(),
    mealType: normalizeMealType(row.meal_type || row.type || row.category),
    dietary: normalizeDietary(row.dietary || row.diet || row.tags),
    ingredients,
    nutrition,
  }
}

async function fetchSheetCsv(sheetId: string) {
  const urls = [
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`,
  ]

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" })
      if (!response.ok) continue
      const text = await response.text()
      if (text.trim()) return text
    } catch {
      // try next format
    }
  }

  throw new Error(`Could not fetch sheet ${sheetId}`)
}

function attachRecipeNutrition(recipes: RawRecipe[], foods: Food[]): Recipe[] {
  return recipes
    .map((recipe) => {
      const computed = recipe.ingredients.reduce(
        (acc, ingredient) => {
          const food = foods.find((item) => item.id === ingredient.foodId)
          if (!food) return acc
          const factor = ingredient.grams / 100
          return {
            calories: acc.calories + food.nutritionPer100g.calories * factor,
            protein: acc.protein + food.nutritionPer100g.protein * factor,
            carbs: acc.carbs + food.nutritionPer100g.carbs * factor,
            fat: acc.fat + food.nutritionPer100g.fat * factor,
          }
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      )

      return {
        ...recipe,
        nutrition: recipe.nutrition || computed,
      }
    })
    .filter((recipe) => recipe.name && (recipe.ingredients.length > 0 || recipe.nutrition))
}

export async function loadCoachGeorgePlannerData(): Promise<PlannerData> {
  try {
    const [foodCsv, recipeCsv] = await Promise.all([fetchSheetCsv(FOOD_SHEET_ID), fetchSheetCsv(RECIPE_SHEET_ID)])

    const foods = parseCsv(foodCsv)
      .map((row) => normalizeFoodRow(row))
      .filter((row): row is Food => Boolean(row))

    if (!foods.length) return DEFAULT_DATA

    const recipes = attachRecipeNutrition(
      parseCsv(recipeCsv)
        .map((row) => normalizeRecipeRow(row, foods))
        .filter((row): row is RawRecipe => Boolean(row)),
      foods,
    )

    if (!recipes.length) return DEFAULT_DATA

    return {
      foods,
      recipes,
      source: "google_sheets",
    }
  } catch {
    return DEFAULT_DATA
  }
}

export function getLocalCoachGeorgePlannerData(): PlannerData {
  return DEFAULT_DATA
}
