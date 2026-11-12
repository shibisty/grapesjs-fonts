import { describe, expect, it, vi } from 'vitest';
import { createLocalStorageCache, createMemoryCache } from '../src/core/cache';
import { Catalog, mergeCatalogs } from '../src/core/catalog';
import type { FontProvider } from '../src/providers/types';
import type { CatalogFont } from '../src/types';

const font = (provider: string, family: string, extra: Partial<CatalogFont> = {}): CatalogFont => ({
  key: `${provider}:${family}`, provider, id: family, family, category: 'serif', variants: ['400'], subsets: [], variable: false, ...extra,
});

const provider = (id: string, load: () => Promise<CatalogFont[]>): FontProvider => ({ id, label: id, loadCatalog: load, cssUrls: () => [] });
const http = { fetch: fetch, proxy: false as const, timeout: 1000 };

describe('mergeCatalogs', () => {
  it('dedupes by family (first wins), records alternatives and shares popularity', () => {
    const merged = mergeCatalogs([
      [font('google', 'Lora')],
      [font('bunny', 'lora', { popularity: 5 }), font('bunny', 'Only Bunny')],
    ]);
    expect(merged.map((f) => [f.provider, f.family, f.popularity, f.alternatives])).toEqual([
      ['google', 'Lora', 5, ['bunny']],
      ['bunny', 'Only Bunny', undefined, undefined],
    ]);
  });
});

describe('Catalog', () => {
  it('loads providers independently: one failure does not block others', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = new Catalog({
      providers: [provider('a', async () => [font('a', 'A')]), provider('b', async () => { throw new Error('boom'); })],
      http, cache: createMemoryCache(), cacheTtl: 1000,
    });
    const changes = vi.fn();
    c.onChange(changes);
    await c.loadAll();
    expect(c.states.get('a')?.status).toBe('ready');
    expect(c.states.get('b')).toMatchObject({ status: 'error', error: 'boom' });
    expect(c.getFonts().map((f) => f.family)).toEqual(['A']);
    expect(changes).toHaveBeenCalled();
    err.mockRestore();
  });

  it('serves from cache, dedupes concurrent loads and reloads on force', async () => {
    const load = vi.fn(async () => [font('a', 'A')]);
    const cache = createMemoryCache();
    const mk = () => new Catalog({ providers: [provider('a', load)], http, cache, cacheTtl: 60_000 });
    const c1 = mk();
    await Promise.all([c1.load('a'), c1.load('a')]);
    expect(load).toHaveBeenCalledTimes(1);
    const c2 = mk();
    await c2.load('a');
    expect(load).toHaveBeenCalledTimes(1);
    expect(c2.states.get('a')?.cached).toBe(true);
    await c2.load('a', true);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('filters merged fonts by provider ids and finds by family', async () => {
    const c = new Catalog({
      providers: [provider('a', async () => [font('a', 'X')]), provider('b', async () => [font('b', 'X'), font('b', 'Y')])],
      http, cache: createMemoryCache(), cacheTtl: 1000,
    });
    await c.loadAll();
    expect(c.getFonts().map((f) => f.key)).toEqual(['a:X', 'b:Y']);
    expect(c.getFonts(['b']).map((f) => f.key)).toEqual(['b:X', 'b:Y']);
    expect(c.findByFamily('x')?.provider).toBe('a');
    expect(c.find('b', 'Y')?.family).toBe('Y');
  });
});

describe('localStorage cache', () => {
  it('expires entries and survives broken storage', () => {
    const cache = createLocalStorageCache('t:');
    cache.set('k', [1, 2]);
    expect(cache.get('k', 10_000)).toEqual([1, 2]);
    expect(cache.get('k', -1)).toBeUndefined();
    const broken = createLocalStorageCache('t:', { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => {} } as unknown as Storage);
    expect(() => broken.set('k', 1)).not.toThrow();
    expect(broken.get('k', 1000)).toBeUndefined();
  });
});
