/**
 * Placeholder food graph for the interactive bubble picker (§2.2): tapping a
 * food reveals its related foods (rice → fried rice, biryani, rice bowl…).
 * In production these edges come from the server food graph (§4.1 food_edges);
 * this curated seed stands in for v1 so the interaction is real now.
 */
/** Curated top-level foods shown as the initial floating bubbles (each has a
 * RELATED entry below that fans out on tap). Kept to ~16 so the cloud isn't
 * crowded on a phone. */
export const FOOD_PARENTS: string[] = [
  'Chicken', 'Rice', 'Eggs', 'Oats', 'Greek yogurt', 'Salmon', 'Beef', 'Pasta',
  'Potato', 'Bread', 'Cheese', 'Chickpeas', 'Tofu', 'Avocado', 'Curry', 'Banana',
];

export const RELATED: Record<string, string[]> = {
  Chicken: ['Chicken curry', 'Roast chicken', 'Chicken salad', 'Grilled chicken'],
  Rice: ['Fried rice', 'Rice bowl', 'Biryani', 'Egg fried rice'],
  Eggs: ['Omelette', 'Scrambled eggs', 'Boiled eggs', 'Shakshuka'],
  Oats: ['Porridge', 'Overnight oats', 'Granola'],
  'Greek yogurt': ['Yogurt bowl', 'Yogurt & berries', 'Tzatziki'],
  Banana: ['Banana oats', 'Banana smoothie', 'Banana & PB'],
  Salmon: ['Grilled salmon', 'Salmon poke', 'Teriyaki salmon'],
  Beef: ['Steak', 'Beef stir-fry', 'Bolognese', 'Beef burger'],
  Pasta: ['Spaghetti', 'Carbonara', 'Pasta bake', 'Pesto pasta'],
  Potato: ['Mashed potato', 'Roast potatoes', 'Jacket potato'],
  Broccoli: ['Broccoli stir-fry', 'Roasted broccoli'],
  Spinach: ['Spinach curry', 'Spinach salad'],
  Chickpeas: ['Chana masala', 'Falafel', 'Hummus'],
  Lentils: ['Dal', 'Lentil soup', 'Lentil curry'],
  'Black beans': ['Bean burrito', 'Bean chilli', 'Bean bowl'],
  Tofu: ['Tofu stir-fry', 'Crispy tofu', 'Tofu curry'],
  Cheese: ['Cheese toastie', 'Halloumi', 'Feta salad'],
  'Peanut butter': ['PB toast', 'PB & banana', 'PB oats'],
  Almonds: ['Trail mix', 'Almond butter'],
  Avocado: ['Avo toast', 'Guacamole', 'Avo salad'],
  'Sweet potato': ['Sweet potato fries', 'Sweet potato mash'],
  Tuna: ['Tuna salad', 'Tuna pasta', 'Tuna melt'],
  Prawns: ['Prawn stir-fry', 'Prawn curry', 'Garlic prawns'],
  Bread: ['Sandwich', 'Toast', 'Avocado toast'],
  Berries: ['Berry smoothie', 'Berry yogurt', 'Berry oats'],
  Apple: ['Apple & PB', 'Apple oats'],
  Tomato: ['Tomato pasta', 'Caprese', 'Tomato soup'],
  Onion: ['Onion bhaji'],
  Curry: ['Chicken curry', 'Veg curry', 'Chickpea curry'],
  Noodles: ['Stir-fry noodles', 'Ramen', 'Pad thai'],
  Hummus: ['Hummus wrap', 'Hummus bowl'],
};
