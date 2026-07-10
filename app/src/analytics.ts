import { api } from './api/client';

/**
 * Lightweight, privacy-clean analytics (§10). NEVER pass food names/content —
 * only structural props (source, taps, ms, plan, granted…). The server also
 * whitelists prop keys as a backstop. North-star: median taps-per-log.
 */
type Props = Record<string, string | number | boolean>;
interface Ev {
  event: string;
  props: Props;
  ts: number;
}

const buffer: Ev[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function track(event: string, props: Props = {}): void {
  buffer.push({ event, props, ts: Date.now() });
  if (buffer.length >= 20) {
    flush();
    return;
  }
  if (!timer) timer = setTimeout(flush, 4000);
}

export function flush(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (buffer.length === 0) return;
  const events = buffer.splice(0, buffer.length);
  api.postAnalytics(events).catch(() => {}); // offline-safe; drop on failure
}
