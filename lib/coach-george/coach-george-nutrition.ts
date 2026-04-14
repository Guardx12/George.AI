import foodsData from "./data/foods.json"
import recipesData from "./data/recipes.json"

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very-active"
export type Goal = "lose-fat" | "recomp" | "gain-muscle"
export type Sex = "male" | "female"
export type DietaryPreference = "omnivore" | "vegetarian" | "pescatarian" | "vegan"

export type Nutrition = { calories: number; protein: number; carbs: number; fat: number }
export type Food = {
  id: string
  name: string
  allergens: string[]
  dietaryTags: string[]
  nutritionPer100g: Nutrition
}
export type RecipeIngredient = { foodId: string; grams: number }
export type Recipe = {
  id: string
  name: string
  mealType: "breakfast" | "lunch" | "dinner" | "snack"
  dietary: DietaryPreference[]
  ingredients: RecipeIngredient[]
  nutrition?: Nutrition
}

export type Profile = {
  goal: Goal
  sex: Sex
  age: number
  heightCm: number
  currentWeightKg: number
  activityLevel: ActivityLevel
  allergies: string[]
  dislikedFoods: string[]
  mealsPerDay: 3 | 4 | 5
  dietaryPreference: DietaryPreference
}

export const foods: Food[] = foodsData as Food[]
export const recipes: Recipe[] = recipesData as Recipe[]

const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  "very-active": 1.9,
}

export function roundNutrition(input: Nutrition): Nutrition {
  return {
    calories: Math.round(input.calories),
    protein: Math.round(input.protein),
    carbs: Math.round(input.carbs),
    fat: Math.round(input.fat),
  }
}

export function getDailyTargets(profile: Profile): Nutrition {
  const bmr =
    profile.sex === "male"
      ? 10 * profile.currentWeightKg + 6.25 * profile.heightCm - 5 * profile.age + 5
      : 10 * profile.currentWeightKg + 6.25 * profile.heightCm - 5 * profile.age - 161

  const maintenance = bmr * activityMultipliers[profile.activityLevel]
  const calorieTarget =
    profile.goal === "lose-fat" ? maintenance - 400 : profile.goal === "gain-muscle" ? maintenance + 220 : maintenance - 120

  const proteinPerKg = profile.goal === "gain-muscle" ? 2.2 : profile.goal === "lose-fat" ? 2.1 : 1.9
  const protein = profile.currentWeightKg * proteinPerKg
  const fat = (calorieTarget * 0.27) / 9
  const carbs = (calorieTarget - protein * 4 - fat * 9) / 4

  return roundNutrition({ calories: calorieTarget, protein, carbs, fat })
}

export function getRecipeNutrition(recipe: Recipe, availableFoods: Food[] = foods): Nutrition {
  if (recipe.nutrition) return roundNutrition(recipe.nutrition)

  const totals = recipe.ingredients.reduce(
    (acc, ingredient) => {
      const food = availableFoods.find((entry) => entry.id === ingredient.foodId)
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

  return roundNutrition(totals)
}

function recipeFitsProfile(recipe: Recipe, profile: Profile, availableFoods: Food[]) {
  if (!recipe.dietary.includes(profile.dietaryPreference)) return false
  return recipe.ingredients.every((ingredient) => {
    const food = availableFoods.find((entry) => entry.id === ingredient.foodId)
    if (!food) return false
    const lowerName = food.name.toLowerCase()
    const blockedByDislike = profile.dislikedFoods.some((item) => lowerName.includes(item.toLowerCase()))
    const blockedByAllergen = food.allergens.some((allergen) => profile.allergies.includes(allergen.toLowerCase()))
    return !blockedByDislike && !blockedByAllergen
  })
}

function nutritionDelta(a: Nutrition, b: Nutrition) {
  return {
    calories: Math.abs(a.calories - b.calories),
    protein: Math.abs(a.protein - b.protein),
    carbs: Math.abs(a.carbs - b.carbs),
    fat: Math.abs(a.fat - b.fat),
  }
}

function sumNutrition(entries: Nutrition[]) {
  return roundNutrition(
    entries.reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories,
        protein: acc.protein + item.protein,
        carbs: acc.carbs + item.carbs,
        fat: acc.fat + item.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    ),
  )
}

function scorePlan(totals: Nutrition, targets: Nutrition, uniqueRecipeCount: number) {
  const delta = nutritionDelta(totals, targets)
  return delta.calories * 1 + delta.protein * 4 + delta.carbs * 2 + delta.fat * 3 - uniqueRecipeCount * 10
}

function getMealSequence(mealsPerDay: Profile["mealsPerDay"]): Array<Recipe["mealType"]> {
  if (mealsPerDay === 3) return ["breakfast", "lunch", "dinner"]
  if (mealsPerDay === 4) return ["breakfast", "lunch", "snack", "dinner"]
  return ["breakfast", "snack", "lunch", "snack", "dinner"]
}

function chooseBestRecipe(pool: Recipe[], remaining: Nutrition, usedIds: Set<string>, availableFoods: Food[]) {
  const scored = pool
    .map((recipe) => {
      const nutrition = getRecipeNutrition(recipe, availableFoods)
      const score =
        Math.abs(remaining.calories - nutrition.calories) * 1 +
        Math.abs(remaining.protein - nutrition.protein) * 4 +
        Math.abs(remaining.carbs - nutrition.carbs) * 2 +
        Math.abs(remaining.fat - nutrition.fat) * 3 +
        (usedIds.has(recipe.id) ? 60 : 0)

      return { recipe: { ...recipe, nutrition }, score }
    })
    .sort((a, b) => a.score - b.score)

  return scored[0]?.recipe || null
}

export function buildMealPlan(profile: Profile, plannerData?: { foods: Food[]; recipes: Recipe[] }) {
  const supportedPreference: DietaryPreference[] = ["omnivore", "vegetarian", "pescatarian", "vegan"]
  const normalizedProfile = {
    ...profile,
    allergies: profile.allergies.map((item) => item.toLowerCase().trim()).filter(Boolean),
    dislikedFoods: profile.dislikedFoods.map((item) => item.toLowerCase().trim()).filter(Boolean),
    dietaryPreference: supportedPreference.includes(profile.dietaryPreference) ? profile.dietaryPreference : "omnivore",
  }

  const availableFoods = plannerData?.foods?.length ? plannerData.foods : foods
  const availableRecipes = plannerData?.recipes?.length ? plannerData.recipes : recipes
  const eligibleRecipes = availableRecipes.filter((recipe) => recipeFitsProfile(recipe, normalizedProfile, availableFoods))
  const workingRecipes = eligibleRecipes.length ? eligibleRecipes : availableRecipes
  const targets = getDailyTargets(normalizedProfile)
  const sequence = getMealSequence(normalizedProfile.mealsPerDay)

  const recipesByType = {
    breakfast: workingRecipes.filter((recipe) => recipe.mealType === "breakfast"),
    lunch: workingRecipes.filter((recipe) => recipe.mealType === "lunch"),
    dinner: workingRecipes.filter((recipe) => recipe.mealType === "dinner"),
    snack: workingRecipes.filter((recipe) => recipe.mealType === "snack"),
  }

  const candidatePlans: Array<Array<Recipe & { nutrition: Nutrition }>> = []

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const usedIds = new Set<string>()
    const currentPlan: Array<Recipe & { nutrition: Nutrition }> = []

    sequence.forEach((type, index) => {
      const pool = recipesByType[type].length ? recipesByType[type] : workingRecipes
      const consumedTotals = sumNutrition(currentPlan.map((item) => item.nutrition))
      const mealsLeft = sequence.length - index
      const remaining = {
        calories: Math.max(0, (targets.calories - consumedTotals.calories) / Math.max(1, mealsLeft)),
        protein: Math.max(0, (targets.protein - consumedTotals.protein) / Math.max(1, mealsLeft)),
        carbs: Math.max(0, (targets.carbs - consumedTotals.carbs) / Math.max(1, mealsLeft)),
        fat: Math.max(0, (targets.fat - consumedTotals.fat) / Math.max(1, mealsLeft)),
      }

      const rotatedPool = pool.slice(attempt).concat(pool.slice(0, attempt))
      const selected = chooseBestRecipe(rotatedPool, remaining, usedIds, availableFoods)
      if (selected) {
        usedIds.add(selected.id)
        currentPlan.push(selected)
      }
    })

    if (currentPlan.length) candidatePlans.push(currentPlan)
  }

  const bestPlan = candidatePlans.sort((a, b) => {
    const totalA = sumNutrition(a.map((item) => item.nutrition))
    const totalB = sumNutrition(b.map((item) => item.nutrition))
    return scorePlan(totalA, targets, new Set(a.map((item) => item.id)).size) - scorePlan(totalB, targets, new Set(b.map((item) => item.id)).size)
  })[0] || []

  const totals = sumNutrition(bestPlan.map((recipe) => recipe.nutrition))

  return { plan: bestPlan, totals, targets, profile: normalizedProfile }
}
