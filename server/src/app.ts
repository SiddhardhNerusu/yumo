import { randomUUID } from 'node:crypto';
import express, { type Express, type Request, type Response } from 'express';
import { z } from 'zod';
import { ALLERGENS, MEAL_SLOTS, type Allergen, type MealSlot } from '@yumo/shared';
import { generateWeekMenu, mixItUp, type UserProfile } from '@yumo/menu';
import { median } from '@yumo/brain';
import type { Store, StoredProfile } from './db/store';
import { signSession, verifyExternalIdentity } from './auth';
import { requireAuth, type AuthedRequest } from './middleware';
import { BUILD, IS_PROD, remoteConfig } from './config';

const allergenSchema = z.enum(ALLERGENS as unknown as [string, ...string[]]);
const slotSchema = z.enum(MEAL_SLOTS as unknown as [string, ...string[]]);

const profileSchema = z
  .object({
    budgetKcal: z.number().positive(),
    targetWeightKg: z.number().positive(),
    goal: z.enum(['lose', 'maintain', 'gain']),
    allergies: z.array(allergenSchema),
    hates: z.array(z.string()),
    needs: z.array(z.string()),
    likes: z.array(z.string()),
    pantry: z.array(z.string()),
    variation: z.enum(['habit', 'balanced', 'mixup']),
    cuisineLean: z.record(z.string(), z.number()),
  })
  .partial();

const DEFAULT_PROFILE: Omit<StoredProfile, 'userId' | 'updatedAtMs'> = {
  budgetKcal: 2000,
  targetWeightKg: 75,
  goal: 'maintain',
  allergies: [],
  hates: [],
  needs: [],
  likes: [],
  pantry: [],
  variation: 'balanced',
};

function clampInt(v: unknown, def: number, lo: number, hi: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

const WEEK_MS = 7 * 86_400_000;

export function createApp(store: Store, now: () => number = () => Date.now()): Express {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // ── health & config ──────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    return res.json({ status: 'ok', build: BUILD, engines: ['brain', 'menu', 'catalogue'] });
  });
  app.get('/api/config', (_req, res) => res.json(remoteConfig()));

  // ── auth ─────────────────────────────────────────────────────────────────
  const issue = (res: Response, provider: 'apple' | 'google' | 'dev', providerId: string, email: string | null) => {
    const user = store.upsertUser(provider, providerId, email);
    return res.json({
      token: signSession(user.id),
      user: { id: user.id, email: user.email, tier: store.getTier(user.id) },
    });
  };
  const idBody = z.object({ identityToken: z.string(), email: z.string().email().nullish() });

  const externalLogin = (provider: 'apple' | 'google') => (req: Request, res: Response) => {
    const parsed = idBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'bad_request' });
    const identity = verifyExternalIdentity(parsed.data.identityToken, parsed.data.email ?? null);
    if (!identity) return res.status(IS_PROD ? 501 : 401).json({ error: 'verification_unavailable' });
    return issue(res, provider, identity.providerId, identity.email);
  };
  app.post('/api/auth/apple', externalLogin('apple'));
  app.post('/api/auth/google', externalLogin('google'));

  // Dev-only login (tests + local). Never available in production.
  app.post('/api/auth/dev', (req: Request, res: Response) => {
    if (IS_PROD) return res.status(404).json({ error: 'not_found' });
    const parsed = z.object({ providerId: z.string().min(1), email: z.string().nullish() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'bad_request' });
    return issue(res, 'dev', parsed.data.providerId, parsed.data.email ?? null);
  });

  // ── profile ──────────────────────────────────────────────────────────────
  app.get('/api/profile', requireAuth, (req, res) => {
    const userId = (req as AuthedRequest).userId as string;
    return res.json(store.getProfile(userId) ?? null);
  });
  app.patch('/api/profile', requireAuth, (req, res) => {
    const userId = (req as AuthedRequest).userId as string;
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'bad_request', issues: parsed.error.issues });
    const existing = store.getProfile(userId);
    const merged: StoredProfile = {
      ...(existing ?? DEFAULT_PROFILE),
      ...(parsed.data as Partial<StoredProfile>),
      userId,
      updatedAtMs: now(),
    };
    return res.json(store.putProfile(userId, merged));
  });

  // ── onboarding bubbles ─────────────────────────────────────────────────────
  app.get('/api/onboarding/bubbles', (req, res) => {
    const limit = clampInt(req.query['limit'], 200, 1, 500);
    return res.json({ bubbles: store.bubbles(limit) });
  });

  // ── foods ──────────────────────────────────────────────────────────────────
  app.get('/api/foods/search', (req, res) => {
    const q = String(req.query['q'] ?? '');
    const limit = clampInt(req.query['limit'], 20, 1, 50);
    return res.json({ foods: store.searchFoods(q, limit) });
  });
  // OpenFoodFacts (ODbL — attribution shown in-app) for branded/barcode foods.
  app.get('/api/foods/barcode/:ean', async (req, res) => {
    const ean = String(req.params.ean).replace(/\D/g, '');
    if (ean.length < 8 || ean.length > 14) return res.status(400).json({ error: 'bad_ean' });
    try {
      const r = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=product_name,brands,nutriments`,
        { headers: { 'user-agent': 'Usual/0.1 (dogfood)' }, signal: AbortSignal.timeout(6000) },
      );
      const j = (await r.json()) as { status?: number; product?: { product_name?: string; brands?: string; nutriments?: Record<string, unknown> } };
      if (j.status !== 1 || !j.product) return res.status(404).json({ error: 'not_found' });
      const n = j.product.nutriments ?? {};
      const num = (k: string) => Number(n[k] ?? 0) || 0;
      const name = [j.product.brands, j.product.product_name].filter(Boolean).join(' — ') || `Barcode ${ean}`;
      return res.json({
        food: {
          fdcId: -Number(ean.slice(-9)), // synthetic negative id (not an FDC id)
          description: name,
          per100g: { kcal: num('energy-kcal_100g'), protein_g: num('proteins_100g'), carbs_g: num('carbohydrates_100g'), fat_g: num('fat_100g') },
          source: 'openfoodfacts',
        },
      });
    } catch {
      return res.status(502).json({ error: 'off_unavailable' });
    }
  });

  // ── recipes ─────────────────────────────────────────────────────────────────
  app.get('/api/recipes/:id', (req, res) => {
    const recipe = store.getRecipe(req.params.id);
    if (!recipe) return res.status(404).json({ error: 'not_found' });
    return res.json(recipe);
  });

  // ── menu ──────────────────────────────────────────────────────────────────
  app.post('/api/menu/generate', requireAuth, (req, res) => {
    const userId = (req as AuthedRequest).userId as string;
    const profile = store.getProfile(userId);
    if (!profile) return res.status(400).json({ error: 'profile_required' });

    const premium = store.getTier(userId) === 'premium';
    const days = premium ? 7 : 3; // free = 3-day starter (§11)
    const needs = premium ? profile.needs : profile.needs.slice(0, 1); // free = 1 need honored
    const genProfile: UserProfile = { ...profile, needs };
    const seed = typeof req.body?.seed === 'string' ? req.body.seed : `${userId}:${Math.floor(now() / WEEK_MS)}`;

    const plan = generateWeekMenu(store.recipePool(), genProfile, { seed, days });
    store.saveMenu({ userId, plan, seed, createdAtMs: now() });
    return res.json({ plan, tier: premium ? 'premium' : 'free', days });
  });

  app.get('/api/menu/current', requireAuth, (req, res) => {
    const userId = (req as AuthedRequest).userId as string;
    const menu = store.getCurrentMenu(userId);
    if (!menu) return res.status(404).json({ error: 'no_menu' });
    return res.json(menu);
  });

  app.post('/api/menu/mixup', requireAuth, (req, res) => {
    const userId = (req as AuthedRequest).userId as string;
    const profile = store.getProfile(userId);
    if (!profile) return res.status(400).json({ error: 'profile_required' });
    const parsed = z.object({ recipeId: z.string(), slot: slotSchema }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'bad_request' });
    const recipe = store.getRecipe(parsed.data.recipeId);
    if (!recipe) return res.status(404).json({ error: 'recipe_not_found' });
    const alternatives = mixItUp(recipe, parsed.data.slot as MealSlot, store.recipePool(), profile);
    return res.json({ alternatives });
  });

  // ── event sync (opaque blob; server never parses in v1) ─────────────────────
  app.post('/api/sync/events', requireAuth, (req, res) => {
    const userId = (req as AuthedRequest).userId as string;
    const parsed = z.object({ blob: z.string(), count: z.number().int().nonnegative().optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'bad_request' });
    const id = randomUUID();
    store.appendEvents({ id, userId, receivedAtMs: now(), blob: parsed.data.blob, count: parsed.data.count ?? 0 });
    return res.json({ ok: true, id });
  });
  app.get('/api/sync/events', requireAuth, (req, res) => {
    const userId = (req as AuthedRequest).userId as string;
    const since = clampInt(req.query['since'], 0, 0, Number.MAX_SAFE_INTEGER);
    return res.json({ events: store.eventsSince(userId, since) });
  });

  // ── analytics (privacy-clean — NO food content, §10) ────────────────────────
  const analytics: Array<{ event: string; props: Record<string, unknown>; ts: number }> = [];
  const ANALYTICS_CAP = 5000;
  const ALLOWED_PROPS = new Set(['source', 'taps', 'ms', 'plan', 'granted', 'step', 'count', 'tier', 'reason']);
  const sanitize = (p: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p)) if (ALLOWED_PROPS.has(k)) out[k] = v;
    return out;
  };
  const analyticsEvent = z.object({
    event: z.string().min(1).max(64),
    props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    ts: z.number().optional(),
  });
  app.post('/api/analytics', (req, res) => {
    const parsed = z.object({ events: z.array(analyticsEvent).max(100) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'bad_request' });
    for (const e of parsed.data.events) {
      analytics.push({ event: e.event, props: sanitize(e.props ?? {}), ts: e.ts ?? now() });
    }
    if (analytics.length > ANALYTICS_CAP) analytics.splice(0, analytics.length - ANALYTICS_CAP);
    return res.json({ ok: true, received: parsed.data.events.length });
  });
  app.get('/api/analytics/summary', (_req, res) => {
    const byEvent: Record<string, number> = {};
    const taps: number[] = [];
    for (const e of analytics) {
      byEvent[e.event] = (byEvent[e.event] ?? 0) + 1;
      const t = e.props['taps'];
      if (e.event === 'log_completed' && typeof t === 'number') taps.push(t);
    }
    return res.json({ total: analytics.length, byEvent, medianTapsPerLog: median(taps) });
  });

  return app;
}
