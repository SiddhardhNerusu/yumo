import type { MealSlot } from '@yumo/shared';

/** One planned meal in this week's menu (§4.3). Keyed by local day-of-week so a
 * single week template repeats; portionG seeds portion learning on day 0. */
export interface MenuEntry {
  dayOfWeek: number; // 0 = Sun … 6 = Sat
  slot: MealSlot;
  foodId: string;
  portionG?: number;
}

export type WeekMenu = MenuEntry[];

export function onMenu(
  menu: WeekMenu | undefined,
  dayOfWeek: number,
  slot: MealSlot,
  foodId: string,
): boolean {
  return !!menu?.some((m) => m.dayOfWeek === dayOfWeek && m.slot === slot && m.foodId === foodId);
}

export function menuFoodsForSlot(
  menu: WeekMenu | undefined,
  dayOfWeek: number,
  slot: MealSlot,
): string[] {
  if (!menu) return [];
  return menu.filter((m) => m.dayOfWeek === dayOfWeek && m.slot === slot).map((m) => m.foodId);
}

export function menuPortion(
  menu: WeekMenu | undefined,
  dayOfWeek: number,
  slot: MealSlot,
  foodId: string,
): number | undefined {
  return menu?.find((m) => m.dayOfWeek === dayOfWeek && m.slot === slot && m.foodId === foodId)
    ?.portionG;
}
