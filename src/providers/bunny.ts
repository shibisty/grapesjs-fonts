import { getCatalogJson, type HttpContext } from '../core/http';
import { normalizeCategory, normalizeVariants, parseVariant, variantKey } from '../core/variants';
import type { CatalogFont, VariantKey } from '../types';
import type { CssUrlOptions, FontProvider, FontRef } from './types';

interface BunnyMeta {
  [id: string]: {
    category: string;
    defSubset?: string;
    familyName: string;
    isVariable?: boolean;
    styles: string[];
    variants?: Record<string, number>;
    weights: number[];
  };
}

export function parseBunny(json: BunnyMeta): CatalogFont[] {
  return Object.entries(json || {}).map(([id, f]) => {
    const italic = (f.styles || []).includes('italic');
    const upright = !f.styles?.length || f.styles.includes('normal');
    const variants: VariantKey[] = [];
    for (const w of f.weights || []) {
      if (upright) variants.push(variantKey(w, false));
      if (italic) variants.push(variantKey(w, true));
    }
    return {
      key: `bunny:${id}`,
      provider: 'bunny',
      id,
      family: f.familyName,
      category: normalizeCategory(f.category),
      variants: normalizeVariants(variants),
      subsets: Object.keys(f.variants || {}),
      variable: !!f.isVariable,
    };
  });
}

export interface BunnyProviderOptions {
  cssBase?: string;
}

export function createBunnyProvider(options: BunnyProviderOptions = {}): FontProvider {
  const cssBase = options.cssBase || 'https://fonts.bunny.net/css';
  return {
    id: 'bunny',
    label: 'Bunny Fonts',
    homepage: 'https://fonts.bunny.net',
    async loadCatalog(ctx: HttpContext) {
      return parseBunny(await getCatalogJson<BunnyMeta>(ctx, 'https://fonts.bunny.net/list'));
    },
    cssUrls(font: FontRef, variants: VariantKey[], opts: CssUrlOptions = {}) {
      const list = normalizeVariants(variants.length ? variants : ['400'])
        .map(parseVariant)
        .map((p) => `${p.weight}${p.italic ? 'i' : ''}`);
      return [`${cssBase}?family=${encodeURIComponent(font.id)}:${list.join(',')}&display=${opts.display || 'swap'}`];
    },
  };
}
