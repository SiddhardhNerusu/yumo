import type { WeekMenuPlan, MenuRecipe } from '@yumo/menu';

/**
 * Server API client. Base URL is compile-time via EXPO_PUBLIC_API_BASE (Expo
 * inlines EXPO_PUBLIC_*). On a physical device, set it to your machine's LAN IP
 * or the deployed URL — `localhost` only works for web / simulator.
 */
export const API_BASE = process.env['EXPO_PUBLIC_API_BASE'] ?? 'http://localhost:8080';

let token: string | null = null;
export function setToken(t: string | null): void {
  token = t;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

export interface DevLoginResp {
  token: string;
  user: { id: string; email: string | null; tier: string };
}
export interface Bubble {
  token: string;
  weight: number;
}

export const api = {
  health: () => req<{ status: string; build: string }>('/api/health'),
  getConfig: () => req<{ version: string; coach?: Record<string, string | string[]> }>('/api/config'),
  postAnalytics: (events: Array<{ event: string; props?: Record<string, string | number | boolean>; ts?: number }>) =>
    req<{ ok: boolean; received: number }>('/api/analytics', { method: 'POST', body: JSON.stringify({ events }) }),
  devLogin: (providerId: string) =>
    req<DevLoginResp>('/api/auth/dev', { method: 'POST', body: JSON.stringify({ providerId }) }),
  patchProfile: (profile: Record<string, unknown>) =>
    req<unknown>('/api/profile', { method: 'PATCH', body: JSON.stringify(profile) }),
  bubbles: (limit = 40) => req<{ bubbles: Bubble[] }>(`/api/onboarding/bubbles?limit=${limit}`),
  generateMenu: (seed?: string) =>
    req<{ plan: WeekMenuPlan; tier: string; days: number }>('/api/menu/generate', {
      method: 'POST',
      body: JSON.stringify(seed ? { seed } : {}),
    }),
  mixup: (recipeId: string, slot: string) =>
    req<{ alternatives: MenuRecipe[] }>('/api/menu/mixup', {
      method: 'POST',
      body: JSON.stringify({ recipeId, slot }),
    }),
  recipe: (id: string) => req<{ id: string; name: string; steps: string[] }>(`/api/recipes/${id}`),
  foodsSearch: (q: string, limit = 20) =>
    req<{ foods: Array<{ fdcId: number; description: string; per100g: Record<string, number> }> }>(
      `/api/foods/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),
  barcode: (ean: string) =>
    req<{ food: { fdcId: number; description: string; per100g: Record<string, number>; source: string } }>(
      `/api/foods/barcode/${encodeURIComponent(ean)}`,
    ),
  syncEvents: (blob: string, count: number) =>
    req<{ ok: boolean; id: string }>('/api/sync/events', {
      method: 'POST',
      body: JSON.stringify({ blob, count }),
    }),
};
