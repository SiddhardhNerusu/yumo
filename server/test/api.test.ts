import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { MemoryStore } from '../src/db/store';

const NOW = 1_700_000_000_000;
let app: Express;
let store: MemoryStore;
let token = '';
let userId = '';
const bearer = () => `Bearer ${token}`;

beforeAll(async () => {
  store = new MemoryStore(NOW);
  app = createApp(store, () => NOW);
  const res = await request(app).post('/api/auth/dev').send({ providerId: 'tester', email: 'a@b.com' });
  token = res.body.token;
  userId = res.body.user.id;
});

describe('health & config', () => {
  it('reports health with a build string', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.build).toBe('string');
  });
  it('serves engine remote config', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.brain).toBeDefined();
    expect(res.body.menu.proteinFloorPerKg).toBeGreaterThan(0);
  });
});

describe('auth', () => {
  it('issues a session token via dev login', () => {
    expect(token).toBeTruthy();
    expect(userId).toBeTruthy();
  });
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(401);
  });
});

describe('profile', () => {
  it('is null before onboarding, then persists a PATCH', async () => {
    const before = await request(app).get('/api/profile').set('authorization', bearer());
    expect(before.body).toBeNull();

    const patch = await request(app)
      .patch('/api/profile')
      .set('authorization', bearer())
      .send({ budgetKcal: 2200, targetWeightKg: 78, goal: 'maintain', needs: ['chicken'], hates: ['tuna'], variation: 'balanced' });
    expect(patch.status).toBe(200);
    expect(patch.body.budgetKcal).toBe(2200);

    const after = await request(app).get('/api/profile').set('authorization', bearer());
    expect(after.body.needs).toEqual(['chicken']);
  });
});

describe('catalogue', () => {
  it('serves data-driven onboarding bubbles', async () => {
    const res = await request(app).get('/api/onboarding/bubbles?limit=50');
    expect(res.status).toBe(200);
    expect(res.body.bubbles.length).toBeGreaterThan(0);
    expect(res.body.bubbles[0]).toHaveProperty('token');
  });
  it('serves data-driven cuisines from live recipe counts (decision 5)', async () => {
    const res = await request(app).get('/api/onboarding/cuisines');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cuisines)).toBe(true);
    for (const cx of res.body.cuisines) {
      expect(cx).toHaveProperty('name');
      expect(cx.count).toBeGreaterThanOrEqual(3); // never an empty/hallucinated cuisine
      expect(cx.name.toLowerCase()).not.toBe('unknown');
    }
    // a high threshold surfaces no cuisine rather than inventing one.
    const strict = await request(app).get('/api/onboarding/cuisines?min=9999');
    expect(strict.body.cuisines.length).toBe(0);
  });
  it('bubbles echoes the round + locale params (§8.1)', async () => {
    const res = await request(app).get('/api/onboarding/bubbles?round=likes&locale=en-GB&limit=20');
    expect(res.status).toBe(200);
    expect(res.body.round).toBe('likes');
    expect(res.body.locale).toBe('en-GB');
    expect(res.body.bubbles.length).toBeGreaterThan(0);
  });
  it('searches foods', async () => {
    const res = await request(app).get('/api/foods/search?q=chicken%20breast&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.foods.length).toBeGreaterThan(0);
    expect(res.body.foods[0].per100g.kcal).toBeGreaterThan(0);
  });
  it('rejects a malformed barcode EAN without hitting the network', async () => {
    const res = await request(app).get('/api/foods/barcode/123');
    expect(res.status).toBe(400);
  });
  it('404s an unknown recipe', async () => {
    const res = await request(app).get('/api/recipes/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('menu (entitlement-gated)', () => {
  let recipeId = '';
  let dinnerId = '';

  it('free tier gets a 3-day starter menu', async () => {
    const res = await request(app).post('/api/menu/generate').set('authorization', bearer()).send({});
    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('free');
    expect(res.body.plan.days).toHaveLength(3);
    // every day honours the pinned need (chicken)
    for (const day of res.body.plan.days) {
      const hasChicken = day.picks.some((p: { recipe: { foodTokens: string[] } }) =>
        p.recipe.foodTokens.some((t) => t.includes('chicken')),
      );
      expect(hasChicken).toBe(true);
    }
    recipeId = res.body.plan.days[0].picks[0].recipe.id;
    dinnerId = res.body.plan.days[0].picks.find((p: { slot: string }) => p.slot === 'dinner')?.recipe.id ?? recipeId;
  });

  it('serves a recipe detail with steps', async () => {
    const res = await request(app).get(`/api/recipes/${recipeId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.steps)).toBe(true);
  });

  it('offers mix-it-up alternatives', async () => {
    const res = await request(app)
      .post('/api/menu/mixup')
      .set('authorization', bearer())
      .send({ recipeId: dinnerId, slot: 'dinner' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.alternatives)).toBe(true);
  });

  it('premium tier gets a full 7-day menu', async () => {
    store.setTier(userId, 'premium');
    const res = await request(app).post('/api/menu/generate').set('authorization', bearer()).send({});
    expect(res.body.tier).toBe('premium');
    expect(res.body.plan.days).toHaveLength(7);
  });
});

describe('menu swap + premium insights', () => {
  it('POST /api/menu/swap returns ranked alternatives (§8.1)', async () => {
    const gen = await request(app).post('/api/menu/generate').set('authorization', bearer()).send({});
    const picks = gen.body.plan.days[0].picks as Array<{ slot: string; recipe: { id: string } }>;
    const dinner = picks.find((p) => p.slot === 'dinner') ?? picks[0]!;
    const res = await request(app)
      .post('/api/menu/swap')
      .set('authorization', bearer())
      .send({ recipeId: dinner.recipe.id, slot: dinner.slot });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.alternatives)).toBe(true);
  });

  it('gates /api/insights via requirePremium: 402 free, 200 premium (§8.3)', async () => {
    store.setTier(userId, 'free');
    const free = await request(app).get('/api/insights').set('authorization', bearer());
    expect(free.status).toBe(402);
    expect(free.body.error).toBe('premium_required');

    store.setTier(userId, 'premium');
    const prem = await request(app).get('/api/insights').set('authorization', bearer());
    expect(prem.status).toBe(200);
    expect(prem.body.insights).toBeDefined();
  });
});

describe('event sync', () => {
  it('accepts an opaque blob and returns it since a timestamp', async () => {
    const post = await request(app)
      .post('/api/sync/events')
      .set('authorization', bearer())
      .send({ blob: 'ZW5jcnlwdGVkLWJsb2I=', count: 3 });
    expect(post.status).toBe(200);
    expect(post.body.ok).toBe(true);

    const get = await request(app).get('/api/sync/events?since=0').set('authorization', bearer());
    expect(get.body.events.length).toBeGreaterThanOrEqual(1);
    expect(get.body.events[0].blob).toBe('ZW5jcnlwdGVkLWJsb2I=');
  });
});
