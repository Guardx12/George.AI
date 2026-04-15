import foodsData from "./data/foods.json"
import recipesData from "./data/recipes.json"

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very-active"
export type Goal = "lose-fat" | "recomp" | "gain-muscle"
export type Sex = "male" | "female"
export type DietaryPreference = "omnivore" | "vegetarian" | "pescatarian" | "vegan"
export type PlanMode = "balanced" | "higher-carb" | "lower-carb"

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
  if (profile.planMode === "higher-carb") {
    return {
      proteinPerKg: profile.goal === "gain-muscle" ? 2.05 : profile.goal === "lose-fat" ? 1.95 : 1.85,
      fatRatio: 0.2,
    }
  }

  if (profile.planMode === "lower-carb") {
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

function scoreNutritionFit(actual: Nutrition, target: Nutrition) {
  const delta = subtractNutrition(actual, target)
  const caloriePenalty = Math.abs(delta.calories) * 0.65
  const proteinPenalty = delta.protein < 0 ? Math.abs(delta.protein) * 14 : Math.abs(delta.protein) * 3.2
  const carbPenalty = delta.carbs > 0 ? delta.carbs * 8.5 : Math.abs(delta.carbs) * 2.2
  const fatPenalty = delta.fat > 0 ? delta.fat * 4.8 : Math.abs(delta.fat) * 2.8

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

function scorePlan(totals: Nutrition, targets: Nutrition, uniqueRecipeCount: number, highCarbMeals = 0) {
  const proteinGap = Math.max(0, targets.protein - totals.protein)
  const carbOvershoot = Math.max(0, totals.carbs - targets.carbs)
  const hardConstraintPenalty = Math.max(0, highCarbMeals - 2) * 260

  return scoreNutritionFit(totals, targets) + proteinGap * 8 + carbOvershoot * 4 + hardConstraintPenalty - uniqueRecipeCount * 10
}


function getRecipeFoodNames(recipe: Recipe, availableFoods: Food[]) {
  return recipe.ingredients
    .map((ingredient) => availableFoods.find((entry) => entry.id === ingredient.foodId)?.name.toLowerCase() || "")
    .filter(Boolean)
}

function isHighCarbRecipe(recipe: Recipe, availableFoods: Food[]) {
  const text = `${recipe.name} ${getRecipeFoodNames(recipe, availableFoods).join(" ")}`.toLowerCase()
  return /(\brice\b|pasta|noodles?|wraps?)/.test(text)
}

function isProteinForwardRecipe(recipe: Recipe & { nutrition?: Nutrition }, availableFoods: Food[]) {
  const nutrition = recipe.nutrition || getRecipeNutrition(recipe, availableFoods)
  const names = getRecipeFoodNames(recipe, availableFoods).join(" ")
  return nutrition.protein >= 32 || proteinDensity(nutrition) >= 0.12 || /(chicken|turkey|beef|steak|mince|tuna|salmon|prawn|shrimp|egg|whey|skyr|greek yogurt|greek yoghurt|quark|cottage cheese)/.test(`${recipe.name.toLowerCase()} ${names}`)
}

function countHighCarbMeals(plan: Array<{ id: string; name: string; ingredients: RecipeIngredient[]; nutrition: Nutrition }>, availableFoods: Food[]) {
  return plan.filter((recipe) => isHighCarbRecipe(recipe as Recipe, availableFoods)).length
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
) {
  return pool
    .map((recipe) => {
      const nutrition = getRecipeNutrition(recipe, availableFoods)
      const proteinForward = isProteinForwardRecipe({ ...recipe, nutrition }, availableFoods)
      const highCarb = isHighCarbRecipe(recipe, availableFoods)
      const proteinGap = Math.max(0, remaining.protein - nutrition.protein)
      const carbOvershoot = Math.max(0, nutrition.carbs - remaining.carbs)
      const score =
        scoreNutritionFit(nutrition, remaining) +
        proteinGap * 6 +
        carbOvershoot * 8 +
        Math.max(0, nutrition.fat - remaining.fat) * 3.5 +
        (usedIds.has(recipe.id) ? 55 : 0) +
        (highCarb && highCarbMealsUsed >= 2 ? 240 : 0) +
        (highCarb ? Math.max(0, nutrition.carbs - nutrition.protein) * 1.2 : 0) -
        proteinDensity(nutrition) * 260 -
        (proteinForward && remaining.protein > 18 ? 75 : 0) +
        (remaining.protein > 22 && carbDensity(nutrition) > 0.22 ? 28 : 0)

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
          const highCarbPenalty = isHighCarbRecipe(candidate, availableFoods) ? 20 : 0
          const priority =
            (proteinShortfall > 0 ? proteinLift * 7 : 0) +
            (carbOvershoot > 0 ? carbDrop * 5 : 0) +
            (isProteinForwardRecipe(candidate, availableFoods) ? 18 : 0) -
            highCarbPenalty
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

      const calorieRatio = meal.nutrition.calories > 0 ? remaining.calories / Math.max(1, mealsLeft) / meal.nutrition.calories : 1
      const proteinRatio = meal.nutrition.protein > 0 ? remaining.protein / Math.max(1, mealsLeft) / meal.nutrition.protein : 1
      const carbCap = meal.nutrition.carbs > 0 ? remaining.carbs / Math.max(1, mealsLeft) / meal.nutrition.carbs : 1.2
      const fatCap = meal.nutrition.fat > 0 ? remaining.fat / Math.max(1, mealsLeft) / meal.nutrition.fat : 1.2
      const typeAdjustment = sequence[index] === "snack" ? 0.94 : sequence[index] === "dinner" ? 1.04 : 1

      const proteinPriority = remaining.protein > 0 ? 0.56 : 0.38
      let multiplier =
        proteinRatio * proteinPriority +
        calorieRatio * 0.24 +
        clamp(carbCap, 0.65, 1.12) * 0.14 +
        clamp(fatCap, 0.75, 1.15) * 0.06
      multiplier *= typeAdjustment

      if (remaining.protein > 18 && isProteinForwardRecipe(meal, availableFoods)) {
        multiplier *= 1.08
      }

      if (meal.nutrition.carbs > meal.nutrition.protein && remaining.protein > 12) {
        multiplier *= 0.94
      }

      if (remaining.carbs <= 0 && meal.nutrition.carbs > 0) {
        multiplier = Math.min(multiplier, 0.84)
      }

      multiplier = clamp(multiplier, 0.72, 1.6)

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
) {
  let workingPlan = [...scaledPlan]
  let workingTotals = sumNutrition(workingPlan.map((item) => item.nutrition))
  let workingScore = scorePlan(workingTotals, targets, new Set(workingPlan.map((item) => item.id)).size, countHighCarbMeals(workingPlan, availableFoods))

  for (let pass = 0; pass < 18; pass += 1) {
    const caloriesLow = workingTotals.calories < targets.calories - 120
    const caloriesHigh = workingTotals.calories > targets.calories + 120
    if (!caloriesLow && !caloriesHigh) break

    const rankedIndexes = workingPlan
      .map((meal, index) => ({ index, density: proteinDensity(meal.nutrition), carbs: meal.nutrition.carbs }))
      .sort((a, b) => {
        if (caloriesLow) {
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
      const step = caloriesLow ? 0.06 : -0.06
      const nextMultiplier = clamp(currentMeal.servingMultiplier + step, 0.75, 1.75)
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
      const ranked = rankRecipesForRemaining(pool, remaining, usedIds, availableFoods, highCarbMealsUsed)
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

  const basePlan =
    candidatePlans.sort((a, b) => {
      const totalA = sumNutrition(a.map((item) => item.nutrition))
      const totalB = sumNutrition(b.map((item) => item.nutrition))
      return scorePlan(totalA, targets, new Set(a.map((item) => item.id)).size) - scorePlan(totalB, targets, new Set(b.map((item) => item.id)).size)
    })[0] || []

  const improvedPlan = improvePlanSelections(basePlan, sequence, recipesByType, targets, availableFoods)
  const macroPrioritizedPlan = prioritizeProteinAndCarbBalance(improvedPlan, sequence, recipesByType, targets, availableFoods)
  const initiallyScaledPlan = scalePlanToTargets(macroPrioritizedPlan, sequence, targets, availableFoods)
  const scaledPlan = rebalanceScaledPlan(initiallyScaledPlan, macroPrioritizedPlan, targets, availableFoods)
  const totals = sumNutrition(scaledPlan.map((recipe) => recipe.nutrition))

  return { plan: scaledPlan, totals, targets, profile: normalizedProfile }
}
