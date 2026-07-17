import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * "My meals" (§M5) — the homemade thing you log daily becomes one tap, without
 * search. A PROVIDER, not a plain hook: the Day "Save to my meals" link and the
 * AddSheet "My meals" section are BOTH mounted at once (AddSheet is a child of
 * Day, always rendered with a `visible` prop), so two hook instances would each
 * read AsyncStorage once and never see the other's save. One provider keeps them
 * in sync — verified necessary in the browser.
 */
const KEY = 'yumo.mymeals.v1';

export interface SavedMeal {
  id: string;
  name: string;
  kcal: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  portion?: string;
  createdAt: number;
}

interface MyMealsCtx {
  meals: SavedMeal[];
  save: (meal: Omit<SavedMeal, 'id' | 'createdAt'>) => void;
  remove: (id: string) => void;
}

const Ctx = createContext<MyMealsCtx | null>(null);

export function MyMealsProvider({ children }: { children: ReactNode }) {
  const [meals, setMeals] = useState<SavedMeal[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (!v) return;
        try {
          const parsed = JSON.parse(v);
          if (Array.isArray(parsed)) setMeals(parsed as SavedMeal[]);
        } catch {
          /* ignore corrupt */
        }
      })
      .catch(() => {});
  }, []);

  const save = useCallback((meal: Omit<SavedMeal, 'id' | 'createdAt'>) => {
    setMeals((prev) => {
      // Dedupe on name + kcal (D13): the same food at 100 g and 200 g are two
      // distinct saved meals; re-saving the identical one replaces it.
      const same = (m: SavedMeal) => m.name.trim().toLowerCase() === meal.name.trim().toLowerCase() && m.kcal === meal.kcal;
      const entry: SavedMeal = { ...meal, id: `my-${Date.now().toString(36)}`, createdAt: Date.now() };
      const next = [...prev.filter((m) => !same(m)), entry];
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setMeals((prev) => {
      const next = prev.filter((m) => m.id !== id);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ meals, save, remove }}>{children}</Ctx.Provider>;
}

export function useMyMeals(): MyMealsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('MyMealsProvider missing');
  return v;
}

/** Is a (name, kcal) already saved? Drives the "Saved ✓" state on Day. */
export function isMealSaved(meals: SavedMeal[], name: string, kcal: number): boolean {
  const n = name.trim().toLowerCase();
  return meals.some((m) => m.name.trim().toLowerCase() === n && m.kcal === kcal);
}
