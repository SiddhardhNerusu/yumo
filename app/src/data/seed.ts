import { inferSlot, type BrainEvent, type WeekMenu } from '@usual/brain';
import type { MealSlot } from '@usual/shared';

/**
 * DEMO SEED — a plausible local history so the app has something real to render
 * before the sync layer fills the event log. NOT the production catalogue.
 */
export interface FoodMeta {
  name: string;
  kcal: number;
  portionG: number;
}

export const FOODS: Record<string, FoodMeta> = {
  greek_yogurt: { name: 'Greek yogurt & berries', kcal: 280, portionG: 200 },
  chicken_rice: { name: 'Chicken & rice', kcal: 620, portionG: 400 },
  salmon_veg: { name: 'Salmon & greens', kcal: 540, portionG: 350 },
  eggs_toast: { name: 'Eggs on toast', kcal: 480, portionG: 250 },
  oats: { name: 'Porridge & banana', kcal: 410, portionG: 300 },
  salad: { name: 'Chicken salad', kcal: 450, portionG: 320 },
  pasta: { name: 'Tomato pasta', kcal: 600, portionG: 350 },
  apple_pb: { name: 'Apple & peanut butter', kcal: 240, portionG: 150 },
};

const DAY = 86_400_000;
const HOUR = 3_600_000;
const SLOT_TIME: Record<MealSlot, number> = { breakfast: 8, lunch: 12, dinner: 19, snack: 16 };
const HABIT: Record<MealSlot, string> = {
  breakfast: 'greek_yogurt',
  lunch: 'chicken_rice',
  dinner: 'salmon_veg',
  snack: 'apple_pb',
};
export const CANDIDATES: Record<MealSlot, string[]> = {
  breakfast: ['greek_yogurt', 'eggs_toast', 'oats'],
  lunch: ['chicken_rice', 'salad', 'pasta'],
  dinner: ['salmon_veg', 'pasta', 'chicken_rice'],
  snack: ['apple_pb', 'greek_yogurt'],
};
const ALL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// UTC-based day boundary at a given hour (demo runs in the UTC frame).
function dayHourTs(now: number, daysAgo: number, hour: number): number {
  const dayStart = Math.floor((now - daysAgo * DAY) / DAY) * DAY;
  return dayStart + hour * HOUR;
}

let idc = 0;

/** ~3 weeks of habit + today's earlier meals (so freq/recency/tod are strong
 * and the ring shows progress). This is the starting event log; live logs
 * append on top of it. */
export function buildSeedHistory(now: number): BrainEvent[] {
  const events: BrainEvent[] = [];
  const habitSlots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

  for (let d = 1; d <= 21; d++) {
    for (const s of habitSlots) {
      const food = HABIT[s];
      const meta = FOODS[food];
      if (!meta) continue;
      events.push({ id: `s${idc++}`, ts: dayHourTs(now, d, SLOT_TIME[s]), tzOffsetMin: 0, kind: 'log', foodId: food, slot: s, portionG: meta.portionG, kcal: meta.kcal });
    }
  }

  // Add today's *earlier* meals only — leave the current slot open to log, so
  // the log loop is always demonstrable.
  const nowHour = new Date(now).getUTCHours();
  const curSlot = inferSlot(now, 0);
  const curIdx = habitSlots.indexOf(curSlot);
  for (const s of habitSlots) {
    const isPast = curIdx === -1 ? SLOT_TIME[s] < nowHour : habitSlots.indexOf(s) < curIdx;
    if (!isPast) continue;
    const food = HABIT[s];
    const meta = FOODS[food];
    if (!meta) continue;
    events.push({ id: `t${idc++}`, ts: dayHourTs(now, 0, SLOT_TIME[s]), tzOffsetMin: 0, kind: 'log', foodId: food, slot: s, portionG: meta.portionG, kcal: meta.kcal });
  }

  return events;
}

/** Menu covers every day so menuPrior fires whatever today is (static). */
export const SEED_MENU: WeekMenu = (() => {
  const menu: WeekMenu = [];
  for (let dow = 0; dow < 7; dow++) {
    for (const s of ALL_SLOTS) {
      const food = HABIT[s];
      const meta = FOODS[food];
      if (meta) menu.push({ dayOfWeek: dow, slot: s, foodId: food, portionG: meta.portionG });
    }
  }
  return menu;
})();

export const PORTION_FALLBACK: Record<string, number> = Object.fromEntries(
  Object.entries(FOODS).map(([id, m]) => [id, m.portionG]),
);
