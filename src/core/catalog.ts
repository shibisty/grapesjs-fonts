import type { CatalogFont, ProviderId } from '../types';
import type { FontProvider } from '../providers/types';
import type { CacheStore } from './cache';
import type { HttpContext } from './http';

export type ProviderStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ProviderState {
  status: ProviderStatus;
  fonts: CatalogFont[];
  error?: string;
  /** When the data came from the cache. */
  cached?: boolean;
}

export interface CatalogOptions {
  providers: FontProvider[];
  http: HttpContext;
  cache: CacheStore;
  /** Cache lifetime in ms. */
  cacheTtl: number;
}

const CACHE_VERSION = 1;

/**
 * Loads catalogues of all providers (in parallel, each independently: one failing provider does
 * not block the others), caches them and merges them into a single deduplicated list.
 */
export class Catalog {
  readonly states = new Map<ProviderId, ProviderState>();
  private pending = new Map<ProviderId, Promise<void>>();
  private listeners = new Set<() => void>();
  private mergedCache: { key: string; list: CatalogFont[] } | null = null;

  constructor(private opts: CatalogOptions) {
    for (const p of opts.providers) this.states.set(p.id, { status: 'idle', fonts: [] });
  }

  get providers(): FontProvider[] {
    return this.opts.providers;
  }

  getProvider(id: ProviderId): FontProvider | undefined {
    return this.opts.providers.find((p) => p.id === id);
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.mergedCache = null;
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('[grapesjs-fonts]', e);
      }
    });
  }

  private cacheKey(id: ProviderId) {
    return `catalog:${CACHE_VERSION}:${id}`;
  }

  /** Load every provider that is not loaded yet. Resolves when all have settled. */
  async loadAll(force = false): Promise<void> {
    await Promise.all(this.opts.providers.map((p) => this.load(p.id, force)));
  }

  load(id: ProviderId, force = false): Promise<void> {
    const provider = this.getProvider(id);
    if (!provider) return Promise.resolve();
    const state = this.states.get(id)!;
    if (!force && state.status === 'ready') return Promise.resolve();
    const running = this.pending.get(id);
    if (running) return running;

    if (!force) {
      const cached = this.opts.cache.get<CatalogFont[]>(this.cacheKey(id), this.opts.cacheTtl);
      if (cached && cached.length) {
        this.states.set(id, { status: 'ready', fonts: cached, cached: true });
        this.emit();
        return Promise.resolve();
      }
    }

    this.states.set(id, { ...state, status: 'loading', error: undefined });
    this.emit();
    const job = provider
      .loadCatalog(this.opts.http)
      .then((fonts) => {
        this.states.set(id, { status: 'ready', fonts });
        this.opts.cache.set(this.cacheKey(id), fonts);
      })
      .catch((err: unknown) => {
        console.error(`[grapesjs-fonts] ${provider.label}: catalogue failed to load`, err);
        this.states.set(id, { status: 'error', fonts: state.fonts, error: (err as Error)?.message || String(err) });
      })
      .finally(() => {
        this.pending.delete(id);
        this.emit();
      });
    this.pending.set(id, job);
    return job;
  }

  isLoading(): boolean {
    return Array.from(this.states.values()).some((s) => s.status === 'loading');
  }

  /**
   * Fonts of the given providers (all when empty), deduplicated by family name: the first provider
   * in the configured order wins, the others are recorded in `alternatives`. Popularity known for a
   * family from any provider is shared with the others (e.g. Bunny mirrors Google Fonts).
   */
  getFonts(providerIds: ProviderId[] = []): CatalogFont[] {
    const ids = providerIds.length ? this.opts.providers.map((p) => p.id).filter((id) => providerIds.includes(id)) : this.opts.providers.map((p) => p.id);
    const key = ids.join('|');
    if (this.mergedCache?.key === key) return this.mergedCache.list;
    const list = mergeCatalogs(ids.map((id) => this.states.get(id)?.fonts || []));
    this.mergedCache = { key, list };
    return list;
  }

  /** Look up a font by provider + id in loaded catalogues. */
  find(provider: ProviderId, id: string): CatalogFont | undefined {
    return this.states.get(provider)?.fonts.find((f) => f.id === id);
  }

  findByFamily(family: string): CatalogFont | undefined {
    const name = family.toLowerCase();
    return this.getFonts().find((f) => f.family.toLowerCase() === name);
  }
}

export function mergeCatalogs(lists: CatalogFont[][]): CatalogFont[] {
  const popularity = new Map<string, number>();
  for (const list of lists)
    for (const f of list) {
      if (f.popularity == null) continue;
      const k = f.family.toLowerCase();
      const prev = popularity.get(k);
      if (prev == null || f.popularity < prev) popularity.set(k, f.popularity);
    }
  const byFamily = new Map<string, CatalogFont>();
  for (const list of lists)
    for (const f of list) {
      const k = f.family.toLowerCase();
      const existing = byFamily.get(k);
      if (existing) {
        if (existing.provider !== f.provider && !existing.alternatives?.includes(f.provider))
          existing.alternatives = [...(existing.alternatives || []), f.provider];
        continue;
      }
      const pop = popularity.get(k);
      byFamily.set(k, { ...f, popularity: pop ?? f.popularity, alternatives: undefined });
    }
  return Array.from(byFamily.values());
}
