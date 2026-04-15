import foodsData from "./data/foods.json"
import recipesData from "./data/recipes.json"

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very-active"
export type Goal = "lose-fat" | "recomp" | "gain-muscle"
export type Sex = "male" | "female"
export type DietaryPreference = "omnivore" | "vegetarian" | "pescatarian" | "vegan"
export type PlanMode = "balanced" | "flexible" | "performance" | "higher-carb" | "lower-carb"

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
  planMode: PlanMode
}

export type ComputedMeal = Recipe & {
  servingMultiplier: number
  nutrition: Nutrition
  ingredients: RecipeIngredient[]
}

export type MealPlanResult = {
  plan: ComputedMeal[]
  totals: Nutrition
  targets: Nutrition
  profile: Profile
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

function getMacroStrategy(profile: Profile) {
  const mode = profile.planMode === "higher-carb" ? "flexible" : profile.planMode === "lower-carb" ? "performance" : profile.planMode
  if (mode === "flexible") {
    return {
      proteinPerKg: profile.goal === "gain-muscle" ? 2.05 : profile.goal === "lose-fat" ? 1.95 : 1.85,
      fatRatio: 0.2,
    }
  }

  if (mode === "performance") {
    return {
      proteinPerKg: profile.goal === "gain-muscle" ? 2.3 : profile.goal === "lose-fat" ? 2.2 : 2.0,
      fatRatio: 0.35,
    }
  }

  return {
    proteinPerKg: profile.goal === "gain-muscle" ? 2.2 : profile.goal === "lose-fat" ? 2.1 : 1.9,
    fatRatio: 0.27,
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

  const macroStrategy = getMacroStrategy(profile)
  const protein = profile.currentWeightKg * macroStrategy.proteinPerKg
  const fat = (calorieTarget * macroStrategy.fatRatio) / 9
  const carbs = Math.max(0, (calorieTarget - protein * 4 - fat * 9) / 4)

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

function subtractNutrition(a: Nutrition, b: Nutrition): Nutrition {
  return {
    calories: a.calories - b.calories,
    protein: a.protein - b.protein,
    carbs: a.carbs - b.carbs,
    fat: a.fat - b.fat,
  }
}

function proteinDensity(nutrition: Nutrition) {
  return nutrition.protein / Math.max(1, nutrition.calories)
}

function carbDensity(nutrition: Nutrition) {
  return nutrition.carbs / Math.max(1, nutrition.calories)
}

function fatDensity(nutrition: Nutrition) {
  return nutrition.fat / Math.max(1, nutrition.calories)
}

function calorieDensity(nutrition: Nutrition) {
  return nutrition.calories / Math.max(1, nutrition.protein + nutrition.carbs + nutrition.fat)
}

function cleanRecipeName(name: string) {
  return name
    .replace(/[_]+/g, " ")
    .replace(/\s*[-–—]+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function scoreNutritionFit(actual: Nutrition, target: Nutrition) {
  const delta = subtractNutrition(actual, target)
  const caloriePenalty = delta.calories < 0 ? Math.abs(delta.calories) * 1.7 : Math.abs(delta.calories) * 1.0
  const proteinPenalty = delta.protein < 0 ? Math.abs(delta.protein) * 8.4 : Math.abs(delta.protein) * 2.1
  const carbPenalty = delta.carbs > 0 ? delta.carbs * 3.8 : Math.abs(delta.carbs) * 1.0
  const fatPenalty = delta.fat > 0 ? delta.fat * 3.1 : Math.abs(delta.fat) * 1.1

  return caloriePenalty + proteinPenalty + carbPenalty + fatPenalty
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



type PlanValidation = {
  valid: boolean
  calorieTolerance: number
  carbTolerance: number
  fatTolerance: number
  issues: string[]
}

function getValidationTolerances(targets: Nutrition) {
  return {
    calories: Math.max(40, Math.round(targets.calories * 0.02)),
    carbs: Math.max(20, Math.round(targets.carbs * 0.1)),
    fat: Math.max(10, Math.round(targets.fat * 0.1)),
  }
}

function validatePlanTotals(totals: Nutrition, targets: Nutrition): PlanValidation {
  const tolerances = getValidationTolerances(targets)
  const issues: string[] = []

  if (Math.abs(totals.calories - targets.calories) > tolerances.calories) issues.push("calories")
  if (totals.protein < targets.protein * 0.95) issues.push("protein")
  if (Math.abs(totals.carbs - targets.carbs) > tolerances.carbs) issues.push("carbs")
  if (Math.abs(totals.fat - targets.fat) > tolerances.fat) issues.push("fat")

  return {
    valid: issues.length === 0,
    calorieTolerance: tolerances.calories,
    carbTolerance: tolerances.carbs,
    fatTolerance: tolerances.fat,
    issues,
  }
}

function validationPenalty(totals: Nutrition, targets: Nutrition) {
  const tolerances = getValidationTolerances(targets)
  const calorieMiss = Math.max(0, Math.abs(totals.calories - targets.calories) - tolerances.calories)
  const proteinMiss = Math.max(0, targets.protein * 0.95 - totals.protein)
  const carbMiss = Math.max(0, Math.abs(totals.carbs - targets.carbs) - tolerances.carbs)
  const fatMiss = Math.max(0, Math.abs(totals.fat - targets.fat) - tolerances.fat)
  return calorieMiss * 8 + proteinMiss * 18 + carbMiss * 7 + fatMiss * 8
}

function scorePlan(totals: Nutrition, targets: Nutrition, uniqueRecipeCount: number, highCarbMeals = 0) {
  const calorieGap = targets.calories - totals.calories
  const calorieUndershoot = Math.max(0, calorieGap)
  const calorieOvershoot = Math.max(0, -calorieGap)
  const proteinGap = Math.max(0, targets.protein - totals.protein)
  const carbOvershoot = Math.max(0, totals.carbs - targets.carbs)
  const fatOvershoot = Math.max(0, totals.fat - targets.fat)
  const hardConstraintPenalty = Math.max(0, highCarbMeals - 2) * 320
  const proteinFloorPenalty = Math.max(0, targets.protein * 0.95 - totals.protein) * 28

  return (
    scoreNutritionFit(totals, targets) +
    validationPenalty(totals, targets) +
    calorieUndershoot * 2.6 +
    calorieOvershoot * 1.35 +
    proteinGap * 8.8 +
    carbOvershoot * 3.8 +
    fatOvershoot * 3.3 +
    proteinFloorPenalty +
    hardConstraintPenalty -
    uniqueRecipeCount * 8
  )
}


function getRecipeFoodNames(recipe: Recipe, availableFoods: Food[]) {
  return recipe.ingredients
    .map((ingredient) => availableFoods.find((entry) => entry.id === ingredient.foodId)?.name.toLowerCase() || "")
    .filter(Boolean)
}

function isCarbBaseRecipe(recipe: Recipe, availableFoods: Food[]) {
  const nutrition = getRecipeNutrition(recipe, availableFoods)
  const text = `${recipe.name} ${getRecipeFoodNames(recipe, availableFoods).join(" ")}`.toLowerCase()
  const directBase = /(\brice\b|pasta|noodles?|wraps?|tortillas?|bread|toast|bagels?|oats?|cereal|granola|potatoes?|fries|chips)/.test(text)
  const beanHeavy = /beans?|lentils?|chickpeas?/.test(text) && nutrition.carbs > nutrition.protein * 1.2
  return directBase || beanHeavy
}

function isProteinForwardRecipe(recipe: Recipe & { nutrition?: Nutrition }, availableFoods: Food[]) {
  const nutrition = recipe.nutrition || getRecipeNutrition(recipe, availableFoods)
  const names = getRecipeFoodNames(recipe, availableFoods).join(" ")
  return nutrition.protein >= 32 || proteinDensity(nutrition) >= 0.12 || /(chicken|turkey|beef|steak|mince|tuna|salmon|prawn|shrimp|egg|whey|skyr|greek yogurt|greek yoghurt|quark|cottage cheese)/.test(`${recipe.name.toLowerCase()} ${names}`)
}

function isHighFatRecipe(recipe: Recipe & { nutrition?: Nutrition }, availableFoods: Food[]) {
  const nutrition = recipe.nutrition || getRecipeNutrition(recipe, availableFoods)
  const text = `${recipe.name} ${getRecipeFoodNames(recipe as Recipe, availableFoods).join(" ")}`.toLowerCase()
  return nutrition.fat >= 20 || fatDensity(nutrition) >= 0.05 || /(burger|toastie|cheese|mayo|mayonnaise|oil|butter|cream|pesto|bacon|sausage)/.test(text)
}

function isLeanProteinRecipe(recipe: Recipe & { nutrition?: Nutrition }, availableFoods: Food[]) {
  const nutrition = recipe.nutrition || getRecipeNutrition(recipe, availableFoods)
  return isProteinForwardRecipe(recipe, availableFoods) && nutrition.fat <= 18 && fatDensity(nutrition) <= 0.04
}

function countHighCarbMeals(plan: Array<{ id: string; name: string; ingredients: RecipeIngredient[]; nutrition: Nutrition }>, availableFoods: Food[]) {
  return plan.filter((recipe) => isCarbBaseRecipe(recipe as Recipe, availableFoods)).length
}

function getMealSequence(mealsPerDay: Profile["mealsPerDay"]): Array<Recipe["mealType"]> {
  if (mealsPerDay === 3) return ["breakfast", "lunch", "dinner"]
  if (mealsPerDay === 4) return ["breakfast", "lunch", "snack", "dinner"]
  return ["breakfast", "snack", "lunch", "snack", "dinner"]
}

function rankRecipesForRemaining(
  pool: Recipe[],
  remaining: Nutrition,
  usedIds: Set<string>,
  availableFoods: Food[],
  highCarbMealsUsed: number,
  targets: Nutrition,
  mealsPerDay: Profile["mealsPerDay"],
  profile: Profile,
) {
  return pool
    .map((recipe) => {
      const nutrition = getRecipeNutrition(recipe, availableFoods)
      const proteinForward = isProteinForwardRecipe({ ...recipe, nutrition }, availableFoods)
      const leanProtein = isLeanProteinRecipe({ ...recipe, nutrition }, availableFoods)
      const highFat = isHighFatRecipe({ ...recipe, nutrition }, availableFoods)
      const highCarb = isCarbBaseRecipe(recipe, availableFoods)
      const proteinGap = Math.max(0, remaining.protein - nutrition.protein)
      const carbOvershoot = Math.max(0, nutrition.carbs - remaining.carbs)
      const fatOvershoot = Math.max(0, nutrition.fat - remaining.fat)
      const mealCalorieTarget = Math.max(remaining.calories, targets.calories / Math.max(1, mealsPerDay))
      const calorieGap = mealCalorieTarget - nutrition.calories
      const caloriesNeededBias = remaining.calories > 650 || targets.calories >= 3000
      const highTargetMode = targets.calories >= 3000 || mealsPerDay <= 3
      const fatLossMode = profile.goal === "lose-fat"
      const planMode = profile.planMode === "higher-carb" ? "flexible" : profile.planMode === "lower-carb" ? "performance" : profile.planMode
      const tooSmallPenalty = calorieGap > 0 ? calorieGap * (highTargetMode ? 1.1 : 0.7) : 0
      if (fatLossMode && highCarb && highCarbMealsUsed >= 2) {
        return { recipe: { ...recipe, nutrition }, score: Number.POSITIVE_INFINITY }
      }
      const carbGuardPenalty = highCarb && highCarbMealsUsed >= 2 ? 10000 : 0
      const highCarbBiasPenalty = highCarb && !caloriesNeededBias ? Math.max(0, nutrition.carbs - nutrition.protein) * 1.2 : 0
      const calorieDensityBonus = calorieDensity(nutrition) * (highTargetMode ? 48 : 18)
      const calorieMatchPenalty = calorieGap < 0 ? Math.abs(calorieGap) * 0.16 : 0
      const score =
        scoreNutritionFit(nutrition, remaining) +
        tooSmallPenalty +
        calorieMatchPenalty +
        proteinGap * 6.8 +
        carbOvershoot * (highTargetMode ? 2.4 : 5.2) +
        fatOvershoot * (fatLossMode ? 4.1 : 2.4) +
        (usedIds.has(recipe.id) ? 45 : 0) +
        carbGuardPenalty +
        highCarbBiasPenalty +
        (highFat && fatLossMode ? 80 : 0) -
        proteinDensity(nutrition) * 420 -
        calorieDensityBonus -
        (proteinForward && remaining.protein > 18 ? 90 : 0) -
        (leanProtein && fatLossMode ? 52 : 0) -
        (highTargetMode && nutrition.calories >= mealCalorieTarget * 0.78 ? 42 : 0) +
        (remaining.protein > 22 && carbDensity(nutrition) > 0.24 && !caloriesNeededBias ? 28 : 0)

      return { recipe: { ...recipe, nutrition }, score }
    })
    .sort((a, b) => a.score - b.score)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function improvePlanSelections(
  plan: Array<Recipe & { nutrition: Nutrition }>,
  sequence: Array<Recipe["mealType"]>,
  recipesByType: Record<Recipe["mealType"], Recipe[]>,
  targets: Nutrition,
  availableFoods: Food[],
) {
  let bestPlan = [...plan]
  let bestScore = scorePlan(sumNutrition(bestPlan.map((item) => item.nutrition)), targets, new Set(bestPlan.map((item) => item.id)).size, countHighCarbMeals(bestPlan, availableFoods))

  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false

    sequence.forEach((type, index) => {
      const pool = (recipesByType[type].length ? recipesByType[type] : Object.values(recipesByType).flat()).map((recipe) => ({
        ...recipe,
        nutrition: getRecipeNutrition(recipe, availableFoods),
      }))

      const current = bestPlan[index]
      const candidatePool = pool.filter((recipe) => recipe.id !== current?.id)

      candidatePool.forEach((candidate) => {
        const nextPlan = [...bestPlan]
        nextPlan[index] = candidate
        const nextTotals = sumNutrition(nextPlan.map((item) => item.nutrition))
        const nextScore = scorePlan(nextTotals, targets, new Set(nextPlan.map((item) => item.id)).size, countHighCarbMeals(nextPlan, availableFoods))

        if (nextScore < bestScore) {
          bestPlan = nextPlan
          bestScore = nextScore
          changed = true
        }
      })
    })

    if (!changed) break
  }

  return bestPlan
}

function prioritizeProteinAndCarbBalance(
  plan: Array<Recipe & { nutrition: Nutrition }>,
  sequence: Array<Recipe["mealType"]>,
  recipesByType: Record<Recipe["mealType"], Recipe[]>,
  targets: Nutrition,
  availableFoods: Food[],
) {
  let bestPlan = [...plan]
  let bestTotals = sumNutrition(bestPlan.map((item) => item.nutrition))
  let bestScore = scorePlan(bestTotals, targets, new Set(bestPlan.map((item) => item.id)).size, countHighCarbMeals(bestPlan, availableFoods))

  for (let pass = 0; pass < 4; pass += 1) {
    const proteinShortfall = Math.max(0, targets.protein - bestTotals.protein)
    const carbOvershoot = Math.max(0, bestTotals.carbs - targets.carbs)
    if (proteinShortfall <= 8 && carbOvershoot <= 10) break

    let changed = false

    sequence.forEach((type, index) => {
      if (changed) return
      const current = bestPlan[index]
      const pool = (recipesByType[type].length ? recipesByType[type] : Object.values(recipesByType).flat())
        .map((recipe) => ({ ...recipe, nutrition: getRecipeNutrition(recipe, availableFoods) }))
        .filter((recipe) => recipe.id !== current?.id)

      const rankedCandidates = pool
        .map((candidate) => {
          const proteinLift = candidate.nutrition.protein - current.nutrition.protein
          const carbDrop = current.nutrition.carbs - candidate.nutrition.carbs
          const fatDrop = current.nutrition.fat - candidate.nutrition.fat
          const highCarbPenalty = isCarbBaseRecipe(candidate, availableFoods) ? 20 : 0
          const highFatPenalty = isHighFatRecipe(candidate, availableFoods) ? 18 : 0
          const priority =
            (proteinShortfall > 0 ? proteinLift * 8.5 : 0) +
            (carbOvershoot > 0 ? carbDrop * 5.5 : 0) +
            (Math.max(0, bestTotals.fat - targets.fat) > 0 ? fatDrop * 4.5 : 0) +
            (isProteinForwardRecipe(candidate, availableFoods) ? 18 : 0) +
            (isLeanProteinRecipe(candidate, availableFoods) ? 16 : 0) -
            highCarbPenalty -
            highFatPenalty
          return { candidate, priority }
        })
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 8)

      rankedCandidates.forEach(({ candidate }) => {
        if (changed) return
        const nextPlan = [...bestPlan]
        nextPlan[index] = candidate
        const nextTotals = sumNutrition(nextPlan.map((item) => item.nutrition))
        const nextScore = scorePlan(nextTotals, targets, new Set(nextPlan.map((item) => item.id)).size, countHighCarbMeals(nextPlan, availableFoods))
        if (nextScore + 8 < bestScore) {
          bestPlan = nextPlan
          bestTotals = nextTotals
          bestScore = nextScore
          changed = true
        }
      })
    })

    if (!changed) break
  }

  return bestPlan
}

function scalePlanToTargets(
  plan: Array<Recipe & { nutrition: Nutrition }>,
  sequence: Array<Recipe["mealType"]>,
  targets: Nutrition,
  availableFoods: Food[],
  mealsPerDay: Profile["mealsPerDay"],
) {
  let scaledPlan = plan.map((recipe) => scaleMeal(recipe, 1))

  for (let pass = 0; pass < 3; pass += 1) {
    const nextPlan: ComputedMeal[] = []
    let consumed: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 }

    scaledPlan.forEach((meal, index) => {
      const mealsLeft = scaledPlan.length - index
      const remaining = {
        calories: Math.max(0, targets.calories - consumed.calories),
        protein: Math.max(0, targets.protein - consumed.protein),
        carbs: Math.max(0, targets.carbs - consumed.carbs),
        fat: Math.max(0, targets.fat - consumed.fat),
      }

      const perMealCalories = remaining.calories / Math.max(1, mealsLeft)
      const perMealProtein = remaining.protein / Math.max(1, mealsLeft)
      const perMealCarbs = remaining.carbs / Math.max(1, mealsLeft)
      const perMealFat = remaining.fat / Math.max(1, mealsLeft)
      const calorieRatio = meal.nutrition.calories > 0 ? perMealCalories / meal.nutrition.calories : 1
      const proteinRatio = meal.nutrition.protein > 0 ? perMealProtein / meal.nutrition.protein : 1
      const carbCap = meal.nutrition.carbs > 0 ? perMealCarbs / meal.nutrition.carbs : 1.3
      const fatCap = meal.nutrition.fat > 0 ? perMealFat / meal.nutrition.fat : 1.25
      const highTargetMode = targets.calories >= 3000 || mealsPerDay <= 3
      const typeAdjustment = sequence[index] === "snack" ? 0.92 : sequence[index] === "dinner" ? 1.08 : sequence[index] === "lunch" ? 1.04 : 1

      let multiplier =
        calorieRatio * (highTargetMode ? 0.5 : 0.4) +
        proteinRatio * (highTargetMode ? 0.33 : 0.42) +
        clamp(carbCap, 0.72, 1.22) * 0.08 +
        clamp(fatCap, 0.72, 1.16) * 0.06
      multiplier *= typeAdjustment

      if (highTargetMode && meal.nutrition.calories >= perMealCalories * 0.82) {
        multiplier *= 1.06
      }

      if (remaining.protein > 18 && isProteinForwardRecipe(meal, availableFoods)) {
        multiplier *= 1.08
      }

      if (remaining.protein > 16 && isLeanProteinRecipe(meal, availableFoods)) {
        multiplier *= 1.04
      }

      if (!highTargetMode && meal.nutrition.carbs > meal.nutrition.protein && remaining.protein > 12) {
        multiplier *= 0.92
      }

      if (Math.max(0, remaining.fat) < meal.nutrition.fat && targets.protein >= Math.max(140, targets.calories * 0.06)) {
        multiplier *= 0.94
      }

      if (!highTargetMode && remaining.carbs <= 0 && meal.nutrition.carbs > 0) {
        multiplier = Math.min(multiplier, 0.9)
      }

      const minScale = highTargetMode ? (sequence[index] === "snack" ? 0.9 : 0.98) : 0.78
      const maxScale = highTargetMode ? (sequence[index] === "snack" ? 1.65 : 2.25) : 1.75
      multiplier = clamp(multiplier, minScale, maxScale)

      const scaledMeal = scaleMeal(plan[index], multiplier)
      nextPlan.push(scaledMeal)
      consumed = sumNutrition(nextPlan.map((item) => item.nutrition))
    })

    scaledPlan = nextPlan
  }

  return scaledPlan
}

function rebalanceScaledPlan(
  scaledPlan: ComputedMeal[],
  basePlan: Array<Recipe & { nutrition: Nutrition }>,
  targets: Nutrition,
  availableFoods: Food[],
  mealsPerDay: Profile["mealsPerDay"],
) {
  let workingPlan = [...scaledPlan]
  let workingTotals = sumNutrition(workingPlan.map((item) => item.nutrition))
  let workingScore = scorePlan(workingTotals, targets, new Set(workingPlan.map((item) => item.id)).size, countHighCarbMeals(workingPlan, availableFoods))

  for (let pass = 0; pass < 18; pass += 1) {
    const caloriesLow = workingTotals.calories < targets.calories - 120
    const caloriesHigh = workingTotals.calories > targets.calories + 120
    if (!caloriesLow && !caloriesHigh) break

    const rankedIndexes = workingPlan
      .map((meal, index) => ({ index, density: proteinDensity(meal.nutrition), carbs: meal.nutrition.carbs, calories: meal.nutrition.calories }))
      .sort((a, b) => {
        if (caloriesLow) {
          if (b.calories !== a.calories) return b.calories - a.calories
          if (b.density !== a.density) return b.density - a.density
          return a.carbs - b.carbs
        }
        if (a.carbs !== b.carbs) return a.carbs - b.carbs
        return b.density - a.density
      })

    let changed = false

    rankedIndexes.forEach(({ index }) => {
      if (changed) return
      const currentMeal = workingPlan[index]
      const highTargetMode = targets.calories >= 3000 || mealsPerDay <= 3
      const step = caloriesLow ? (highTargetMode ? 0.14 : 0.08) : -0.08
      const maxScale = highTargetMode ? ((basePlan[index].mealType === "snack") ? 1.7 : 2.35) : 1.8
      const nextMultiplier = clamp(currentMeal.servingMultiplier + step, 0.75, maxScale)
      if (nextMultiplier === currentMeal.servingMultiplier) return

      const nextPlan = [...workingPlan]
      nextPlan[index] = scaleMeal(basePlan[index], nextMultiplier)
      const nextTotals = sumNutrition(nextPlan.map((item) => item.nutrition))
      const nextScore = scorePlan(nextTotals, targets, new Set(nextPlan.map((item) => item.id)).size, countHighCarbMeals(nextPlan, availableFoods))

      if (nextScore <= workingScore || Math.abs(targets.calories - nextTotals.calories) < Math.abs(targets.calories - workingTotals.calories)) {
        workingPlan = nextPlan
        workingTotals = nextTotals
        workingScore = nextScore
        changed = true
      }
    })

    if (!changed) break
  }

  return workingPlan
}

function scaleMeal(recipe: Recipe & { nutrition: Nutrition }, multiplier: number): ComputedMeal {
  return {
    ...recipe,
    name: cleanRecipeName(recipe.name),
    servingMultiplier: Number(multiplier.toFixed(2)),
    ingredients: recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      grams: Math.round(ingredient.grams * multiplier),
    })),
    nutrition: roundNutrition({
      calories: recipe.nutrition.calories * multiplier,
      protein: recipe.nutrition.protein * multiplier,
      carbs: recipe.nutrition.carbs * multiplier,
      fat: recipe.nutrition.fat * multiplier,
    }),
  }
}
function scaleComputedMealFromIngredients(meal: ComputedMeal, availableFoods: Food[]): ComputedMeal {
  const nutrition = roundNutrition(
    meal.ingredients.reduce(
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
    ),
  )

  return {
    ...meal,
    nutrition,
  }
}

function repairProteinAndMacroFloor(
  plan: ComputedMeal[],
  sequence: Array<Recipe["mealType"]>,
  recipesByType: Record<Recipe["mealType"], Recipe[]>,
  targets: Nutrition,
  availableFoods: Food[],
) {
  let workingPlan = [...plan]
  let workingTotals = sumNutrition(workingPlan.map((meal) => meal.nutrition))

  for (let pass = 0; pass < 6; pass += 1) {
    const proteinShortfall = Math.max(0, targets.protein * 0.95 - workingTotals.protein)
    const carbOvershoot = Math.max(0, workingTotals.carbs - targets.carbs)
    const fatOvershoot = Math.max(0, workingTotals.fat - targets.fat)
    if (proteinShortfall <= 0 && carbOvershoot <= 12 && fatOvershoot <= 10) break

    let bestPlan = workingPlan
    let bestScore = scorePlan(workingTotals, targets, new Set(workingPlan.map((meal) => meal.id)).size, countHighCarbMeals(workingPlan, availableFoods))

    workingPlan.forEach((meal, index) => {
      const pool = (recipesByType[sequence[index]].length ? recipesByType[sequence[index]] : Object.values(recipesByType).flat())
        .map((recipe) => ({ ...recipe, nutrition: getRecipeNutrition(recipe, availableFoods) }))
        .filter((recipe) => recipe.id !== meal.id)

      pool.forEach((candidate) => {
        const baseCalories = Math.max(1, candidate.nutrition.calories)
        const targetCalories = Math.max(1, meal.nutrition.calories)
        const multiplier = clamp(targetCalories / baseCalories, 0.8, 1.45)
        const scaledCandidate = scaleMeal(candidate, multiplier)
        const nextPlan = workingPlan.map((entry, idx) => (idx === index ? scaledCandidate : entry))
        const nextTotals = sumNutrition(nextPlan.map((entry) => entry.nutrition))
        const nextScore = scorePlan(nextTotals, targets, new Set(nextPlan.map((entry) => entry.id)).size, countHighCarbMeals(nextPlan, availableFoods))
        if (nextScore < bestScore) {
          bestPlan = nextPlan
          bestScore = nextScore
        }
      })
    })

    if (bestPlan === workingPlan) break
    workingPlan = bestPlan
    workingTotals = sumNutrition(workingPlan.map((meal) => meal.nutrition))
  }

  return workingPlan
}

function finalCalorieAdjustmentPass(plan: ComputedMeal[], targets: Nutrition, availableFoods: Food[]) {
  let workingPlan = [...plan]
  let totals = sumNutrition(workingPlan.map((meal) => meal.nutrition))

  const candidateMatchers = [
    /olive oil|oil|butter|peanut butter|almond butter/,
    /rice|pasta|noodle|oats|potato|bagel|bread|wrap|tortilla|granola/,
  ]

  for (let pass = 0; pass < 16; pass += 1) {
    const diff = targets.calories - totals.calories
    const tolerance = Math.max(30, Math.round(targets.calories * 0.0125))
    if (Math.abs(diff) <= tolerance) break

    let bestPlan = workingPlan
    let bestDelta = Math.abs(diff)

    workingPlan.forEach((meal, mealIndex) => {
      meal.ingredients.forEach((ingredient, ingredientIndex) => {
        const food = availableFoods.find((entry) => entry.id === ingredient.foodId)
        if (!food) return
        const name = food.name.toLowerCase()
        const candidateType = candidateMatchers.findIndex((pattern) => pattern.test(name))
        if (candidateType === -1) return

        const step = candidateType === 0 ? 3 : 8
        const direction = diff > 0 ? 1 : -1
        const nextGrams = ingredient.grams + step * direction
        if (nextGrams < 0 || (direction < 0 && nextGrams < Math.max(10, ingredient.grams * 0.55))) return

        const nextMeal = {
          ...meal,
          ingredients: meal.ingredients.map((entry, idx) => (idx === ingredientIndex ? { ...entry, grams: Math.round(nextGrams) } : entry)),
        }
        const recalculatedMeal = scaleComputedMealFromIngredients(nextMeal, availableFoods)
        const nextPlan = workingPlan.map((entry, idx) => (idx === mealIndex ? recalculatedMeal : entry))
        const nextTotals = sumNutrition(nextPlan.map((entry) => entry.nutrition))
        const nextDelta = Math.abs(targets.calories - nextTotals.calories)

        if (nextDelta < bestDelta) {
          bestPlan = nextPlan
          bestDelta = nextDelta
        }
      })
    })

    if (bestPlan === workingPlan) break
    workingPlan = bestPlan
    totals = sumNutrition(workingPlan.map((meal) => meal.nutrition))
  }

  return workingPlan
}



function finalizeCandidatePlan(
  basePlan: Array<Recipe & { nutrition: Nutrition }>,
  sequence: Array<Recipe["mealType"]>,
  recipesByType: Record<Recipe["mealType"], Recipe[]>,
  targets: Nutrition,
  availableFoods: Food[],
  mealsPerDay: Profile["mealsPerDay"],
) {
  const calorieFocusedPlan = improvePlanSelections(basePlan, sequence, recipesByType, {
    ...targets,
    protein: Math.max(0, targets.protein * 0.92),
    carbs: targets.carbs,
    fat: targets.fat,
  }, availableFoods)
  const improvedPlan = improvePlanSelections(calorieFocusedPlan, sequence, recipesByType, targets, availableFoods)
  const macroPrioritizedPlan = prioritizeProteinAndCarbBalance(improvedPlan, sequence, recipesByType, targets, availableFoods)
  const initiallyScaledPlan = scalePlanToTargets(macroPrioritizedPlan, sequence, targets, availableFoods, mealsPerDay)
  const rebalancedPlan = rebalanceScaledPlan(initiallyScaledPlan, macroPrioritizedPlan, targets, availableFoods, mealsPerDay)
  const macroRepairedPlan = repairProteinAndMacroFloor(rebalancedPlan, sequence, recipesByType, targets, availableFoods)
  const scaledPlan = finalCalorieAdjustmentPass(macroRepairedPlan, targets, availableFoods)
  const totals = sumNutrition(scaledPlan.map((recipe) => recipe.nutrition))
  return { plan: scaledPlan, totals }
}

function hardRepairComputedPlan(
  plan: ComputedMeal[],
  sequence: Array<Recipe["mealType"]>,
  recipesByType: Record<Recipe["mealType"], Recipe[]>,
  targets: Nutrition,
  availableFoods: Food[],
  mealsPerDay: Profile["mealsPerDay"],
) {
  let workingPlan = [...plan]
  let workingTotals = sumNutrition(workingPlan.map((item) => item.nutrition))
  let workingPenalty = validationPenalty(workingTotals, targets)
  const globalPool = Object.values(recipesByType)
    .flat()
    .map((recipe) => ({ ...recipe, nutrition: getRecipeNutrition(recipe, availableFoods) }))

  for (let pass = 0; pass < 10; pass += 1) {
    const validation = validatePlanTotals(workingTotals, targets)
    if (validation.valid) break

    let bestPlan = workingPlan
    let bestPenalty = workingPenalty

    workingPlan.forEach((meal, index) => {
      const issueProtein = workingTotals.protein < targets.protein * 0.95
      const issueCaloriesLow = workingTotals.calories < targets.calories - validation.calorieTolerance
      const targetMealCalories =
        meal.nutrition.calories +
        (issueCaloriesLow ? Math.min(220, targets.calories - workingTotals.calories) / Math.max(1, workingPlan.length) : 0)

      const pool = globalPool
        .filter((candidate) => candidate.id !== meal.id)
        .sort((a, b) => {
          const scoreA =
            Math.abs(a.nutrition.calories - targetMealCalories) +
            (issueProtein ? -a.nutrition.protein * 6 : 0) +
            (workingTotals.carbs > targets.carbs ? a.nutrition.carbs * 3 : 0) +
            (workingTotals.fat > targets.fat ? a.nutrition.fat * 3 : 0)
          const scoreB =
            Math.abs(b.nutrition.calories - targetMealCalories) +
            (issueProtein ? -b.nutrition.protein * 6 : 0) +
            (workingTotals.carbs > targets.carbs ? b.nutrition.carbs * 3 : 0) +
            (workingTotals.fat > targets.fat ? b.nutrition.fat * 3 : 0)
          return scoreA - scoreB
        })
        .slice(0, 12)

      pool.forEach((candidateRecipe) => {
        const preferredCalories =
          issueProtein && isProteinForwardRecipe(candidateRecipe, availableFoods)
            ? targetMealCalories + Math.max(40, (targets.protein * 0.95 - workingTotals.protein) * 2.5)
            : targetMealCalories

        const baseCalories = Math.max(1, candidateRecipe.nutrition.calories)
        const maxScale =
          targets.calories >= 4200 ? 2.8 : mealsPerDay <= 3 || targets.calories >= 3000 ? 2.35 : 1.7
        const minScale = mealsPerDay <= 3 ? 0.85 : 0.78
        const multiplier = clamp(preferredCalories / baseCalories, minScale, maxScale)
        const candidateMeal = scaleMeal(candidateRecipe, multiplier)
        const nextPlan = workingPlan.map((entry, idx) => (idx === index ? candidateMeal : entry))
        const nextTotals = sumNutrition(nextPlan.map((entry) => entry.nutrition))
        const nextPenalty = validationPenalty(nextTotals, targets)

        if (nextPenalty < bestPenalty) {
          bestPlan = nextPlan
          bestPenalty = nextPenalty
        }
      })
    })

    if (bestPlan === workingPlan) break
    workingPlan = finalCalorieAdjustmentPass(bestPlan, targets, availableFoods)
    workingTotals = sumNutrition(workingPlan.map((item) => item.nutrition))
    workingPenalty = validationPenalty(workingTotals, targets)
  }

  return { plan: workingPlan, totals: sumNutrition(workingPlan.map((item) => item.nutrition)) }
}

function repairPlanUntilValid(
  candidatePlans: Array<Array<Recipe & { nutrition: Nutrition }>>,
  sequence: Array<Recipe["mealType"]>,
  recipesByType: Record<Recipe["mealType"], Recipe[]>,
  targets: Nutrition,
  availableFoods: Food[],
  mealsPerDay: Profile["mealsPerDay"],
) {
  const rankedBases = candidatePlans
    .slice()
    .sort((a, b) => {
      const totalA = sumNutrition(a.map((item) => item.nutrition))
      const totalB = sumNutrition(b.map((item) => item.nutrition))
      return (
        scorePlan(totalA, targets, new Set(a.map((item) => item.id)).size, countHighCarbMeals(a, availableFoods)) -
        scorePlan(totalB, targets, new Set(b.map((item) => item.id)).size, countHighCarbMeals(b, availableFoods))
      )
    })
    .slice(0, 12)

  let bestResult = finalizeCandidatePlan(rankedBases[0] || [], sequence, recipesByType, targets, availableFoods, mealsPerDay)
  bestResult = hardRepairComputedPlan(bestResult.plan, sequence, recipesByType, targets, availableFoods, mealsPerDay)
  let bestValidationPenalty = validationPenalty(bestResult.totals, targets)
  let bestScore = scorePlan(
    bestResult.totals,
    targets,
    new Set(bestResult.plan.map((item) => item.id)).size,
    countHighCarbMeals(bestResult.plan, availableFoods),
  )

  for (const candidate of rankedBases) {
    let workingBase = candidate

    for (let attempt = 0; attempt < 6; attempt += 1) {
      let result = finalizeCandidatePlan(workingBase, sequence, recipesByType, targets, availableFoods, mealsPerDay)
      result = hardRepairComputedPlan(result.plan, sequence, recipesByType, targets, availableFoods, mealsPerDay)
      const validation = validatePlanTotals(result.totals, targets)
      const resultValidationPenalty = validationPenalty(result.totals, targets)
      const resultScore = scorePlan(
        result.totals,
        targets,
        new Set(result.plan.map((item) => item.id)).size,
        countHighCarbMeals(result.plan, availableFoods),
      )

      if (
        resultValidationPenalty < bestValidationPenalty ||
        (resultValidationPenalty === bestValidationPenalty && resultScore < bestScore)
      ) {
        bestResult = result
        bestValidationPenalty = resultValidationPenalty
        bestScore = resultScore
      }

      if (validation.valid) {
        return result
      }

      const repairedBase = result.plan.map((meal, index) => {
        const pool = Object.values(recipesByType)
          .flat()
          .map((recipe) => ({ ...recipe, nutrition: getRecipeNutrition(recipe, availableFoods) }))
          .filter((recipe) => recipe.id !== meal.id)

        let bestReplacement = { ...meal, nutrition: meal.nutrition }
        let bestReplacementScore = resultScore

        for (const candidateRecipe of pool) {
          const baseCalories = Math.max(1, candidateRecipe.nutrition.calories)
          const targetCalories = Math.max(1, meal.nutrition.calories)
          const multiplier = clamp(
            targetCalories / baseCalories,
            0.78,
            targets.calories >= 4200 ? 2.6 : mealsPerDay <= 3 || targets.calories >= 3000 ? 2.05 : 1.45,
          )
          const candidateMeal = scaleMeal(candidateRecipe, multiplier)
          const nextPlan = result.plan.map((entry, idx) => (idx === index ? candidateMeal : entry))
          const nextTotals = sumNutrition(nextPlan.map((entry) => entry.nutrition))
          const nextScore =
            scorePlan(
              nextTotals,
              targets,
              new Set(nextPlan.map((entry) => entry.id)).size,
              countHighCarbMeals(nextPlan, availableFoods),
            ) +
            validationPenalty(nextTotals, targets) * 2

          if (nextScore < bestReplacementScore) {
            bestReplacement = { ...candidateRecipe, nutrition: candidateRecipe.nutrition }
            bestReplacementScore = nextScore
          }
        }

        return bestReplacement
      })

      workingBase = repairedBase
    }
  }

  return bestResult
}

export function buildMealPlan(profile: Profile, plannerData?: { foods: Food[]; recipes: Recipe[] }): MealPlanResult {
  const supportedPreference: DietaryPreference[] = ["omnivore", "vegetarian", "pescatarian", "vegan"]
  const normalizedProfile = {
    ...profile,
    allergies: profile.allergies.map((item) => item.toLowerCase().trim()).filter(Boolean),
    dislikedFoods: profile.dislikedFoods.map((item) => item.toLowerCase().trim()).filter(Boolean),
    dietaryPreference: supportedPreference.includes(profile.dietaryPreference) ? profile.dietaryPreference : "omnivore",
    planMode: profile.planMode || "balanced",
  }

  const availableFoods = plannerData?.foods?.length ? plannerData.foods : foods
  const availableRecipes = (plannerData?.recipes?.length ? plannerData.recipes : recipes).map((recipe) => ({
    ...recipe,
    name: cleanRecipeName(recipe.name),
  }))
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

  let candidatePlans: Array<Array<Recipe & { nutrition: Nutrition }>> = [[]]

  sequence.forEach((type, index) => {
    const nextCandidates: Array<Array<Recipe & { nutrition: Nutrition }>> = []

    candidatePlans.forEach((partialPlan) => {
      const pool = recipesByType[type].length ? recipesByType[type] : workingRecipes
      const usedIds = new Set(partialPlan.map((item) => item.id))
      const consumedTotals = sumNutrition(partialPlan.map((item) => item.nutrition))
      const mealsLeft = sequence.length - index
      const remaining = {
        calories: Math.max(0, (targets.calories - consumedTotals.calories) / Math.max(1, mealsLeft)),
        protein: Math.max(0, (targets.protein - consumedTotals.protein) / Math.max(1, mealsLeft)),
        carbs: Math.max(0, (targets.carbs - consumedTotals.carbs) / Math.max(1, mealsLeft)),
        fat: Math.max(0, (targets.fat - consumedTotals.fat) / Math.max(1, mealsLeft)),
      }

      const highCarbMealsUsed = countHighCarbMeals(partialPlan, availableFoods)
      const ranked = rankRecipesForRemaining(pool, remaining, usedIds, availableFoods, highCarbMealsUsed, targets, normalizedProfile.mealsPerDay, normalizedProfile)
      const topChoices = ranked.slice(0, Math.min(6, ranked.length))

      topChoices.forEach(({ recipe }) => {
        nextCandidates.push([...partialPlan, recipe])
      })
    })

    candidatePlans = nextCandidates
      .sort((a, b) => {
        const totalA = sumNutrition(a.map((item) => item.nutrition))
        const totalB = sumNutrition(b.map((item) => item.nutrition))
        return scorePlan(totalA, targets, new Set(a.map((item) => item.id)).size, countHighCarbMeals(a, availableFoods)) - scorePlan(totalB, targets, new Set(b.map((item) => item.id)).size, countHighCarbMeals(b, availableFoods))
      })
      .slice(0, 18)
  })

  const { plan: finalPlan, totals } = repairPlanUntilValid(
    candidatePlans,
    sequence,
    recipesByType,
    targets,
    availableFoods,
    normalizedProfile.mealsPerDay,
  )

  return { plan: finalPlan, totals, targets, profile: normalizedProfile }
}
