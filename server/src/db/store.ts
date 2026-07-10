import { rankFoods, indexById, type FdcStore, type FdcFood } from '@usual/catalogue-pipeline';
import type { MenuRecipe, WeekMenuPlan, UserProfile } from '@usual/menu';
import { loadCatalogue, type RecipeDetail } from '../catalogue';

export type Tier = 'free' | 'premium';
export type AuthProvider = 'apple' | 'google' | 'dev';

export interface User {
  id: string;
  email: string | null;
  provider: AuthProvider;
  providerId: string;
  createdAtMs: number;
}

export interface StoredProfile extends UserProfile {
  userId: string;
  goal: 'lose' | 'maintain' | 'gain';
  updatedAtMs: number;
}

export interface FoodHit {
  fdcId: number;
  description: string;
  per100g: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
}

export interface Bubble {
  token: string;
  weight: number;
}

export interface StoredMenu {
  userId: string;
  plan: WeekMenuPlan;
  seed: string;
  createdAtMs: number;
}

/** Opaque per-batch event blob. The server never parses event contents in v1
 * (§8.2 client-authoritative, encrypted). */
export interface EventBatch {
  id: string;
  userId: string;
  receivedAtMs: number;
  blob: string;
  count: number;
}

export interface Store {
  // auth / users
  upsertUser(provider: AuthProvider, providerId: string, email: string | null): User;
  getUser(id: string): User | undefined;
  // entitlements
  getTier(userId: string): Tier;
  setTier(userId: string, tier: Tier): void;
  // profile
  getProfile(userId: string): StoredProfile | undefined;
  putProfile(userId: string, profile: StoredProfile): StoredProfile;
  // catalogue
  recipePool(): MenuRecipe[];
  getRecipe(id: string): RecipeDetail | undefined;
  searchFoods(q: string, limit: number): FoodHit[];
  bubbles(limit: number): Bubble[];
  // menu
  saveMenu(menu: StoredMenu): void;
  getCurrentMenu(userId: string): StoredMenu | undefined;
  // event sync
  appendEvents(batch: EventBatch): void;
  eventsSince(userId: string, sinceMs: number): EventBatch[];
}

export class MemoryStore implements Store {
  private users = new Map<string, User>();
  private byProvider = new Map<string, string>(); // provider:providerId -> userId
  private tiers = new Map<string, Tier>();
  private profiles = new Map<string, StoredProfile>();
  private menus = new Map<string, StoredMenu>();
  private events: EventBatch[] = [];
  private seq = 0;

  private readonly foods: FdcStore;
  private readonly byId: Map<number, FdcFood>;
  private readonly pool: MenuRecipe[];
  private readonly details: Map<string, RecipeDetail>;
  private readonly bubbleList: Bubble[];

  constructor(now: number) {
    const cat = loadCatalogue();
    this.foods = cat.foods;
    this.byId = indexById(cat.foods);
    this.pool = cat.pool;
    this.details = cat.details;
    this.bubbleList = computeBubbles(cat.details);
    void now;
  }

  private id(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }

  upsertUser(provider: AuthProvider, providerId: string, email: string | null): User {
    const key = `${provider}:${providerId}`;
    const existingId = this.byProvider.get(key);
    if (existingId) {
      const u = this.users.get(existingId);
      if (u) return u;
    }
    const user: User = { id: this.id('u'), email, provider, providerId, createdAtMs: 0 };
    this.users.set(user.id, user);
    this.byProvider.set(key, user.id);
    this.tiers.set(user.id, 'free');
    return user;
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  getTier(userId: string): Tier {
    return this.tiers.get(userId) ?? 'free';
  }

  setTier(userId: string, tier: Tier): void {
    this.tiers.set(userId, tier);
  }

  getProfile(userId: string): StoredProfile | undefined {
    return this.profiles.get(userId);
  }

  putProfile(userId: string, profile: StoredProfile): StoredProfile {
    this.profiles.set(userId, profile);
    return profile;
  }

  recipePool(): MenuRecipe[] {
    return this.pool;
  }

  getRecipe(id: string): RecipeDetail | undefined {
    return this.details.get(id);
  }

  searchFoods(q: string, limit: number): FoodHit[] {
    const hits: FoodHit[] = [];
    for (const cand of rankFoods(q, this.foods, limit)) {
      const food = this.byId.get(cand.fdcId);
      if (food) hits.push({ fdcId: food.fdcId, description: food.description, per100g: food.per100g });
    }
    return hits;
  }

  bubbles(limit: number): Bubble[] {
    return this.bubbleList.slice(0, limit);
  }

  saveMenu(menu: StoredMenu): void {
    this.menus.set(menu.userId, menu);
  }

  getCurrentMenu(userId: string): StoredMenu | undefined {
    return this.menus.get(userId);
  }

  appendEvents(batch: EventBatch): void {
    this.events.push(batch);
  }

  eventsSince(userId: string, sinceMs: number): EventBatch[] {
    return this.events.filter((e) => e.userId === userId && e.receivedAtMs >= sinceMs);
  }
}

/** Data-driven bubbles: ingredient tokens ranked by how many recipes use them
 * (§2.2 — server-served, never a hardcoded client list). */
function computeBubbles(details: Map<string, RecipeDetail>): Bubble[] {
  const counts = new Map<string, number>();
  for (const r of details.values()) {
    const seen = new Set<string>();
    for (const raw of r.foodTokens) {
      // reduce "chicken breast, cooked" → head noun-ish tokens
      for (const tok of raw.split(/[,()]/)[0]?.trim().split(/\s+/) ?? []) {
        const t = tok.toLowerCase();
        if (t.length < 3 || seen.has(t)) continue;
        seen.add(t);
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .map(([token, weight]) => ({ token, weight }))
    .sort((a, b) => b.weight - a.weight);
}
