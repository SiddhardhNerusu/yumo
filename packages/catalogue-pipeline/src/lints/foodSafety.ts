// High-risk animal proteins that must see heat. If present raw and no step
// cooks them, we route to the human queue (§4.5 step 3). Not a hard reject —
// keyword matching is fuzzy (e.g. "chicken stock" is not raw chicken), and the
// human gate is the real safety net; nothing reaches "live" un-reviewed.
const RISK_PATTERNS: RegExp[] = [
  /\bchicken\b/,
  /\bpork\b/,
  /\bpoultry\b/,
  /\bturkey\b/,
  /\bduck\b/,
  /\bbacon\b/,
  /\bsausage\b/,
  /\bmince\b/,
  /\bground (beef|pork|turkey|chicken|lamb)\b/,
  /\bminced (beef|pork|lamb|chicken|turkey)\b/,
  /\begg\b/,
  /\beggs\b/,
];

// Names that contain a risk word but are not raw high-risk proteins.
const EXCLUDE = /\b(stock|broth|bouillon|gravy|granule|cube|seasoning|flavou?r|powder|sauce)\b/;

// Already-cooked markers on the ingredient itself.
const ALREADY_COOKED =
  /\b(cooked|roasted|grilled|fried|baked|boiled|poached|pre[- ]?cooked|smoked|cured|canned|rotisserie|leftover)\b/;

// Evidence of a heat/temperature step in the method.
const HEAT_STEP =
  /(\bcook|\bcooked|\broast|\bgrill|\bfry|\bfried|\bbake|\bboil|\bsimmer|\bpoach|\bsaut|\bsear|\bheat\b|°c|°f|internal temp|no longer pink|until.*(cooked|done))/i;

export interface FoodSafetyResult {
  flagged: boolean;
  reasons: string[];
}

export function checkFoodSafety(ingredientNames: string[], steps: string[]): FoodSafetyResult {
  const reasons: string[] = [];
  const hasHeatStep = HEAT_STEP.test(steps.join(' '));
  for (const name of ingredientNames) {
    const lower = name.toLowerCase();
    if (EXCLUDE.test(lower)) continue;
    const isRisk = RISK_PATTERNS.some((re) => re.test(lower));
    if (!isRisk) continue;
    if (ALREADY_COOKED.test(lower)) continue;
    if (!hasHeatStep) {
      reasons.push(`raw high-risk ingredient "${name}" without a cooking/temperature step`);
    }
  }
  return { flagged: reasons.length > 0, reasons };
}
