import type { CatalogFont, FontCategory, ProviderId } from '../types';
import { hasItalic, parseVariant } from './variants';

export type SortMode = 'popular' | 'name' | 'name-desc' | 'newest' | 'styles';

export const SORT_MODES: SortMode[] = ['popular', 'name', 'name-desc', 'newest', 'styles'];

export interface CatalogQuery {
  search: string;
  /** Empty = all providers. */
  providers: ProviderId[];
  /** Empty = all categories. */
  categories: FontCategory[];
  /** '' = any subset. */
  subset: string;
  variableOnly: boolean;
  italicOnly: boolean;
  /** Only fonts that have this weight (0 = any). */
  weight: number;
  sort: SortMode;
  /** 1-based. */
  page: number;
  pageSize: number;
}

export const DEFAULT_QUERY: CatalogQuery = {
  search: '',
  providers: [],
  categories: [],
  subset: '',
  variableOnly: false,
  italicOnly: false,
  weight: 0,
  sort: 'popular',
  page: 1,
  pageSize: 24,
};

export interface QueryResult {
  items: CatalogFont[];
  total: number;
  page: number;
  pages: number;
  /** Index (0-based) of the first item on the page within the filtered list. */
  offset: number;
}

/** Lower-case, strip diacritics, collapse separators. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s_\-.]+/g, ' ')
    .trim();
}

/**
 * Search score: 0 = no match. Exact > prefix > word prefix > substring > compact substring
 * ("opensans" matches "Open Sans") > all tokens present.
 */
export function searchScore(family: string, search: string): number {
  const q = normalizeName(search);
  if (!q) return 1;
  const name = normalizeName(family);
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.split(' ').some((w) => w.startsWith(q))) return 60;
  if (name.includes(q)) return 40;
  const compactQ = q.replace(/ /g, '');
  if (compactQ && name.replace(/ /g, '').includes(compactQ)) return 30;
  const tokens = q.split(' ').filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => name.includes(t))) return 20;
  return 0;
}

const collator = typeof Intl !== 'undefined' ? new Intl.Collator('en', { sensitivity: 'base', numeric: true }) : null;
const byName = (a: CatalogFont, b: CatalogFont) =>
  collator ? collator.compare(a.family, b.family) : a.family.localeCompare(b.family);

export function compareFonts(sort: SortMode): (a: CatalogFont, b: CatalogFont) => number {
  switch (sort) {
    case 'name':
      return byName;
    case 'name-desc':
      return (a, b) => byName(b, a);
    case 'newest':
      return (a, b) => (b.lastModified || '').localeCompare(a.lastModified || '') || byName(a, b);
    case 'styles':
      return (a, b) => b.variants.length - a.variants.length || byName(a, b);
    case 'popular':
    default:
      // Fonts without popularity data go after ranked ones, alphabetically.
      return (a, b) => {
        const pa = a.popularity ?? Number.POSITIVE_INFINITY;
        const pb = b.popularity ?? Number.POSITIVE_INFINITY;
        return pa === pb ? byName(a, b) : pa - pb;
      };
  }
}

export function filterFonts(fonts: CatalogFont[], q: Partial<CatalogQuery>): CatalogFont[] {
  const cats = q.categories || [];
  const provs = q.providers || [];
  return fonts.filter((f) => {
    if (provs.length && !provs.includes(f.provider) && !(f.alternatives || []).some((p) => provs.includes(p))) return false;
    if (cats.length && !cats.includes(f.category)) return false;
    if (q.subset && !f.subsets.includes(q.subset)) return false;
    if (q.variableOnly && !f.variable) return false;
    if (q.italicOnly && !hasItalic(f.variants)) return false;
    if (q.weight && !f.variants.some((v) => parseVariant(v).weight === q.weight)) return false;
    return true;
  });
}

export function runQuery(fonts: CatalogFont[], query: Partial<CatalogQuery>): QueryResult {
  const q = { ...DEFAULT_QUERY, ...query };
  let list = filterFonts(fonts, q);
  const cmp = compareFonts(q.sort);
  if (q.search.trim()) {
    const scored = list
      .map((f) => ({ f, s: searchScore(f.family, q.search) }))
      .filter((x) => x.s > 0);
    // Relevance first, then the selected order.
    scored.sort((a, b) => b.s - a.s || cmp(a.f, b.f));
    list = scored.map((x) => x.f);
  } else {
    list = list.slice().sort(cmp);
  }
  const pageSize = Math.max(1, Math.floor(q.pageSize) || DEFAULT_QUERY.pageSize);
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(q.page) || 1), pages);
  const offset = (page - 1) * pageSize;
  return { items: list.slice(offset, offset + pageSize), total, page, pages, offset };
}

/** Subsets present in the catalogue, most common first (for the subset filter). */
export function collectSubsets(fonts: CatalogFont[]): string[] {
  const count = new Map<string, number>();
  for (const f of fonts) for (const s of f.subsets) count.set(s, (count.get(s) || 0) + 1);
  return Array.from(count.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([s]) => s);
}

/** Page numbers for a compact pager: 1 … 4 5 [6] 7 8 … 40. `0` marks a gap. */
export function pagerPages(page: number, pages: number, around = 2): number[] {
  if (pages <= 1) return [1];
  const set = new Set<number>([1, pages]);
  for (let p = page - around; p <= page + around; p++) if (p >= 1 && p <= pages) set.add(p);
  const sorted = Array.from(set).sort((a, b) => a - b);
  const out: number[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) {
      // A gap of exactly one page is shown as that page rather than "…".
      if (p - sorted[i - 1] === 2) out.push(p - 1);
      else out.push(0);
    }
    out.push(p);
  });
  return out;
}
