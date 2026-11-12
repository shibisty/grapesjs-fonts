import type { FontCategory, ParsedVariant, VariantKey } from '../types';

export function parseVariant(key: VariantKey): ParsedVariant {
  const italic = /i$/.test(key);
  const weight = parseInt(key, 10);
  return { weight: Number.isFinite(weight) ? weight : 400, italic };
}

export function variantKey(weight: number, italic: boolean): VariantKey {
  return `${weight}${italic ? 'i' : ''}`;
}

export function compareVariants(a: VariantKey, b: VariantKey): number {
  const pa = parseVariant(a);
  const pb = parseVariant(b);
  return pa.weight - pb.weight || Number(pa.italic) - Number(pb.italic);
}

/** Dedupe + sort variant keys. */
export function normalizeVariants(keys: Iterable<VariantKey>): VariantKey[] {
  return Array.from(new Set(keys)).sort(compareVariants);
}

/** Google API variant names: `regular`, `italic`, `700`, `700italic`. */
export function fromGoogleVariant(name: string): VariantKey | null {
  if (name === 'regular') return '400';
  if (name === 'italic') return '400i';
  const m = /^(\d{3})(italic)?$/.exec(name);
  return m ? variantKey(Number(m[1]), !!m[2]) : null;
}

export function hasItalic(variants: VariantKey[]): boolean {
  return variants.some((v) => v.endsWith('i'));
}

export function weightsOf(variants: VariantKey[]): number[] {
  return Array.from(new Set(variants.map((v) => parseVariant(v).weight))).sort((a, b) => a - b);
}

/** The variant closest to regular 400 (used for previews). */
export function previewVariant(variants: VariantKey[]): VariantKey {
  if (!variants.length) return '400';
  const upright = variants.filter((v) => !v.endsWith('i'));
  const pool = upright.length ? upright : variants;
  return pool.reduce((best, v) =>
    Math.abs(parseVariant(v).weight - 400) < Math.abs(parseVariant(best).weight - 400) ? v : best,
  );
}

/** Sensible default selection when a font is added: regular + bold (+ italics of those, if present). */
export function defaultVariants(variants: VariantKey[]): VariantKey[] {
  const wanted = ['400', '700', '400i', '700i'].filter((v) => variants.includes(v));
  return wanted.length ? normalizeVariants(wanted) : [previewVariant(variants)];
}

export function normalizeCategory(raw: string | undefined | null): FontCategory {
  const c = String(raw || '').toLowerCase().replace(/[_\s]+/g, '-');
  if (!c) return 'other';
  if (c.includes('mono')) return 'monospace';
  if (c.includes('sans')) return 'sans-serif';
  if (c.includes('serif') || c.includes('slab')) return 'serif';
  if (c.includes('display') || c.includes('decorative')) return 'display';
  if (c.includes('hand') || c.includes('script') || c.includes('cursive') || c.includes('calligraph')) return 'handwriting';
  return 'other';
}

export function genericFallback(category: FontCategory): string {
  switch (category) {
    case 'serif':
      return 'serif';
    case 'monospace':
      return 'monospace';
    case 'handwriting':
      return 'cursive';
    default:
      return 'sans-serif';
  }
}

/** Quote a family name for CSS if it is not a plain identifier sequence. Single quotes: safe inside HTML attributes. */
export function quoteFamily(family: string): string {
  const clean = family.replace(/['"\\]/g, '').trim();
  return /^[a-zA-Z][a-zA-Z0-9-]*( [a-zA-Z][a-zA-Z0-9-]*)*$/.test(clean) && !/\s/.test(clean)
    ? clean
    : `'${clean}'`;
}

export function fontFamilyValue(family: string, category: FontCategory): string {
  return `${quoteFamily(family)}, ${genericFallback(category)}`;
}

/** First family name from a `font-family` value, without quotes. */
export function firstFamily(value: string | undefined | null): string {
  if (!value) return '';
  const first = String(value).split(',')[0] || '';
  return first.trim().replace(/^['"]|['"]$/g, '').trim();
}
