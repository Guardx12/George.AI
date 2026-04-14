import foodsRaw from "../data/foods.json"
import recipesRaw from "../data/recipes.json"

export type FoodItem = {
  name: string
  calories: number
  protein: number
  carbs: number
  fats: number
}

export type RecipeIngredient = {
  name: string
  grams: number
}

export type RecipeItem = {
  mealName: string
  ingredients: RecipeIngredient[]
}

export type MacroTotals = {
  calories: number
  protein: number
  carbs: number
  fats: number
}

export type RecipeWithTotals = RecipeItem & {
  totals: MacroTotals
}

export type DailyTargets = {
  calories: number
  protein: number
}

export type DailyMacroSummary = {
  consumed: MacroTotals
  remaining: { calories: number; protein: number }
}

const foods = foodsRaw as FoodItem[]
const recipes = recipesRaw as RecipeItem[]

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function normalizeName(value: string) {
  return value.trim().toLowerCase()
}

export function getFoodDatabase() {
  return foods
}

export function getRecipeDatabase() {
  return recipes
}

export function buildFoodMap(foodDb: FoodItem[]) {
  const map = new Map<string, FoodItem>()
  for (const food of foodDb) map.set(normalizeName(food.name), food)
  return map
}

export function calculateIngredientMacros(ingredient: RecipeIngredient, foodMap: Map<string, FoodItem>): MacroTotals {
  const food = foodMap.get(normalizeName(ingredient.name))
  if (!food) {
    throw new Error(`Missing food in database: ${ingredient.name}`)
  }
  const factor = ingredient.grams / 100
  return {
    calories: round1(food.calories * factor),
    protein: round1(food.protein * factor),
    carbs: round1(food.carbs * factor),
    fats: round1(food.fats * factor),
  }
}

export function sumMacros(parts: MacroTotals[]): MacroTotals {
  return {
    calories: round1(parts.reduce((sum, item) => sum + item.calories, 0)),
    protein: round1(parts.reduce((sum, item) => sum + item.protein, 0)),
    carbs: round1(parts.reduce((sum, item) => sum + item.carbs, 0)),
    fats: round1(parts.reduce((sum, item) => sum + item.fats, 0)),
  }
}

export function calculateRecipeTotals(recipe: RecipeItem, foodMap: Map<string, FoodItem>) {
  const ingredientTotals = recipe.ingredients.map((ingredient) => calculateIngredientMacros(ingredient, foodMap))
  return sumMacros(ingredientTotals)
}

export function buildRecipesWithTotals(recipeDb: RecipeItem[], foodDb: FoodItem[]): RecipeWithTotals[] {
  const foodMap = buildFoodMap(foodDb)
  return recipeDb.map((recipe) => ({
    ...recipe,
    totals: calculateRecipeTotals(recipe, foodMap),
  }))
}

export function summarizeDailyMacros(meals: RecipeWithTotals[], targets: DailyTargets): DailyMacroSummary {
  const consumed = sumMacros(meals.map((meal) => meal.totals))
  return {
    consumed,
    remaining: {
      calories: round1(targets.calories - consumed.calories),
      protein: round1(targets.protein - consumed.protein),
    },
  }
}

export function findRecipeSwaps(source: RecipeWithTotals, allRecipes: RecipeWithTotals[], topN = 3): RecipeWithTotals[] {
  const scored = allRecipes
    .filter((recipe) => recipe.mealName !== source.mealName)
    .map((recipe) => {
      const calorieDelta = Math.abs(recipe.totals.calories - source.totals.calories)
      const proteinDelta = Math.abs(recipe.totals.protein - source.totals.protein)
      const score = calorieDelta + proteinDelta * 10
      return { recipe, score }
    })
    .sort((a, b) => a.score - b.score)

  return scored.slice(0, topN).map((item) => item.recipe)
}
