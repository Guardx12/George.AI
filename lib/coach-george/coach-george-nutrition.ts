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

export type PlannedMeal = Recipe & {
  nutrition: Nutrition
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

const mealTypeShares: Record<Profile["mealsPerDay"], Record<Recipe["mealType"], number[]>> = {
  3: {
    breakfast: [0.28],
    lunch: [0.34],
    dinner: [0.38],
    snack: [],
  },
  4: {
    breakfast: [0.24],
    lunch: [0.29],
    dinner: [0.31],
    snack: [0.16],
  },
  5: {
    breakfast: [0.22],
    lunch: [0.24],
    dinner: [0.26],
    snack: [0.14, 0.14],
  },
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundNutrition(input: Nutrition): Nutrition {
  return {
    calories: Math.round(input.calories),
    protein: Math.round(input.protein),
    carbs: Math.round(input.carbs),
    fat: Math.round(input.fat),
  }
}

function normalizeList(values: string[]) {
  return values.map((item) => item.toLowerCase().trim()).filter(Boolean)
}

function roundIngredientGrams(grams: number) {
  if (grams <= 0) return 0
  if (grams < 20) return Math.round(grams)
  return Math.round(grams / 5) * 5
}

export function getDailyTargets(profile: Profile): Nutrition {
  const bmr =
    profile.sex === "male"
      ? 10 * profile.currentWeightKg + 6.25 * profile.heightCm - 5 * profile.age + 5
      : 10 * profile.currentWeightKg + 6.25 * profile.heightCm - 5 * profile.age - 161

  const maintenance = bmr * activityMultipliers[profile.activityLevel]
  const calorieTarget =
    profile.goal === "lose-fat"
      ? maintenance - 400
      : profile.goal === "gain-muscle"
        ? maintenance + 220
        : maintenance - 120

  const proteinPerKg =
    profile.goal === "gain-muscle"
      ? 2.2
      : profile.goal === "lose-fat"
        ? 2.1
        : 1.9

  const protein = profile.currentWeightKg * proteinPerKg
  const fat = (calorieTarget * 0.27) / 9
  const carbs = (calorieTarget - protein * 4 - fat * 9) / 4

  return roundNutrition({
    calories: calorieTarget,
    protein,
    carbs,
    fat,
  })
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

function getScaledRecipeNutrition(recipe: Recipe, scale: number): Nutrition {
  const totals = recipe.ingredients.reduce(
    (acc, ingredient) => {
      const food = foods.find((entry) => entry.id === ingredient.foodId)
      if (!food) return acc
      const factor = (ingredient.grams * scale) / 100
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

function scaleRecipe(recipe: Recipe, scale: number): PlannedMeal {
  const scaledIngredients = recipe.ingredients.map((ingredient) => ({
    ...ingredient,
    grams: roundIngredientGrams(ingredient.grams * scale),
  }))

  const scaledRecipe: Recipe = {
    ...recipe,
    ingredients: scaledIngredients,
  }

  return {
    ...scaledRecipe,
    nutrition: getRecipeNutrition(scaledRecipe),
  }
}

function recipeFitsProfile(recipe: Recipe, profile: Profile) {
  if (!recipe.dietary.includes(profile.dietaryPreference)) return false

  return recipe.ingredients.every((ingredient) => {
    const food = foods.find((entry) => entry.id === ingredient.foodId)
    if (!food) return false

    const lowerName = food.name.toLowerCase()
    const blockedByDislike = profile.dislikedFoods.some((item) => lowerName.includes(item))
    const blockedByAllergen = food.allergens.some((allergen) => profile.allergies.includes(allergen.toLowerCase()))

    return !blockedByDislike && !blockedByAllergen
  })
}

function getMealSequence(mealsPerDay: Profile["mealsPerDay"]): Array<Recipe["mealType"]> {
  if (mealsPerDay === 3) return ["breakfast", "lunch", "dinner"]
  if (mealsPerDay === 4) return ["breakfast", "lunch", "snack", "dinner"]
  return ["breakfast", "snack", "lunch", "snack", "dinner"]
}

function getMealShare(
  mealsPerDay: Profile["mealsPerDay"],
  mealType: Recipe["mealType"],
  occurrenceIndex: number,
) {
  const shares = mealTypeShares[mealsPerDay][mealType]
  if (!shares.length) return 0.2
  return shares[occurrenceIndex] ?? shares[shares.length - 1]
}

function chooseRecipeForSlot(
  pool: Recipe[],
  mealTypePool: Recipe[],
  usedIds: Set<string>,
  slotIndex: number,
) {
  const source = mealTypePool.length ? mealTypePool : pool
  if (!source.length) return null

  const unused = source.filter((recipe) => !usedIds.has(recipe.id))
  const targetPool = unused.length ? unused : source
  return targetPool[slotIndex % targetPool.length]
}

export function buildMealPlan(profile: Profile) {
  const normalizedProfile: Profile = {
    ...profile,
    allergies: normalizeList(profile.allergies),
    dislikedFoods: normalizeList(profile.dislikedFoods),
    dietaryPreference: (["omnivore", "vegetarian", "pescatarian", "vegan"] as DietaryPreference[]).includes(profile.dietaryPreference)
      ? profile.dietaryPreference
      : "omnivore",
  }

  const targets = getDailyTargets(normalizedProfile)
  const eligibleRecipes = recipes.filter((recipe) => recipeFitsProfile(recipe, normalizedProfile))
  const fallbackPool = eligibleRecipes.length ? eligibleRecipes : recipes

  const byType = {
    breakfast: fallbackPool.filter((recipe) => recipe.mealType === "breakfast"),
    lunch: fallbackPool.filter((recipe) => recipe.mealType === "lunch"),
    dinner: fallbackPool.filter((recipe) => recipe.mealType === "dinner"),
    snack: fallbackPool.filter((recipe) => recipe.mealType === "snack"),
  }

  const sequence = getMealSequence(normalizedProfile.mealsPerDay)
  const occurrenceCount: Record<Recipe["mealType"], number> = {
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    snack: 0,
  }

  const usedRecipeIds = new Set<string>()

  const plan: PlannedMeal[] = sequence.map((mealType, slotIndex) => {
    const recipe = chooseRecipeForSlot(fallbackPool, byType[mealType], usedRecipeIds, slotIndex)
    if (!recipe) {
      throw new Error(`No recipes available for meal type: ${mealType}`)
    }

    usedRecipeIds.add(recipe.id)

    const occurrenceIndex = occurrenceCount[mealType]
    occurrenceCount[mealType] += 1

    const mealCalorieTarget = targets.calories * getMealShare(normalizedProfile.mealsPerDay, mealType, occurrenceIndex)
    const mealProteinTarget = targets.protein / sequence.length

    const baseNutrition = getRecipeNutrition(recipe)
    const calorieScale = mealCalorieTarget > 0 && baseNutrition.calories > 0 ? mealCalorieTarget / baseNutrition.calories : 1
    const proteinScale = mealProteinTarget > 0 && baseNutrition.protein > 0 ? mealProteinTarget / baseNutrition.protein : 1

    const scale = clamp(Math.max(calorieScale, proteinScale * 0.9), 0.75, 2.6)

    return scaleRecipe(recipe, scale)
  })

  const totals = roundNutrition(
    plan.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.nutrition.calories,
        protein: acc.protein + meal.nutrition.protein,
        carbs: acc.carbs + meal.nutrition.carbs,
        fat: acc.fat + meal.nutrition.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    ),
  )

  return {
    plan,
    totals,
    targets,
    profile: normalizedProfile,
  }
}
