import { MemoryStore, type Store } from './store';

/**
 * Store factory. Uses the in-memory store today (seeded from the catalogue). A
 * Postgres adapter (schema in server/migrations/) is the documented next step;
 * until it exists, a set DATABASE_URL fails loudly rather than silently using
 * memory in production.
 */
export function createStore(now: number = Date.now()): Store {
  if (process.env['DATABASE_URL']) {
    throw new Error(
      'Postgres adapter not yet implemented — see server/migrations/*.sql. ' +
        'Unset DATABASE_URL to use the in-memory store.',
    );
  }
  return new MemoryStore(now);
}

export { MemoryStore } from './store';
export type { Store } from './store';
