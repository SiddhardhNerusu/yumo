/**
 * Showcase/demo data — the seeded meal history, the example starter fridge, the
 * sample weight trend, and the canned "receipt fly-in" — is for the dev preview
 * and screenshots ONLY. A real user (including a TestFlight dogfood build) must
 * start with an honest, empty slate: their ring, streak, and fridge reflect what
 * THEY actually did, never a fabricated persona.
 *
 * `__DEV__` is true under `expo start` (browser preview, dev client) and false in
 * EAS production builds — so the preview stays populated while shipping honest.
 * Flip this one constant if you ever want a populated demo on device.
 */
declare const __DEV__: boolean | undefined;

export const DEMO_DATA: boolean = typeof __DEV__ !== 'undefined' ? !!__DEV__ : false;
