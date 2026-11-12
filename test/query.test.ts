import { describe, expect, it } from 'vitest';
import { collectSubsets, filterFonts, pagerPages, runQuery, searchScore } from '../src/core/query';
import type { CatalogFont } from '../src/types';

const f = (family: string, p: Partial<CatalogFont> = {}): CatalogFont => ({
  key: `google:${family}`, provider: 'google', id: family, family, category: 'sans-serif',
  variants: ['400'], subsets: ['latin'], variable: false, ...p,
});

const fonts = [
  f('Roboto', { popularity: 1, variants: ['100', '400', '400i', '700'], subsets: ['latin', 'cyrillic'], variable: true, lastModified: '2024-05-01' }),
  f('Open Sans', { popularity: 2, variants: ['400', '700'], subsets: ['latin', 'cyrillic', 'greek'], lastModified: '2025-01-01' }),
  f('Lora', { category: 'serif', popularity: 30, variants: ['400', '400i'] }),
  f('Roboto Slab', { category: 'serif', variants: ['400', '700'], subsets: ['latin', 'cyrillic'] }),
  f('Satoshi', { provider: 'fontshare', key: 'fontshare:satoshi', id: 'satoshi' }),
  f('Émoji Dísplay', { category: 'display' }),
];

describe('searchScore', () => {
  it('ranks exact > prefix > word prefix > substring > compact', () => {
    expect(searchScore('Roboto', 'roboto')).toBe(100);
    expect(searchScore('Roboto Slab', 'robo')).toBe(80);
    expect(searchScore('Roboto Slab', 'slab')).toBe(60);
    expect(searchScore('Roboto Slab', 'bot')).toBe(40);
    expect(searchScore('Open Sans', 'opensans')).toBe(30);
    expect(searchScore('Open Sans', 'sans open')).toBe(20);
    expect(searchScore('Open Sans', 'xyz')).toBe(0);
  });
  it('ignores diacritics and separators', () => {
    expect(searchScore('Émoji Dísplay', 'emoji-display')).toBeGreaterThan(0);
  });
});

describe('runQuery', () => {
  it('sorts by popularity, unranked last alphabetically', () => {
    expect(runQuery(fonts, { sort: 'popular' }).items.map((x) => x.family)).toEqual(['Roboto', 'Open Sans', 'Lora', 'Émoji Dísplay', 'Roboto Slab', 'Satoshi']);
  });
  it('sorts by name, newest and number of styles', () => {
    expect(runQuery(fonts, { sort: 'name' }).items[0].family).toBe('Émoji Dísplay');
    expect(runQuery(fonts, { sort: 'name-desc' }).items[0].family).toBe('Satoshi');
    expect(runQuery(fonts, { sort: 'newest' }).items.slice(0, 2).map((x) => x.family)).toEqual(['Open Sans', 'Roboto']);
    expect(runQuery(fonts, { sort: 'styles' }).items[0].family).toBe('Roboto');
  });
  it('search puts relevance before the chosen order', () => {
    expect(runQuery(fonts, { search: 'roboto', sort: 'name-desc' }).items.map((x) => x.family)).toEqual(['Roboto', 'Roboto Slab']);
  });
  it('filters by category, subset, variable, italic, weight and provider', () => {
    expect(filterFonts(fonts, { categories: ['serif'] }).map((x) => x.family)).toEqual(['Lora', 'Roboto Slab']);
    expect(filterFonts(fonts, { subset: 'cyrillic' }).length).toBe(3);
    expect(filterFonts(fonts, { variableOnly: true }).map((x) => x.family)).toEqual(['Roboto']);
    expect(filterFonts(fonts, { italicOnly: true }).map((x) => x.family)).toEqual(['Roboto', 'Lora']);
    expect(filterFonts(fonts, { weight: 700 }).length).toBe(3);
    expect(filterFonts(fonts, { providers: ['fontshare'] }).map((x) => x.family)).toEqual(['Satoshi']);
    expect(filterFonts([f('X', { alternatives: ['bunny'] })], { providers: ['bunny'] }).length).toBe(1);
  });
  it('paginates and clamps the page', () => {
    const many = Array.from({ length: 50 }, (_, i) => f(`Font ${String(i).padStart(2, '0')}`));
    const r = runQuery(many, { sort: 'name', pageSize: 24, page: 3 });
    expect([r.page, r.pages, r.total, r.offset, r.items.length]).toEqual([3, 3, 50, 48, 2]);
    expect(runQuery(many, { pageSize: 24, page: 99 }).page).toBe(3);
    expect(runQuery([], { page: 5 })).toMatchObject({ page: 1, pages: 1, total: 0 });
  });
});

describe('helpers', () => {
  it('collects subsets by frequency', () => {
    expect(collectSubsets(fonts).slice(0, 2)).toEqual(['latin', 'cyrillic']);
  });
  it('builds compact pager', () => {
    expect(pagerPages(1, 1)).toEqual([1]);
    expect(pagerPages(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pagerPages(10, 40)).toEqual([1, 0, 8, 9, 10, 11, 12, 0, 40]);
    expect(pagerPages(4, 40)).toEqual([1, 2, 3, 4, 5, 6, 0, 40]);
  });
});
