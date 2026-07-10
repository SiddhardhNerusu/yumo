import { randomUUID } from 'node:crypto';
import express, { type Express, type Request, type Response } from 'express';
import { z } from 'zod';
import { ALLERGENS, MEAL_SLOTS, type Allergen, type MealSlot } from '@usual/shared';
import { generateWeekMenu, mixItUp, type UserProfile } from '@usual/menu';
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
  app.get('/api/foods/barcode/:ean', (_req, res) => {
    return res.status(501).json({ error: 'barcode_not_wired', note: 'OpenFoodFacts integration pending' });
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

  return app;
}
