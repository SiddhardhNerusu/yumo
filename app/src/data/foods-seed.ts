/**
 * Single-ingredient foods for the Add sheet FOODS section (§5). Curated seed so
 * the section has content offline; server FDC search appends more when typing.
 * Every entry has a real portion + kcal (no "add 500 kcal of nothing").
 */
export interface SingleFood {
  id: string;
  name: string;
  portion: string;
  kcal: number;
}

export const SINGLE_FOODS: SingleFood[] = [
  { id: 'food:bread', name: 'Bread', portion: '1 slice', kcal: 80 },
  { id: 'food:milk', name: 'Milk', portion: '200 ml', kcal: 96 },
  { id: 'food:banana', name: 'Banana', portion: '1 medium', kcal: 105 },
  { id: 'food:eggs', name: 'Eggs', portion: '2 medium', kcal: 156 },
  { id: 'food:chicken', name: 'Chicken breast', portion: '100 g', kcal: 165 },
  { id: 'food:rice', name: 'Rice, cooked', portion: '150 g', kcal: 195 },
  { id: 'food:greek_yogurt', name: 'Greek yogurt', portion: '150 g', kcal: 130 },
  { id: 'food:apple', name: 'Apple', portion: '1 medium', kcal: 95 },
  { id: 'food:peanut_butter', name: 'Peanut butter', portion: '1 tbsp', kcal: 96 },
  { id: 'food:oats', name: 'Oats', portion: '40 g', kcal: 150 },
  { id: 'food:cheese', name: 'Cheddar', portion: '30 g', kcal: 120 },
  { id: 'food:avocado', name: 'Avocado', portion: '½', kcal: 120 },
  { id: 'food:almonds', name: 'Almonds', portion: '30 g', kcal: 174 },
  { id: 'food:salmon', name: 'Salmon', portion: '100 g', kcal: 208 },
];
