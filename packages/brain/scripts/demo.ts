/**
 * A tangible walk-through of the Brain's decisions. Not a test — a readable
 * demo. `npm run brain:demo`
 */
import { nextNudge, type BrainEvent, type PredictInput } from '../src/index';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const TODAY = 19_723; // epoch day → Monday
const NOW = TODAY * DAY + 12 * HOUR; // Monday 12:00 UTC

let i = 0;
const log = (foodId: string, slot: BrainEvent['slot'], daysAgo: number, hour: number, portionG?: number): BrainEvent => ({
  id: `e${i++}`, ts: (TODAY - daysAgo) * DAY + hour * HOUR, tzOffsetMin: 0, kind: 'log', foodId, slot, portionG,
});
const decline = (foodId: string, slot: BrainEvent['slot'], daysAgo: number, hour: number): BrainEvent => ({
  id: `e${i++}`, ts: (TODAY - daysAgo) * DAY + hour * HOUR, tzOffsetMin: 0, kind: 'nudge_decline', foodId, slot,
});
function habit(foodId: string, slot: BrainEvent['slot'], days: number, hour: number, portionG?: number): BrainEvent[] {
  const out: BrainEvent[] = [];
  for (let d = 1; d <= days; d++) out.push(log(foodId, slot, d, hour, portionG));
  return out;
}

function show(title: string, input: PredictInput): void {
  const plan = nextNudge(input);
  const p = plan.prediction;
  console.log(`\n▸ ${title}`);
  if (plan.fire && p) {
    const copy = plan.framing === 'menu'
      ? `“Your menu says ${p.foodId} — did you have it?”`
      : `“The usual? ${p.foodId} (${p.portionG}g)”`;
    console.log(`  🔔 NUDGE (${plan.framing})  ${copy}`);
    console.log(`     score ${p.score.toFixed(2)} · tier ${p.tier} · action ${p.action}`);
  } else {
    console.log(`  🔕 no nudge — ${plan.decision.reasons.join('; ')}`);
    if (p) console.log(`     (top: ${p.foodId} · score ${p.score.toFixed(2)} · tier ${p.tier} → ${p.action})`);
  }
}

const common = { now: NOW, tzOffsetMin: 0 } as const;

// 1) The flagship: a 20-day, menu-aligned lunch habit.
show('Habitual lunch, on the menu', {
  ...common,
  slot: 'lunch',
  events: habit('chicken & rice', 'lunch', 20, 12, 220),
  candidates: ['chicken & rice', 'pizza', 'salad'],
  menu: [{ dayOfWeek: 1, slot: 'lunch', foodId: 'chicken & rice' }],
});

// 2) Day 0, nothing logged yet — menu-framed confirmation.
show('Brand-new user, day 0', {
  ...common,
  slot: 'breakfast',
  events: [],
  candidates: ['porridge', 'eggs'],
  menu: [{ dayOfWeek: 1, slot: 'breakfast', foodId: 'porridge', portionG: 50 }],
});

// 3) The user has said no twice — the Brain backs off (decline penalty).
show('Declined dinner twice → Brain backs off', {
  ...common,
  slot: 'dinner',
  events: [...habit('salad', 'dinner', 10, 19), decline('salad', 'dinner', 2, 19), decline('salad', 'dinner', 1, 19)],
  candidates: ['salad'],
  menu: [{ dayOfWeek: 1, slot: 'dinner', foodId: 'salad' }],
});

console.log('');
