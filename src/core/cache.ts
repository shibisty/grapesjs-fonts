/** Tiny TTL cache over localStorage. All failures (quota, private mode, disabled storage) are ignored. */

export interface CacheStore {
  get<T>(key: string, maxAgeMs: number): T | undefined;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

interface Entry<T> {
  t: number;
  v: T;
}

export function createLocalStorageCache(prefix: string, storage?: Storage | null): CacheStore {
  const ls = (): Storage | null => {
    try {
      return storage !== undefined ? storage : typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      return null;
    }
  };
  return {
    get<T>(key: string, maxAgeMs: number): T | undefined {
      try {
        const raw = ls()?.getItem(prefix + key);
        if (!raw) return undefined;
        const entry = JSON.parse(raw) as Entry<T>;
        if (!entry || typeof entry.t !== 'number' || Date.now() - entry.t > maxAgeMs) return undefined;
        return entry.v;
      } catch {
        return undefined;
      }
    },
    set<T>(key: string, value: T) {
      try {
        ls()?.setItem(prefix + key, JSON.stringify({ t: Date.now(), v: value } as Entry<T>));
      } catch {
        /* quota exceeded or storage unavailable: just don't cache */
      }
    },
    remove(key: string) {
      try {
        ls()?.removeItem(prefix + key);
      } catch {
        /* ignore */
      }
    },
  };
}

export function createMemoryCache(): CacheStore {
  const map = new Map<string, Entry<unknown>>();
  return {
    get<T>(key: string, maxAgeMs: number) {
      const e = map.get(key);
      return e && Date.now() - e.t <= maxAgeMs ? (e.v as T) : undefined;
    },
    set(key, value) {
      map.set(key, { t: Date.now(), v: value });
    },
    remove(key) {
      map.delete(key);
    },
  };
}
