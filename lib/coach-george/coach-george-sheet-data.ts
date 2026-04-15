import foodsData from "./data/foods.json"
import recipesData from "./data/recipes.json"
import type { DietaryPreference, Food, Nutrition, Recipe, RecipeIngredient } from "./coach-george-nutrition"

const FOOD_SHEET_ID = "1-ntS3chNb93e6t-cu3A9vmL3WvNsLfzxtKYbedhsjJg"
const RECIPE_SHEET_ID = "1oVN4XUX3mqnTzvncww1z_mWxwPA8vzKrU05Hh9gXCGo"
const UPLOADED_INGREDIENTS_PATH = "lib/coach-george/data/current-ingredients.csv"
const UPLOADED_RECIPES_PATH = "lib/coach-george/data/current-recipes.csv"

export type PlannerDataSource = "uploaded_csv" | "google_sheets" | "local_fallback"
export type PlannerData = {
  foods: Food[]
  recipes: Recipe[]
  source: PlannerDataSource
  statusMessage: string
  fallbackReason: string | null
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
  statusMessage: "Using local fallback planner data.",
  fallbackReason: "No valid uploaded or Google Sheets planner data could be loaded.",
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function normalizeRecipeName(input: string) {
  return input.replace(/^﻿/, "").replace(/\s+/g, " ").trim()
}

function normalizeRecipeKey(input: string) {
  return normalizeRecipeName(input).toLowerCase()
}

function normalizeHeader(input: string) {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_")
}

function unwrapQuotedCsvLines(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/)
  const unwrapped = lines.map((line) => {
    const trimmed = line.trim()
    if (!trimmed) return ""
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1).replace(/""/g, '"')
    }
    return trimmed
  })
  return unwrapped.join("\n")
}

function parseCsv(text: string): CsvRow[] {
  const prepared = unwrapQuotedCsvLines(text)
  const rows: string[][] = []
  let current = ""
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < prepared.length; i += 1) {
    const char = prepared[i]
    const next = prepared[i + 1]

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

function normalizeMealType(value: string | undefined, recipeName = ""): Recipe["mealType"] {
  const raw = `${value || ""} ${recipeName}`.toLowerCase()
  if (/(break|omelette|weetabix|oat|porridge|yogurt|yoghurt|smoothie|toast|pancake|cereal|eggs?)/.test(raw)) return "breakfast"
  if (/(snack|shake|bar|bites?|overnight oats|protein pudding)/.test(raw)) return "snack"
  if (/(dinner|evening|supper|curry|chili|pasta|rice bowl|stir fry|lasagne|bolognese)/.test(raw)) return "dinner"
  if (/(lunch|wrap|sandwich|salad|bagel|burrito|toastie)/.test(raw)) return "lunch"
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

function normalizeFoodName(value: string) {
  return value.toLowerCase().replace(/[%(),]/g, " ").replace(/\s+/g, " ").trim()
}

function resolveFoodByName(name: string, foods: Food[]) {
  const target = normalizeFoodName(name)
  return (
    foods.find((item) => normalizeFoodName(item.name) === target) ||
    foods.find((item) => normalizeFoodName(item.name).includes(target)) ||
    foods.find((item) => target.includes(normalizeFoodName(item.name))) ||
    null
  )
}

function inferAllergens(name: string) {
  const lower = name.toLowerCase()
  const allergens: string[] = []
  if (/(milk|yogurt|yoghurt|cheese|whey|skyr|quark|butter)/.test(lower)) allergens.push("dairy")
  if (/(bread|pasta|wrap|bagel|weetabix|oats)/.test(lower)) allergens.push("gluten")
  if (/(peanut|almond|cashew|hazelnut|walnut)/.test(lower)) allergens.push("nuts")
  if (/(prawn|shrimp|shellfish)/.test(lower)) allergens.push("shellfish")
  if (/(egg)/.test(lower)) allergens.push("egg")
  return allergens
}

function inferDietaryTags(name: string, category: string, tier: string) {
  const lower = `${name} ${category} ${tier}`.toLowerCase()
  const tags = new Set<string>(splitList(category).concat(splitList(tier)))
  if (/(chicken|turkey|beef|steak|mince|bacon|ham|sausage|pork)/.test(lower)) tags.add("meat")
  if (/(salmon|tuna|cod|prawn|shrimp|fish)/.test(lower)) tags.add("fish")
  if (/(egg|milk|yogurt|yoghurt|cheese|whey|quark|skyr)/.test(lower)) tags.add("vegetarian")
  if (/(tofu|tempeh|lentil|bean|rice|oat|fruit|veg|vegetable|potato)/.test(lower)) tags.add("vegan")
  return Array.from(tags)
}

function normalizeFoodRow(row: CsvRow): Food | null {
  const name = row.name || row.food || row.ingredient || row.item || row.product
  if (!name) return null

  const calories = toNumber(row.calories || row.kcal)
  const protein = toNumber(row.protein || row.protein_g)
  const carbs = toNumber(row.carbs || row.carbohydrates || row.carbs_g)
  const fat = toNumber(row.fat || row.fats || row.fat_g)

  if ([calories, protein, carbs, fat].some((entry) => entry === null)) return null

  const category = row.category || ""
  const tier = row.tier || ""

  return {
    id: slugify(row.id || name),
    name: name.trim(),
    allergens: splitList(row.allergens || row.allergy || row.contains).length ? splitList(row.allergens || row.allergy || row.contains) : inferAllergens(name),
    dietaryTags: splitList(row.dietary_tags || row.tags).length ? splitList(row.dietary_tags || row.tags) : inferDietaryTags(name, category, tier),
    nutritionPer100g: {
      calories: calories || 0,
      protein: protein || 0,
      carbs: carbs || 0,
      fat: fat || 0,
    },
  }
}

function deriveRecipeDietary(ingredients: RecipeIngredient[], foods: Food[]): DietaryPreference[] {
  const lowerNames = ingredients
    .map((ingredient) => foods.find((item) => item.id === ingredient.foodId)?.name.toLowerCase() || "")
    .filter(Boolean)

  const containsMeat = lowerNames.some((name) => /(chicken|turkey|beef|steak|mince|bacon|ham|sausage|pork)/.test(name))
  const containsFish = lowerNames.some((name) => /(salmon|tuna|cod|prawn|shrimp|fish)/.test(name))
  const containsEggOrDairy = lowerNames.some((name) => /(egg|milk|yogurt|yoghurt|cheese|whey|quark|skyr|butter)/.test(name))

  if (containsMeat) return ["omnivore"]
  if (containsFish) return ["omnivore", "pescatarian"]
  if (containsEggOrDairy) return ["omnivore", "vegetarian", "pescatarian"]
  return ["omnivore", "vegetarian", "pescatarian", "vegan"]
}

function parseIngredientPairs(value: string, foods: Food[]) {
  const items: RecipeIngredient[] = []
  value
    .split(/\||\n|;/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const match = entry.match(/(.+?)(?:[:\-–]|\s)(\d+(?:\.\d+)?)\s*g?$/i)
      const name = (match?.[1] || entry).trim()
      const grams = toNumber(match?.[2] || "")
      const food = resolveFoodByName(name, foods)
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
      const food = resolveFoodByName(value, foods)
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
    mealType: normalizeMealType(row.meal_type || row.type || row.category, name),
    dietary: normalizeDietary(row.dietary || row.diet || row.tags),
    ingredients,
    nutrition,
  }
}

function buildRecipesFromIngredientRows(rows: CsvRow[], foods: Food[]) {
  const grouped = new Map<string, { name: string; ingredients: RecipeIngredient[] }>()

  rows.forEach((row) => {
    const recipeNameRaw = row.recipe || row.recipe_name || row.name || row.title || ""
    const recipeName = normalizeRecipeName(recipeNameRaw)
    const recipeKey = normalizeRecipeKey(recipeNameRaw)
    const ingredientName = (row.ingredient || row.food || row.item || "").trim()
    const grams = toNumber(row.grams || row.gram || row.amount || row.qty || row.quantity)
    if (!recipeKey || !ingredientName || !grams) return

    const food = resolveFoodByName(ingredientName, foods)
    if (!food) return

    const current = grouped.get(recipeKey) || { name: recipeName, ingredients: [] }
    current.ingredients.push({ foodId: food.id, grams })
    grouped.set(recipeKey, current)
  })

  return Array.from(grouped.values()).map(({ name, ingredients }) => ({
    id: slugify(name),
    name,
    mealType: normalizeMealType(undefined, name),
    dietary: deriveRecipeDietary(ingredients, foods),
    ingredients,
  }))
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

async function tryReadUploadedCsv(relativePath: string) {
  try {
    const { readFile } = await import("node:fs/promises")
    const { join } = await import("node:path")
    const absolutePath = join(process.cwd(), relativePath)
    const text = await readFile(absolutePath, "utf8")
    return text.trim() ? text : null
  } catch {
    return null
  }
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
    .filter((recipe) => recipe.name && recipe.ingredients.length > 0)
}

function parsePlannerCsvs(foodCsv: string, recipeCsv: string, source: PlannerDataSource): PlannerData {
  const foods = parseCsv(foodCsv)
    .map((row) => normalizeFoodRow(row))
    .filter((row): row is Food => Boolean(row))

  if (!foods.length) {
    return {
      ...DEFAULT_DATA,
      statusMessage: "Using local fallback planner data.",
      fallbackReason: `${source} ingredients parsed to zero usable rows.`,
    }
  }

  const recipeRows = parseCsv(recipeCsv)
  const hasSimpleRecipeShape = recipeRows.some((row) => (row.recipe || row.recipe_name || row.name) && row.ingredient && (row.grams || row.amount || row.qty || row.quantity))
  const rawRecipes = hasSimpleRecipeShape
    ? buildRecipesFromIngredientRows(recipeRows, foods)
    : recipeRows.map((row) => normalizeRecipeRow(row, foods)).filter((row): row is RawRecipe => Boolean(row))

  const recipes = attachRecipeNutrition(rawRecipes, foods)

  if (!recipes.length) {
    return {
      ...DEFAULT_DATA,
      statusMessage: "Using local fallback planner data.",
      fallbackReason: `${source} recipes parsed to zero usable rows.`,
    }
  }

  const statusMessage =
    source === "uploaded_csv"
      ? `Using uploaded CSV planner data (${recipes.length} recipes, ${foods.length} foods).`
      : `Using live Google Sheets planner data (${recipes.length} recipes, ${foods.length} foods).`

  return {
    foods,
    recipes,
    source,
    statusMessage,
    fallbackReason: null,
  }
}

export async function loadCoachGeorgePlannerData(): Promise<PlannerData> {
  const uploadedFoodCsv = await tryReadUploadedCsv(UPLOADED_INGREDIENTS_PATH)
  const uploadedRecipeCsv = await tryReadUploadedCsv(UPLOADED_RECIPES_PATH)

  if (uploadedFoodCsv && uploadedRecipeCsv) {
    const uploadedData = parsePlannerCsvs(uploadedFoodCsv, uploadedRecipeCsv, "uploaded_csv")
    if (uploadedData.source === "uploaded_csv") return uploadedData
    return uploadedData
  }

  try {
    const [foodCsv, recipeCsv] = await Promise.all([fetchSheetCsv(FOOD_SHEET_ID), fetchSheetCsv(RECIPE_SHEET_ID)])
    const sheetData = parsePlannerCsvs(foodCsv, recipeCsv, "google_sheets")
    if (sheetData.source === "google_sheets") return sheetData
    return {
      ...sheetData,
      fallbackReason: sheetData.fallbackReason || "Google Sheets data failed validation.",
    }
  } catch {
    return {
      ...DEFAULT_DATA,
      fallbackReason: uploadedFoodCsv || uploadedRecipeCsv ? "Uploaded CSV source was incomplete and Google Sheets fetch failed." : "Google Sheets fetch failed and no uploaded CSV source was available.",
    }
  }
}

export function getLocalCoachGeorgePlannerData(): PlannerData {
  return DEFAULT_DATA
}
