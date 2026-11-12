import { getCatalogJson, type HttpContext } from '../core/http';
import { normalizeCategory, normalizeVariants, parseVariant, variantKey } from '../core/variants';
import type { CatalogFont, VariantKey } from '../types';
import type { FontProvider, FontRef } from './types';

interface FontsourceItem {
  id: string;
  family: string;
  subsets: string[];
  weights: number[];
  styles: string[];
  variable: boolean;
  lastModified?: string;
  category: string;
  type: string;
}

export function parseFontsource(json: FontsourceItem[], includeTypes: string[]): CatalogFont[] {
  return (json || [])
    .filter((f) => !includeTypes.length || includeTypes.includes(f.type))
    .map((f) => {
      const variants: VariantKey[] = [];
      for (const w of f.weights || []) {
        if (!f.styles?.length || f.styles.includes('normal')) variants.push(variantKey(w, false));
        if (f.styles?.includes('italic')) variants.push(variantKey(w, true));
      }
      return {
        key: `fontsource:${f.id}`,
        provider: 'fontsource',
        id: f.id,
        family: f.family,
        category: normalizeCategory(f.category),
        variants: normalizeVariants(variants),
        subsets: f.subsets || [],
        variable: !!f.variable,
        lastModified: f.lastModified,
        meta: f.type && f.type !== 'google' ? { type: f.type } : undefined,
      };
    });
}

export interface FontsourceProviderOptions {
  /**
   * Font types to include: `google`, `other` (non-Google open fonts), `icons`.
   * Default `['google', 'other']`.
   */
  types?: string[];
  /** npm version range of the `@fontsource/*` packages on jsDelivr. Default `5`. */
  packageVersion?: string;
  /** CDN base. Default `https://cdn.jsdelivr.net/npm`. */
  cdnBase?: string;
}

export function createFontsourceProvider(options: FontsourceProviderOptions = {}): FontProvider {
  const types = options.types || ['google', 'other'];
  const version = options.packageVersion || '5';
  const cdn = (options.cdnBase || 'https://cdn.jsdelivr.net/npm').replace(/\/+$/, '');
  return {
    id: 'fontsource',
    label: 'Fontsource',
    homepage: 'https://fontsource.org',
    async loadCatalog(ctx: HttpContext) {
      return parseFontsource(await getCatalogJson<FontsourceItem[]>(ctx, 'https://api.fontsource.org/v1/fonts'), types);
    },
    // Each @fontsource package has one stylesheet per weight/style (all subsets inside, with
    // unicode-range, so the browser downloads only the subsets the text actually uses).
    cssUrls(font: FontRef, variants: VariantKey[]) {
      return normalizeVariants(variants.length ? variants : ['400']).map((v) => {
        const p = parseVariant(v);
        return `${cdn}/@fontsource/${font.id}@${version}/${p.weight}${p.italic ? '-italic' : ''}.css`;
      });
    },
  };
}
