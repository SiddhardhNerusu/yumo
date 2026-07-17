import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localParts } from '@yumo/brain';
import { roundStorageKg } from '@yumo/shared';

const KEY = 'yumo.weight.v1';

export interface WeightEntry {
  /** local epoch day the weigh-in belongs to (one entry per day, newest wins). */
  day: number;
  kg: number;
  /** optional progress photo, persisted into the app's documents dir on native. */
  photoUri?: string;
  ts: number;
}

/** Copy a picked photo out of the picker's temp cache so it survives (native);
 * web URIs are kept as-is. Falls back to the original uri on any failure. */
export async function persistPhoto(uri: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  try {
    const FS = await import('expo-file-system/legacy');
    if (!FS.documentDirectory) return uri;
    const dir = `${FS.documentDirectory}progress-photos/`;
    await FS.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const ext = uri.includes('.png') ? 'png' : 'jpg';
    const dest = `${dir}w-${Date.now()}.${ext}`;
    await FS.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

/**
 * Real weigh-ins (the Progress hero). AsyncStorage-backed like the kitchen;
 * one entry per local day — re-logging a day updates it (and keeps its photo
 * unless a new one is attached).
 */
export function useWeights(nowMs: number) {
  const [entries, setEntries] = useState<WeightEntry[]>([]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (!alive || !v) return;
        try {
          const parsed = JSON.parse(v);
          if (Array.isArray(parsed)) setEntries((parsed as WeightEntry[]).sort((a, b) => a.day - b.day));
        } catch { /* ignore corrupt */ }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const write = useCallback((next: WeightEntry[]) => {
    const sorted = [...next].sort((a, b) => a.day - b.day);
    setEntries(sorted);
    AsyncStorage.setItem(KEY, JSON.stringify(sorted)).catch(() => {});
  }, []);

  const logWeight = useCallback((kg: number, photoUri?: string) => {
    const day = localParts(nowMs, 0).epochDay;
    setEntries((prev) => {
      const existing = prev.find((e) => e.day === day);
      const entry: WeightEntry = {
        day,
        kg: roundStorageKg(kg),
        ts: Date.now(),
        ...(photoUri ? { photoUri } : existing?.photoUri ? { photoUri: existing.photoUri } : {}),
      };
      const next = [...prev.filter((e) => e.day !== day), entry].sort((a, b) => a.day - b.day);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [nowMs]);

  const removePhoto = useCallback((day: number) => {
    setEntries((prev) => {
      const next = prev.map((e) => {
        if (e.day !== day) return e;
        const { photoUri: _drop, ...rest } = e;
        return rest as WeightEntry;
      });
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const deleteEntry = useCallback((day: number) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.day !== day);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { entries, logWeight, removePhoto, deleteEntry, write };
}
