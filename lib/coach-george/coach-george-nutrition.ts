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

export function getRecipeNutrition(recipe: Recipe): Nutrition {
  const totals = recipe.ingredients.reduce(
    (acc, ingredient) => {
      const food = foods.find((entry) => entry.id === ingredient.foodId)
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

function recipeFitsProfile(recipe: Recipe, profile: Profile) {
  if (!recipe.dietary.includes(profile.dietaryPreference)) return false
  return recipe.ingredients.every((ingredient) => {
    const food = foods.find((entry) => entry.id === ingredient.foodId)
    if (!food) return false
    const lowerName = food.name.toLowerCase()
    const blockedByDislike = profile.dislikedFoods.some((item) => lowerName.includes(item.toLowerCase()))
    const blockedByAllergen = food.allergens.some((allergen) => profile.allergies.includes(allergen.toLowerCase()))
    return !blockedByDislike && !blockedByAllergen
  })
}

export function buildMealPlan(profile: Profile) {
  const supportedPreference: DietaryPreference[] = ["omnivore", "vegetarian", "pescatarian", "vegan"]
  const normalizedProfile = {
    ...profile,
    allergies: profile.allergies.map((item) => item.toLowerCase().trim()).filter(Boolean),
    dislikedFoods: profile.dislikedFoods.map((item) => item.toLowerCase().trim()).filter(Boolean),
    dietaryPreference: supportedPreference.includes(profile.dietaryPreference) ? profile.dietaryPreference : "omnivore",
  }

  const eligibleRecipes = recipes.filter((recipe) => recipeFitsProfile(recipe, normalizedProfile))
  const byType = {
    breakfast: eligibleRecipes.filter((recipe) => recipe.mealType === "breakfast"),
    lunch: eligibleRecipes.filter((recipe) => recipe.mealType === "lunch"),
    dinner: eligibleRecipes.filter((recipe) => recipe.mealType === "dinner"),
    snack: eligibleRecipes.filter((recipe) => recipe.mealType === "snack"),
  }

  const sequence: Array<keyof typeof byType> =
    normalizedProfile.mealsPerDay === 3
      ? ["breakfast", "lunch", "dinner"]
      : normalizedProfile.mealsPerDay === 4
        ? ["breakfast", "lunch", "snack", "dinner"]
        : ["breakfast", "snack", "lunch", "snack", "dinner"]

  let fallbackPool = eligibleRecipes
  if (!fallbackPool.length) fallbackPool = recipes

  const plan = sequence.map((type, index) => {
    const pool = byType[type].length ? byType[type] : fallbackPool
    const recipe = pool[index % pool.length]
    return {
      ...recipe,
      nutrition: getRecipeNutrition(recipe),
    }
  })

  const totals = roundNutrition(
    plan.reduce(
      (acc, recipe) => ({
        calories: acc.calories + recipe.nutrition.calories,
        protein: acc.protein + recipe.nutrition.protein,
        carbs: acc.carbs + recipe.nutrition.carbs,
        fat: acc.fat + recipe.nutrition.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    ),
  )

  return { plan, totals, targets: getDailyTargets(normalizedProfile), profile: normalizedProfile }
}
