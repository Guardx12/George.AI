
export type FoodTier = "performance" | "balanced" | "flexible"
export type FoodCategory = "protein" | "carb" | "fat" | "veg" | "fruit" | "sauce" | "dairy" | "treat" | "snack"

export type Ingredient = {
  ingredient_name: string
  category: FoodCategory
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  food_tier: FoodTier
}

export type RecipeRow = {
  meal_name: string
  ingredient: string
  grams: number
}

export type RecipeSummary = {
  meal_name: string
  rows: RecipeRow[]
  calories: number
  protein: number
  carbs: number
  fat: number
  tier_profile: FoodTier[]
}

export const GEORGE_INGREDIENTS: Ingredient[] = [
  {
    "ingredient_name": "chicken breast raw",
    "category": "protein",
    "calories_per_100g": 165.0,
    "protein_per_100g": 31.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 3.6,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "chicken thigh raw",
    "category": "protein",
    "calories_per_100g": 209.0,
    "protein_per_100g": 26.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 11.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "turkey breast",
    "category": "protein",
    "calories_per_100g": 135.0,
    "protein_per_100g": 30.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 1.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "lean beef mince 5 percent",
    "category": "protein",
    "calories_per_100g": 137.0,
    "protein_per_100g": 21.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 5.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "beef mince 10 percent",
    "category": "protein",
    "calories_per_100g": 176.0,
    "protein_per_100g": 20.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 10.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "steak sirloin",
    "category": "protein",
    "calories_per_100g": 271.0,
    "protein_per_100g": 25.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 19.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "pork loin",
    "category": "protein",
    "calories_per_100g": 242.0,
    "protein_per_100g": 27.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 14.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "bacon",
    "category": "protein",
    "calories_per_100g": 541.0,
    "protein_per_100g": 37.0,
    "carbs_per_100g": 1.0,
    "fat_per_100g": 42.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "salmon",
    "category": "protein",
    "calories_per_100g": 208.0,
    "protein_per_100g": 20.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 13.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "tuna canned in water",
    "category": "protein",
    "calories_per_100g": 132.0,
    "protein_per_100g": 28.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 1.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "cod",
    "category": "protein",
    "calories_per_100g": 82.0,
    "protein_per_100g": 18.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 1.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "prawns",
    "category": "protein",
    "calories_per_100g": 99.0,
    "protein_per_100g": 24.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 0.3,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "eggs whole",
    "category": "protein",
    "calories_per_100g": 155.0,
    "protein_per_100g": 13.0,
    "carbs_per_100g": 1.0,
    "fat_per_100g": 11.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "egg whites",
    "category": "protein",
    "calories_per_100g": 52.0,
    "protein_per_100g": 11.0,
    "carbs_per_100g": 1.0,
    "fat_per_100g": 0.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "greek yogurt 0 percent",
    "category": "protein",
    "calories_per_100g": 59.0,
    "protein_per_100g": 10.0,
    "carbs_per_100g": 3.0,
    "fat_per_100g": 0.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "greek yogurt full fat",
    "category": "protein",
    "calories_per_100g": 97.0,
    "protein_per_100g": 9.0,
    "carbs_per_100g": 4.0,
    "fat_per_100g": 5.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "cottage cheese",
    "category": "protein",
    "calories_per_100g": 98.0,
    "protein_per_100g": 11.0,
    "carbs_per_100g": 3.0,
    "fat_per_100g": 4.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "whey protein powder",
    "category": "protein",
    "calories_per_100g": 400.0,
    "protein_per_100g": 80.0,
    "carbs_per_100g": 8.0,
    "fat_per_100g": 5.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "plant protein powder",
    "category": "protein",
    "calories_per_100g": 380.0,
    "protein_per_100g": 75.0,
    "carbs_per_100g": 10.0,
    "fat_per_100g": 6.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "tofu",
    "category": "protein",
    "calories_per_100g": 76.0,
    "protein_per_100g": 8.0,
    "carbs_per_100g": 2.0,
    "fat_per_100g": 4.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "lentils cooked",
    "category": "protein",
    "calories_per_100g": 116.0,
    "protein_per_100g": 9.0,
    "carbs_per_100g": 20.0,
    "fat_per_100g": 0.4,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "chickpeas",
    "category": "protein",
    "calories_per_100g": 164.0,
    "protein_per_100g": 9.0,
    "carbs_per_100g": 27.0,
    "fat_per_100g": 2.6,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "kidney beans",
    "category": "protein",
    "calories_per_100g": 127.0,
    "protein_per_100g": 9.0,
    "carbs_per_100g": 23.0,
    "fat_per_100g": 0.5,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "black beans",
    "category": "protein",
    "calories_per_100g": 132.0,
    "protein_per_100g": 9.0,
    "carbs_per_100g": 24.0,
    "fat_per_100g": 0.5,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "baked beans",
    "category": "protein",
    "calories_per_100g": 78.0,
    "protein_per_100g": 5.0,
    "carbs_per_100g": 14.0,
    "fat_per_100g": 0.5,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "ham",
    "category": "protein",
    "calories_per_100g": 145.0,
    "protein_per_100g": 21.0,
    "carbs_per_100g": 1.0,
    "fat_per_100g": 5.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "duck breast",
    "category": "protein",
    "calories_per_100g": 337.0,
    "protein_per_100g": 19.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 28.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "lamb mince",
    "category": "protein",
    "calories_per_100g": 282.0,
    "protein_per_100g": 17.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 23.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "lean pork mince",
    "category": "protein",
    "calories_per_100g": 176.0,
    "protein_per_100g": 21.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 10.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "chicken sausages",
    "category": "protein",
    "calories_per_100g": 200.0,
    "protein_per_100g": 20.0,
    "carbs_per_100g": 2.0,
    "fat_per_100g": 12.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "beef burger patty",
    "category": "protein",
    "calories_per_100g": 250.0,
    "protein_per_100g": 20.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 20.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "turkey bacon",
    "category": "protein",
    "calories_per_100g": 217.0,
    "protein_per_100g": 29.0,
    "carbs_per_100g": 1.0,
    "fat_per_100g": 10.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "smoked salmon",
    "category": "protein",
    "calories_per_100g": 117.0,
    "protein_per_100g": 18.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 4.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "mackerel",
    "category": "protein",
    "calories_per_100g": 305.0,
    "protein_per_100g": 19.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 25.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "sardines",
    "category": "protein",
    "calories_per_100g": 208.0,
    "protein_per_100g": 25.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 11.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "halloumi",
    "category": "protein",
    "calories_per_100g": 321.0,
    "protein_per_100g": 22.0,
    "carbs_per_100g": 2.0,
    "fat_per_100g": 25.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "feta cheese",
    "category": "protein",
    "calories_per_100g": 264.0,
    "protein_per_100g": 14.0,
    "carbs_per_100g": 4.0,
    "fat_per_100g": 21.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "ricotta",
    "category": "protein",
    "calories_per_100g": 174.0,
    "protein_per_100g": 11.0,
    "carbs_per_100g": 3.0,
    "fat_per_100g": 13.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "falafel",
    "category": "protein",
    "calories_per_100g": 333.0,
    "protein_per_100g": 13.0,
    "carbs_per_100g": 31.0,
    "fat_per_100g": 17.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "tempeh",
    "category": "protein",
    "calories_per_100g": 193.0,
    "protein_per_100g": 19.0,
    "carbs_per_100g": 9.0,
    "fat_per_100g": 11.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "chicken nuggets",
    "category": "protein",
    "calories_per_100g": 296.0,
    "protein_per_100g": 15.0,
    "carbs_per_100g": 18.0,
    "fat_per_100g": 20.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "pepperoni",
    "category": "protein",
    "calories_per_100g": 494.0,
    "protein_per_100g": 23.0,
    "carbs_per_100g": 1.0,
    "fat_per_100g": 44.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "sausages pork",
    "category": "protein",
    "calories_per_100g": 301.0,
    "protein_per_100g": 12.0,
    "carbs_per_100g": 2.0,
    "fat_per_100g": 27.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "chicken liver",
    "category": "protein",
    "calories_per_100g": 167.0,
    "protein_per_100g": 24.0,
    "carbs_per_100g": 1.0,
    "fat_per_100g": 6.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "beef liver",
    "category": "protein",
    "calories_per_100g": 135.0,
    "protein_per_100g": 20.0,
    "carbs_per_100g": 4.0,
    "fat_per_100g": 4.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "venison",
    "category": "protein",
    "calories_per_100g": 158.0,
    "protein_per_100g": 30.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 3.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "white rice dry",
    "category": "carb",
    "calories_per_100g": 360.0,
    "protein_per_100g": 7.0,
    "carbs_per_100g": 78.0,
    "fat_per_100g": 0.6,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "basmati rice dry",
    "category": "carb",
    "calories_per_100g": 360.0,
    "protein_per_100g": 8.0,
    "carbs_per_100g": 77.0,
    "fat_per_100g": 0.6,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "jasmine rice dry",
    "category": "carb",
    "calories_per_100g": 360.0,
    "protein_per_100g": 7.0,
    "carbs_per_100g": 78.0,
    "fat_per_100g": 0.6,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "brown rice dry",
    "category": "carb",
    "calories_per_100g": 370.0,
    "protein_per_100g": 8.0,
    "carbs_per_100g": 77.0,
    "fat_per_100g": 2.7,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "pasta dry",
    "category": "carb",
    "calories_per_100g": 371.0,
    "protein_per_100g": 13.0,
    "carbs_per_100g": 75.0,
    "fat_per_100g": 1.5,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "spaghetti dry",
    "category": "carb",
    "calories_per_100g": 371.0,
    "protein_per_100g": 13.0,
    "carbs_per_100g": 75.0,
    "fat_per_100g": 1.5,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "penne pasta dry",
    "category": "carb",
    "calories_per_100g": 371.0,
    "protein_per_100g": 13.0,
    "carbs_per_100g": 75.0,
    "fat_per_100g": 1.5,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "lasagne sheets dry",
    "category": "carb",
    "calories_per_100g": 370.0,
    "protein_per_100g": 13.0,
    "carbs_per_100g": 75.0,
    "fat_per_100g": 1.5,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "noodles dry",
    "category": "carb",
    "calories_per_100g": 350.0,
    "protein_per_100g": 12.0,
    "carbs_per_100g": 70.0,
    "fat_per_100g": 2.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "egg noodles dry",
    "category": "carb",
    "calories_per_100g": 350.0,
    "protein_per_100g": 12.0,
    "carbs_per_100g": 70.0,
    "fat_per_100g": 2.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "udon noodles",
    "category": "carb",
    "calories_per_100g": 127.0,
    "protein_per_100g": 3.0,
    "carbs_per_100g": 25.0,
    "fat_per_100g": 0.2,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "couscous dry",
    "category": "carb",
    "calories_per_100g": 376.0,
    "protein_per_100g": 13.0,
    "carbs_per_100g": 77.0,
    "fat_per_100g": 1.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "quinoa dry",
    "category": "carb",
    "calories_per_100g": 368.0,
    "protein_per_100g": 14.0,
    "carbs_per_100g": 64.0,
    "fat_per_100g": 6.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "bulgur wheat",
    "category": "carb",
    "calories_per_100g": 83.0,
    "protein_per_100g": 3.0,
    "carbs_per_100g": 19.0,
    "fat_per_100g": 0.2,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "freekeh",
    "category": "carb",
    "calories_per_100g": 143.0,
    "protein_per_100g": 5.0,
    "carbs_per_100g": 25.0,
    "fat_per_100g": 1.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "oats",
    "category": "carb",
    "calories_per_100g": 389.0,
    "protein_per_100g": 17.0,
    "carbs_per_100g": 66.0,
    "fat_per_100g": 7.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "weetabix",
    "category": "carb",
    "calories_per_100g": 362.0,
    "protein_per_100g": 12.0,
    "carbs_per_100g": 69.0,
    "fat_per_100g": 2.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "cereal cornflakes",
    "category": "carb",
    "calories_per_100g": 375.0,
    "protein_per_100g": 8.0,
    "carbs_per_100g": 84.0,
    "fat_per_100g": 1.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "protein cereal",
    "category": "carb",
    "calories_per_100g": 380.0,
    "protein_per_100g": 25.0,
    "carbs_per_100g": 50.0,
    "fat_per_100g": 8.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "granola",
    "category": "carb",
    "calories_per_100g": 471.0,
    "protein_per_100g": 10.0,
    "carbs_per_100g": 64.0,
    "fat_per_100g": 20.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "wholemeal bread",
    "category": "carb",
    "calories_per_100g": 247.0,
    "protein_per_100g": 9.0,
    "carbs_per_100g": 41.0,
    "fat_per_100g": 4.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "white bread",
    "category": "carb",
    "calories_per_100g": 265.0,
    "protein_per_100g": 9.0,
    "carbs_per_100g": 49.0,
    "fat_per_100g": 3.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "wrap tortilla",
    "category": "carb",
    "calories_per_100g": 300.0,
    "protein_per_100g": 8.0,
    "carbs_per_100g": 50.0,
    "fat_per_100g": 8.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "wrap wholemeal",
    "category": "carb",
    "calories_per_100g": 290.0,
    "protein_per_100g": 9.0,
    "carbs_per_100g": 48.0,
    "fat_per_100g": 7.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "bagel",
    "category": "carb",
    "calories_per_100g": 250.0,
    "protein_per_100g": 10.0,
    "carbs_per_100g": 50.0,
    "fat_per_100g": 1.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "pitta bread",
    "category": "carb",
    "calories_per_100g": 275.0,
    "protein_per_100g": 9.0,
    "carbs_per_100g": 55.0,
    "fat_per_100g": 1.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "naan bread",
    "category": "carb",
    "calories_per_100g": 310.0,
    "protein_per_100g": 9.0,
    "carbs_per_100g": 50.0,
    "fat_per_100g": 7.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "croissant",
    "category": "carb",
    "calories_per_100g": 406.0,
    "protein_per_100g": 8.0,
    "carbs_per_100g": 45.0,
    "fat_per_100g": 21.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "rice cakes",
    "category": "carb",
    "calories_per_100g": 387.0,
    "protein_per_100g": 8.0,
    "carbs_per_100g": 81.0,
    "fat_per_100g": 3.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "crackers",
    "category": "carb",
    "calories_per_100g": 430.0,
    "protein_per_100g": 8.0,
    "carbs_per_100g": 70.0,
    "fat_per_100g": 12.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "flatbread",
    "category": "carb",
    "calories_per_100g": 260.0,
    "protein_per_100g": 8.0,
    "carbs_per_100g": 45.0,
    "fat_per_100g": 5.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "burger bun",
    "category": "carb",
    "calories_per_100g": 295.0,
    "protein_per_100g": 9.0,
    "carbs_per_100g": 50.0,
    "fat_per_100g": 6.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "brioche bun",
    "category": "carb",
    "calories_per_100g": 320.0,
    "protein_per_100g": 9.0,
    "carbs_per_100g": 50.0,
    "fat_per_100g": 10.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "rye bread",
    "category": "carb",
    "calories_per_100g": 259.0,
    "protein_per_100g": 9.0,
    "carbs_per_100g": 48.0,
    "fat_per_100g": 3.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "sourdough bread",
    "category": "carb",
    "calories_per_100g": 289.0,
    "protein_per_100g": 9.0,
    "carbs_per_100g": 54.0,
    "fat_per_100g": 2.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "gnocchi",
    "category": "carb",
    "calories_per_100g": 131.0,
    "protein_per_100g": 3.0,
    "carbs_per_100g": 28.0,
    "fat_per_100g": 0.1,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "protein pancake mix",
    "category": "carb",
    "calories_per_100g": 350.0,
    "protein_per_100g": 30.0,
    "carbs_per_100g": 40.0,
    "fat_per_100g": 6.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "pancakes",
    "category": "carb",
    "calories_per_100g": 227.0,
    "protein_per_100g": 6.0,
    "carbs_per_100g": 28.0,
    "fat_per_100g": 10.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "waffles",
    "category": "carb",
    "calories_per_100g": 291.0,
    "protein_per_100g": 7.0,
    "carbs_per_100g": 33.0,
    "fat_per_100g": 15.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "olive oil",
    "category": "fat",
    "calories_per_100g": 884.0,
    "protein_per_100g": 0.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 100.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "butter",
    "category": "fat",
    "calories_per_100g": 717.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 81.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "margarine",
    "category": "fat",
    "calories_per_100g": 717.0,
    "protein_per_100g": 0.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 80.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "avocado",
    "category": "fat",
    "calories_per_100g": 160.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 9.0,
    "fat_per_100g": 15.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "cheddar cheese",
    "category": "fat",
    "calories_per_100g": 402.0,
    "protein_per_100g": 25.0,
    "carbs_per_100g": 1.0,
    "fat_per_100g": 33.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "mozzarella",
    "category": "fat",
    "calories_per_100g": 280.0,
    "protein_per_100g": 28.0,
    "carbs_per_100g": 3.0,
    "fat_per_100g": 17.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "peanut butter",
    "category": "fat",
    "calories_per_100g": 588.0,
    "protein_per_100g": 25.0,
    "carbs_per_100g": 20.0,
    "fat_per_100g": 50.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "almonds",
    "category": "fat",
    "calories_per_100g": 579.0,
    "protein_per_100g": 21.0,
    "carbs_per_100g": 22.0,
    "fat_per_100g": 50.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "walnuts",
    "category": "fat",
    "calories_per_100g": 654.0,
    "protein_per_100g": 15.0,
    "carbs_per_100g": 14.0,
    "fat_per_100g": 65.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "mixed nuts",
    "category": "fat",
    "calories_per_100g": 607.0,
    "protein_per_100g": 20.0,
    "carbs_per_100g": 21.0,
    "fat_per_100g": 54.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "seeds mixed",
    "category": "fat",
    "calories_per_100g": 550.0,
    "protein_per_100g": 20.0,
    "carbs_per_100g": 20.0,
    "fat_per_100g": 45.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "sunflower oil",
    "category": "fat",
    "calories_per_100g": 884.0,
    "protein_per_100g": 0.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 100.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "vegetable oil",
    "category": "fat",
    "calories_per_100g": 884.0,
    "protein_per_100g": 0.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 100.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "coconut oil",
    "category": "fat",
    "calories_per_100g": 892.0,
    "protein_per_100g": 0.0,
    "carbs_per_100g": 0.0,
    "fat_per_100g": 100.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "cream cheese",
    "category": "fat",
    "calories_per_100g": 342.0,
    "protein_per_100g": 6.0,
    "carbs_per_100g": 4.0,
    "fat_per_100g": 34.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "double cream",
    "category": "fat",
    "calories_per_100g": 467.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 3.0,
    "fat_per_100g": 48.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "cashews",
    "category": "fat",
    "calories_per_100g": 553.0,
    "protein_per_100g": 18.0,
    "carbs_per_100g": 30.0,
    "fat_per_100g": 44.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "pistachios",
    "category": "fat",
    "calories_per_100g": 562.0,
    "protein_per_100g": 20.0,
    "carbs_per_100g": 28.0,
    "fat_per_100g": 45.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "broccoli",
    "category": "veg",
    "calories_per_100g": 34.0,
    "protein_per_100g": 3.0,
    "carbs_per_100g": 7.0,
    "fat_per_100g": 0.4,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "cauliflower",
    "category": "veg",
    "calories_per_100g": 25.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 5.0,
    "fat_per_100g": 0.3,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "carrots",
    "category": "veg",
    "calories_per_100g": 41.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 10.0,
    "fat_per_100g": 0.2,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "spinach",
    "category": "veg",
    "calories_per_100g": 23.0,
    "protein_per_100g": 3.0,
    "carbs_per_100g": 4.0,
    "fat_per_100g": 0.4,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "kale",
    "category": "veg",
    "calories_per_100g": 35.0,
    "protein_per_100g": 3.0,
    "carbs_per_100g": 7.0,
    "fat_per_100g": 1.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "bell peppers",
    "category": "veg",
    "calories_per_100g": 31.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 6.0,
    "fat_per_100g": 0.3,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "onion",
    "category": "veg",
    "calories_per_100g": 40.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 9.0,
    "fat_per_100g": 0.1,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "garlic",
    "category": "veg",
    "calories_per_100g": 149.0,
    "protein_per_100g": 6.0,
    "carbs_per_100g": 33.0,
    "fat_per_100g": 0.5,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "mushrooms",
    "category": "veg",
    "calories_per_100g": 22.0,
    "protein_per_100g": 3.0,
    "carbs_per_100g": 3.0,
    "fat_per_100g": 0.3,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "courgette",
    "category": "veg",
    "calories_per_100g": 17.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 3.0,
    "fat_per_100g": 0.3,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "aubergine",
    "category": "veg",
    "calories_per_100g": 25.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 6.0,
    "fat_per_100g": 0.2,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "green beans",
    "category": "veg",
    "calories_per_100g": 31.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 7.0,
    "fat_per_100g": 0.2,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "peas",
    "category": "veg",
    "calories_per_100g": 81.0,
    "protein_per_100g": 5.0,
    "carbs_per_100g": 14.0,
    "fat_per_100g": 0.4,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "sweetcorn",
    "category": "veg",
    "calories_per_100g": 96.0,
    "protein_per_100g": 3.0,
    "carbs_per_100g": 21.0,
    "fat_per_100g": 1.5,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "lettuce",
    "category": "veg",
    "calories_per_100g": 15.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 3.0,
    "fat_per_100g": 0.2,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "cucumber",
    "category": "veg",
    "calories_per_100g": 16.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 4.0,
    "fat_per_100g": 0.1,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "mixed vegetables",
    "category": "veg",
    "calories_per_100g": 50.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 10.0,
    "fat_per_100g": 0.5,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "asparagus",
    "category": "veg",
    "calories_per_100g": 20.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 4.0,
    "fat_per_100g": 0.1,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "beetroot",
    "category": "veg",
    "calories_per_100g": 43.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 10.0,
    "fat_per_100g": 0.2,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "brussels sprouts",
    "category": "veg",
    "calories_per_100g": 43.0,
    "protein_per_100g": 3.0,
    "carbs_per_100g": 9.0,
    "fat_per_100g": 0.3,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "cabbage",
    "category": "veg",
    "calories_per_100g": 25.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 6.0,
    "fat_per_100g": 0.1,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "leek",
    "category": "veg",
    "calories_per_100g": 61.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 14.0,
    "fat_per_100g": 0.3,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "rocket",
    "category": "veg",
    "calories_per_100g": 25.0,
    "protein_per_100g": 3.0,
    "carbs_per_100g": 4.0,
    "fat_per_100g": 0.7,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "turnip",
    "category": "veg",
    "calories_per_100g": 28.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 6.0,
    "fat_per_100g": 0.1,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "parsnips",
    "category": "veg",
    "calories_per_100g": 75.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 18.0,
    "fat_per_100g": 0.3,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "okra",
    "category": "veg",
    "calories_per_100g": 33.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 7.0,
    "fat_per_100g": 0.2,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "artichoke",
    "category": "veg",
    "calories_per_100g": 47.0,
    "protein_per_100g": 3.0,
    "carbs_per_100g": 11.0,
    "fat_per_100g": 0.2,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "zucchini noodles",
    "category": "veg",
    "calories_per_100g": 17.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 3.0,
    "fat_per_100g": 0.3,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "banana",
    "category": "fruit",
    "calories_per_100g": 89.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 23.0,
    "fat_per_100g": 0.3,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "apple",
    "category": "fruit",
    "calories_per_100g": 52.0,
    "protein_per_100g": 0.3,
    "carbs_per_100g": 14.0,
    "fat_per_100g": 0.2,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "orange",
    "category": "fruit",
    "calories_per_100g": 47.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 12.0,
    "fat_per_100g": 0.1,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "grapes",
    "category": "fruit",
    "calories_per_100g": 69.0,
    "protein_per_100g": 0.7,
    "carbs_per_100g": 18.0,
    "fat_per_100g": 0.2,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "strawberries",
    "category": "fruit",
    "calories_per_100g": 32.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 8.0,
    "fat_per_100g": 0.3,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "blueberries",
    "category": "fruit",
    "calories_per_100g": 57.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 14.0,
    "fat_per_100g": 0.3,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "raspberries",
    "category": "fruit",
    "calories_per_100g": 52.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 12.0,
    "fat_per_100g": 0.7,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "mango",
    "category": "fruit",
    "calories_per_100g": 60.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 15.0,
    "fat_per_100g": 0.4,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "pineapple",
    "category": "fruit",
    "calories_per_100g": 50.0,
    "protein_per_100g": 0.5,
    "carbs_per_100g": 13.0,
    "fat_per_100g": 0.1,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "kiwi",
    "category": "fruit",
    "calories_per_100g": 61.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 15.0,
    "fat_per_100g": 0.5,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "pear",
    "category": "fruit",
    "calories_per_100g": 57.0,
    "protein_per_100g": 0.4,
    "carbs_per_100g": 15.0,
    "fat_per_100g": 0.1,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "peach",
    "category": "fruit",
    "calories_per_100g": 39.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 10.0,
    "fat_per_100g": 0.3,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "plum",
    "category": "fruit",
    "calories_per_100g": 46.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 11.0,
    "fat_per_100g": 0.3,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "cherries",
    "category": "fruit",
    "calories_per_100g": 63.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 16.0,
    "fat_per_100g": 0.2,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "watermelon",
    "category": "fruit",
    "calories_per_100g": 30.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 8.0,
    "fat_per_100g": 0.2,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "melon",
    "category": "fruit",
    "calories_per_100g": 34.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 8.0,
    "fat_per_100g": 0.2,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "grapefruit",
    "category": "fruit",
    "calories_per_100g": 42.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 11.0,
    "fat_per_100g": 0.1,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "dates",
    "category": "fruit",
    "calories_per_100g": 277.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 75.0,
    "fat_per_100g": 0.2,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "raisins",
    "category": "fruit",
    "calories_per_100g": 299.0,
    "protein_per_100g": 3.0,
    "carbs_per_100g": 79.0,
    "fat_per_100g": 0.5,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "blackberries",
    "category": "fruit",
    "calories_per_100g": 43.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 10.0,
    "fat_per_100g": 0.5,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "figs",
    "category": "fruit",
    "calories_per_100g": 74.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 19.0,
    "fat_per_100g": 0.3,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "pesto",
    "category": "sauce",
    "calories_per_100g": 458.0,
    "protein_per_100g": 5.0,
    "carbs_per_100g": 6.0,
    "fat_per_100g": 47.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "tomato sauce",
    "category": "sauce",
    "calories_per_100g": 29.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 7.0,
    "fat_per_100g": 0.2,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "curry sauce",
    "category": "sauce",
    "calories_per_100g": 120.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 15.0,
    "fat_per_100g": 6.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "bbq sauce",
    "category": "sauce",
    "calories_per_100g": 172.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 40.0,
    "fat_per_100g": 0.5,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "mayonnaise",
    "category": "sauce",
    "calories_per_100g": 680.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 1.0,
    "fat_per_100g": 75.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "ketchup",
    "category": "sauce",
    "calories_per_100g": 112.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 26.0,
    "fat_per_100g": 0.1,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "soy sauce",
    "category": "sauce",
    "calories_per_100g": 53.0,
    "protein_per_100g": 8.0,
    "carbs_per_100g": 5.0,
    "fat_per_100g": 0.6,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "sweet chilli sauce",
    "category": "sauce",
    "calories_per_100g": 240.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 60.0,
    "fat_per_100g": 0.5,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "honey",
    "category": "sauce",
    "calories_per_100g": 304.0,
    "protein_per_100g": 0.3,
    "carbs_per_100g": 82.0,
    "fat_per_100g": 0.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "caesar dressing",
    "category": "sauce",
    "calories_per_100g": 480.0,
    "protein_per_100g": 4.0,
    "carbs_per_100g": 6.0,
    "fat_per_100g": 50.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "vinaigrette",
    "category": "sauce",
    "calories_per_100g": 120.0,
    "protein_per_100g": 0.0,
    "carbs_per_100g": 4.0,
    "fat_per_100g": 10.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "mustard",
    "category": "sauce",
    "calories_per_100g": 66.0,
    "protein_per_100g": 4.0,
    "carbs_per_100g": 6.0,
    "fat_per_100g": 4.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "hot sauce",
    "category": "sauce",
    "calories_per_100g": 20.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 4.0,
    "fat_per_100g": 0.1,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "jam",
    "category": "sauce",
    "calories_per_100g": 250.0,
    "protein_per_100g": 0.0,
    "carbs_per_100g": 65.0,
    "fat_per_100g": 0.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "maple syrup",
    "category": "sauce",
    "calories_per_100g": 260.0,
    "protein_per_100g": 0.0,
    "carbs_per_100g": 67.0,
    "fat_per_100g": 0.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "gravy",
    "category": "sauce",
    "calories_per_100g": 50.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 6.0,
    "fat_per_100g": 1.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "hummus",
    "category": "sauce",
    "calories_per_100g": 166.0,
    "protein_per_100g": 8.0,
    "carbs_per_100g": 14.0,
    "fat_per_100g": 10.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "guacamole",
    "category": "sauce",
    "calories_per_100g": 160.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 9.0,
    "fat_per_100g": 15.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "salad dressing",
    "category": "sauce",
    "calories_per_100g": 150.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 5.0,
    "fat_per_100g": 12.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "teriyaki sauce",
    "category": "sauce",
    "calories_per_100g": 90.0,
    "protein_per_100g": 5.0,
    "carbs_per_100g": 15.0,
    "fat_per_100g": 0.5,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "oyster sauce",
    "category": "sauce",
    "calories_per_100g": 51.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 11.0,
    "fat_per_100g": 0.2,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "fish sauce",
    "category": "sauce",
    "calories_per_100g": 35.0,
    "protein_per_100g": 6.0,
    "carbs_per_100g": 3.0,
    "fat_per_100g": 0.1,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "low fat mayo",
    "category": "sauce",
    "calories_per_100g": 250.0,
    "protein_per_100g": 1.0,
    "carbs_per_100g": 10.0,
    "fat_per_100g": 22.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "zero calorie sauce",
    "category": "sauce",
    "calories_per_100g": 5.0,
    "protein_per_100g": 0.0,
    "carbs_per_100g": 1.0,
    "fat_per_100g": 0.0,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "cream sauce",
    "category": "sauce",
    "calories_per_100g": 200.0,
    "protein_per_100g": 3.0,
    "carbs_per_100g": 5.0,
    "fat_per_100g": 18.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "cheese sauce",
    "category": "sauce",
    "calories_per_100g": 300.0,
    "protein_per_100g": 10.0,
    "carbs_per_100g": 10.0,
    "fat_per_100g": 25.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "custard",
    "category": "sauce",
    "calories_per_100g": 122.0,
    "protein_per_100g": 3.0,
    "carbs_per_100g": 18.0,
    "fat_per_100g": 4.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "milk skimmed",
    "category": "dairy",
    "calories_per_100g": 34.0,
    "protein_per_100g": 3.4,
    "carbs_per_100g": 5.0,
    "fat_per_100g": 0.1,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "milk semi skimmed",
    "category": "dairy",
    "calories_per_100g": 50.0,
    "protein_per_100g": 3.4,
    "carbs_per_100g": 5.0,
    "fat_per_100g": 1.8,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "milk whole",
    "category": "dairy",
    "calories_per_100g": 61.0,
    "protein_per_100g": 3.2,
    "carbs_per_100g": 5.0,
    "fat_per_100g": 3.3,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "yogurt low fat",
    "category": "dairy",
    "calories_per_100g": 63.0,
    "protein_per_100g": 5.0,
    "carbs_per_100g": 7.0,
    "fat_per_100g": 1.5,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "cream",
    "category": "dairy",
    "calories_per_100g": 340.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 3.0,
    "fat_per_100g": 36.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "evaporated milk",
    "category": "dairy",
    "calories_per_100g": 134.0,
    "protein_per_100g": 7.0,
    "carbs_per_100g": 10.0,
    "fat_per_100g": 7.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "condensed milk",
    "category": "dairy",
    "calories_per_100g": 321.0,
    "protein_per_100g": 8.0,
    "carbs_per_100g": 55.0,
    "fat_per_100g": 9.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "dark chocolate",
    "category": "treat",
    "calories_per_100g": 546.0,
    "protein_per_100g": 5.0,
    "carbs_per_100g": 61.0,
    "fat_per_100g": 31.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "milk chocolate",
    "category": "treat",
    "calories_per_100g": 535.0,
    "protein_per_100g": 7.0,
    "carbs_per_100g": 59.0,
    "fat_per_100g": 30.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "crisps",
    "category": "treat",
    "calories_per_100g": 536.0,
    "protein_per_100g": 7.0,
    "carbs_per_100g": 53.0,
    "fat_per_100g": 34.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "ice cream vanilla",
    "category": "treat",
    "calories_per_100g": 207.0,
    "protein_per_100g": 4.0,
    "carbs_per_100g": 24.0,
    "fat_per_100g": 11.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "biscuits",
    "category": "treat",
    "calories_per_100g": 502.0,
    "protein_per_100g": 6.0,
    "carbs_per_100g": 64.0,
    "fat_per_100g": 24.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "protein ice cream",
    "category": "treat",
    "calories_per_100g": 120.0,
    "protein_per_100g": 10.0,
    "carbs_per_100g": 15.0,
    "fat_per_100g": 3.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "low fat crisps",
    "category": "treat",
    "calories_per_100g": 400.0,
    "protein_per_100g": 7.0,
    "carbs_per_100g": 70.0,
    "fat_per_100g": 10.0,
    "food_tier": "balanced"
  },
  {
    "ingredient_name": "energy drink",
    "category": "snack",
    "calories_per_100g": 45.0,
    "protein_per_100g": 0.0,
    "carbs_per_100g": 11.0,
    "fat_per_100g": 0.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "sports drink",
    "category": "snack",
    "calories_per_100g": 30.0,
    "protein_per_100g": 0.0,
    "carbs_per_100g": 8.0,
    "fat_per_100g": 0.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "granola bar",
    "category": "snack",
    "calories_per_100g": 450.0,
    "protein_per_100g": 10.0,
    "carbs_per_100g": 60.0,
    "fat_per_100g": 20.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "white potatoes",
    "category": "carb",
    "calories_per_100g": 77.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 17.0,
    "fat_per_100g": 0.1,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "sweet potato",
    "category": "carb",
    "calories_per_100g": 86.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 20.0,
    "fat_per_100g": 0.1,
    "food_tier": "performance"
  },
  {
    "ingredient_name": "chips",
    "category": "carb",
    "calories_per_100g": 312.0,
    "protein_per_100g": 3.4,
    "carbs_per_100g": 41.0,
    "fat_per_100g": 15.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "fries",
    "category": "carb",
    "calories_per_100g": 312.0,
    "protein_per_100g": 3.4,
    "carbs_per_100g": 41.0,
    "fat_per_100g": 15.0,
    "food_tier": "flexible"
  },
  {
    "ingredient_name": "mashed potato",
    "category": "carb",
    "calories_per_100g": 88.0,
    "protein_per_100g": 2.0,
    "carbs_per_100g": 15.0,
    "fat_per_100g": 3.0,
    "food_tier": "balanced"
  }
]

export const INGREDIENT_BY_NAME: Record<string, Ingredient> = Object.fromEntries(
  GEORGE_INGREDIENTS.map((item) => [item.ingredient_name, item]),
)

export const GEORGE_RECIPE_ROWS: RecipeRow[] = [
  {
    "meal_name": "Egg omelette spinach",
    "ingredient": "eggs whole",
    "grams": 150
  },
  {
    "meal_name": "Egg omelette spinach",
    "ingredient": "spinach",
    "grams": 80
  },
  {
    "meal_name": "Egg omelette spinach",
    "ingredient": "olive oil",
    "grams": 5
  },
  {
    "meal_name": "Weetabix bowl",
    "ingredient": "weetabix",
    "grams": 70
  },
  {
    "meal_name": "Weetabix bowl",
    "ingredient": "milk semi skimmed",
    "grams": 200
  },
  {
    "meal_name": "Weetabix bowl",
    "ingredient": "banana",
    "grams": 120
  },
  {
    "meal_name": "Chicken rice bowl",
    "ingredient": "chicken breast raw",
    "grams": 150
  },
  {
    "meal_name": "Chicken rice bowl",
    "ingredient": "white rice dry",
    "grams": 70
  },
  {
    "meal_name": "Chicken rice bowl",
    "ingredient": "broccoli",
    "grams": 100
  },
  {
    "meal_name": "Chicken rice bowl",
    "ingredient": "olive oil",
    "grams": 5
  },
  {
    "meal_name": "Tuna sandwich",
    "ingredient": "tuna canned in water",
    "grams": 120
  },
  {
    "meal_name": "Tuna sandwich",
    "ingredient": "white bread",
    "grams": 80
  },
  {
    "meal_name": "Tuna sandwich",
    "ingredient": "mayonnaise",
    "grams": 10
  },
  {
    "meal_name": "Tuna sandwich",
    "ingredient": "lettuce",
    "grams": 30
  },
  {
    "meal_name": "Greek yogurt protein bowl",
    "ingredient": "greek yogurt 0 percent",
    "grams": 250
  },
  {
    "meal_name": "Greek yogurt protein bowl",
    "ingredient": "oats",
    "grams": 50
  },
  {
    "meal_name": "Greek yogurt protein bowl",
    "ingredient": "blueberries",
    "grams": 100
  },
  {
    "meal_name": "Greek yogurt protein bowl",
    "ingredient": "honey",
    "grams": 10
  },
  {
    "meal_name": "Avocado eggs on toast",
    "ingredient": "eggs whole",
    "grams": 120
  },
  {
    "meal_name": "Avocado eggs on toast",
    "ingredient": "avocado",
    "grams": 70
  },
  {
    "meal_name": "Avocado eggs on toast",
    "ingredient": "sourdough bread",
    "grams": 80
  },
  {
    "meal_name": "Chicken pasta bowl",
    "ingredient": "chicken breast raw",
    "grams": 150
  },
  {
    "meal_name": "Chicken pasta bowl",
    "ingredient": "pasta dry",
    "grams": 80
  },
  {
    "meal_name": "Chicken pasta bowl",
    "ingredient": "tomato sauce",
    "grams": 120
  },
  {
    "meal_name": "Chicken pasta bowl",
    "ingredient": "spinach",
    "grams": 60
  },
  {
    "meal_name": "Beef mince pasta",
    "ingredient": "lean beef mince 5 percent",
    "grams": 150
  },
  {
    "meal_name": "Beef mince pasta",
    "ingredient": "penne pasta dry",
    "grams": 80
  },
  {
    "meal_name": "Beef mince pasta",
    "ingredient": "tomato sauce",
    "grams": 120
  },
  {
    "meal_name": "Beef mince pasta",
    "ingredient": "onion",
    "grams": 60
  },
  {
    "meal_name": "Salmon rice greens",
    "ingredient": "salmon",
    "grams": 150
  },
  {
    "meal_name": "Salmon rice greens",
    "ingredient": "basmati rice dry",
    "grams": 70
  },
  {
    "meal_name": "Salmon rice greens",
    "ingredient": "green beans",
    "grams": 100
  },
  {
    "meal_name": "Steak potatoes veg",
    "ingredient": "steak sirloin",
    "grams": 180
  },
  {
    "meal_name": "Steak potatoes veg",
    "ingredient": "white potatoes",
    "grams": 250
  },
  {
    "meal_name": "Steak potatoes veg",
    "ingredient": "broccoli",
    "grams": 100
  },
  {
    "meal_name": "Turkey wrap",
    "ingredient": "turkey breast",
    "grams": 140
  },
  {
    "meal_name": "Turkey wrap",
    "ingredient": "wrap wholemeal",
    "grams": 70
  },
  {
    "meal_name": "Turkey wrap",
    "ingredient": "lettuce",
    "grams": 40
  },
  {
    "meal_name": "Turkey wrap",
    "ingredient": "low fat mayo",
    "grams": 15
  },
  {
    "meal_name": "Cottage cheese fruit bowl",
    "ingredient": "cottage cheese",
    "grams": 250
  },
  {
    "meal_name": "Cottage cheese fruit bowl",
    "ingredient": "apple",
    "grams": 150
  },
  {
    "meal_name": "Cottage cheese fruit bowl",
    "ingredient": "walnuts",
    "grams": 15
  }
]

function round1(value: number) {
  return Math.round(value * 10) / 10
}

export function calculateRecipeTotals(rows: RecipeRow[]) {
  return rows.reduce(
    (acc, row) => {
      const ingredient = INGREDIENT_BY_NAME[row.ingredient]
      if (!ingredient) return acc
      const factor = row.grams / 100
      acc.calories += ingredient.calories_per_100g * factor
      acc.protein += ingredient.protein_per_100g * factor
      acc.carbs += ingredient.carbs_per_100g * factor
      acc.fat += ingredient.fat_per_100g * factor
      acc.tiers.add(ingredient.food_tier)
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, tiers: new Set<FoodTier>() },
  )
}

export const GEORGE_RECIPES: RecipeSummary[] = Array.from(
  GEORGE_RECIPE_ROWS.reduce((map, row) => {
    const existing = map.get(row.meal_name) ?? []
    existing.push(row)
    map.set(row.meal_name, existing)
    return map
  }, new Map<string, RecipeRow[]>()),
).map(([meal_name, rows]) => {
  const totals = calculateRecipeTotals(rows)
  return {
    meal_name,
    rows,
    calories: round1(totals.calories),
    protein: round1(totals.protein),
    carbs: round1(totals.carbs),
    fat: round1(totals.fat),
    tier_profile: Array.from(totals.tiers),
  }
})

export function getFoodSystemCounts() {
  return {
    ingredientCount: GEORGE_INGREDIENTS.length,
    recipeCount: GEORGE_RECIPES.length,
  }
}

export function buildFoodSystemPrompt() {
  const categoryOrder: FoodCategory[] = ["protein", "carb", "fat", "veg", "fruit", "sauce", "dairy", "treat", "snack"]
  const grouped = categoryOrder
    .map((category) => {
      const items = GEORGE_INGREDIENTS.filter((item) => item.category === category).map((item) => item.ingredient_name)
      return `${category}: ${items.join(", ")}`
    })
    .join("\n")

  const recipes = GEORGE_RECIPES.map((recipe) => {
    const rows = recipe.rows.map((row) => `${row.ingredient} (${row.grams}g)`).join(", ")
    return `- ${recipe.meal_name}: ${rows} | macros approx ${recipe.calories} kcal / P ${recipe.protein} / C ${recipe.carbs} / F ${recipe.fat}`
  }).join("\n")

  return `FOOD SYSTEM
- Use only ingredients from George's loaded ingredient system. Do not invent foods outside this list.
- If the user asks for a food that is not in the system, say you do not use that exact item yet and offer the closest in-system alternative.
- Ingredient names are exact. Use the ingredient list as the source of truth for macros.
- Carbs like rice, pasta, couscous, and oats use dry weights. Meat uses raw weights. Potatoes, fruit, and veg use normal raw weights.
- Recipes are flexible starting points, not locked meals. You can scale portions, swap ingredients, and rebuild meals, but only with ingredients from the loaded system.
- Respect food tiers: performance, balanced, flexible. Use stricter foods for performance / fight prep, broader foods for balanced or flexible users.

ALLOWED INGREDIENTS BY CATEGORY
${grouped}

BASE RECIPE TEMPLATES
${recipes}`
}
