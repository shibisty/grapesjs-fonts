import { getCatalogJson, type HttpContext } from '../core/http';
import { normalizeCategory, normalizeVariants, variantKey } from '../core/variants';
import type { CatalogFont, VariantKey } from '../types';
import type { CssUrlOptions, FontProvider, FontRef } from './types';

interface FontshareStyle {
  is_italic: boolean;
  is_variable: boolean;
  weight: { number: number; weight: number };
}

interface FontshareFont {
  slug: string;
  name: string;
  category: string;
  styles: FontshareStyle[];
  axes?: unknown[];
}

interface FontsharePage {
  fonts: FontshareFont[];
  has_more?: boolean;
}

export function parseFontshare(fonts: FontshareFont[]): CatalogFont[] {
  return (fonts || []).map((f) => {
    // Fontshare addresses a style by its "number" (e.g. 400 = Regular, 401 = Italic).
    const numbers: Record<string, number> = {};
    let variable = false;
    for (const s of f.styles || []) {
      if (s.is_variable) {
        variable = true;
        continue;
      }
      const w = Number(s.weight?.weight);
      if (!Number.isFinite(w) || w <= 0) continue;
      numbers[variantKey(w, !!s.is_italic)] = Number(s.weight.number);
    }
    const variants = normalizeVariants(Object.keys(numbers));
    return {
      key: `fontshare:${f.slug}`,
      provider: 'fontshare',
      id: f.slug,
      family: f.name,
      category: normalizeCategory(f.category),
      variants,
      // Fontshare fonts cover Latin (and Latin Extended); the API exposes no subset list.
      subsets: ['latin', 'latin-ext'],
      variable,
      meta: { numbers },
    };
  });
}

export interface FontshareProviderOptions {
  cssBase?: string;
}

export function createFontshareProvider(options: FontshareProviderOptions = {}): FontProvider {
  const cssBase = options.cssBase || 'https://api.fontshare.com/v2/css';
  return {
    id: 'fontshare',
    label: 'Fontshare',
    homepage: 'https://www.fontshare.com',
    async loadCatalog(ctx: HttpContext) {
      const all: FontshareFont[] = [];
      const limit = 100;
      for (let page = 0, offset = 0; page < 30; page++, offset += limit) {
        const chunk = await getCatalogJson<FontsharePage>(
          ctx,
          `https://api.fontshare.com/v2/fonts?offset=${offset}&limit=${limit}`,
        );
        all.push(...(chunk.fonts || []));
        if (!chunk.has_more || !chunk.fonts?.length) break;
      }
      return parseFontshare(all);
    },
    cssUrls(font: FontRef, variants: VariantKey[], opts: CssUrlOptions = {}) {
      const numbers = ((font.meta && font.meta.numbers) || {}) as Record<string, number>;
      const wanted = normalizeVariants(variants.length ? variants : ['400'])
        .map((v) => numbers[v])
        .filter((n): n is number => typeof n === 'number');
      const list = wanted.length ? wanted : [400];
      return [`${cssBase}?f[]=${encodeURIComponent(font.id)}@${list.join(',')}&display=${opts.display || 'swap'}`];
    },
  };
}
