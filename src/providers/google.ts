import { getCatalogJson, getJson, type HttpContext } from '../core/http';
import { fromGoogleVariant, normalizeCategory, normalizeVariants, parseVariant } from '../core/variants';
import type { CatalogFont, VariantKey } from '../types';
import type { CssUrlOptions, FontProvider, FontRef } from './types';

export interface GoogleProviderOptions {
  /**
   * Google Fonts Developer API key (free). When set, the catalogue comes from
   * `www.googleapis.com/webfonts/v1/webfonts?sort=popularity` (CORS-enabled, with popularity order).
   */
  apiKey?: string;
  /**
   * Keyless CORS-enabled fallback catalogue: the `google-font-metadata` npm package on jsDelivr
   * (no popularity data). Set to `false` to disable.
   */
  jsdelivrPackage?: string | false;
  /** CSS API base. Default `https://fonts.googleapis.com/css2`. */
  cssBase?: string;
}

interface DevApiItem {
  family: string;
  variants: string[];
  subsets: string[];
  category: string;
  lastModified?: string;
  axes?: Array<{ tag: string }>;
}

interface MetadataItem {
  family: string;
  category: string;
  subsets: string[];
  fonts: Record<string, unknown>;
  axes?: Array<{ tag: string }>;
  lastModified?: string;
  dateAdded?: string;
  popularity?: number;
}

interface VariableItem {
  family: string;
}

function makeFont(p: {
  family: string;
  category: string;
  variants: VariantKey[];
  subsets: string[];
  variable: boolean;
  lastModified?: string;
  popularity?: number;
}): CatalogFont {
  return {
    key: `google:${p.family}`,
    provider: 'google',
    id: p.family,
    family: p.family,
    category: normalizeCategory(p.category),
    variants: normalizeVariants(p.variants),
    subsets: (p.subsets || []).filter((s) => s !== 'menu'),
    variable: p.variable,
    lastModified: p.lastModified,
    popularity: p.popularity,
  };
}

export function parseDevApi(json: { items?: DevApiItem[] }): CatalogFont[] {
  return (json.items || []).map((it, i) =>
    makeFont({
      family: it.family,
      category: it.category,
      variants: it.variants.map(fromGoogleVariant).filter((v): v is string => !!v),
      subsets: it.subsets,
      variable: !!it.axes?.length,
      lastModified: it.lastModified,
      popularity: i + 1,
    }),
  );
}

export function parseMetadata(json: { familyMetadataList?: MetadataItem[] }): CatalogFont[] {
  const list = json.familyMetadataList || [];
  return list.map((it) =>
    makeFont({
      family: it.family,
      category: it.category,
      // keys look like "400", "400i", "700"
      variants: Object.keys(it.fonts || {}).filter((k) => /^\d{3}i?$/.test(k)),
      subsets: it.subsets,
      variable: !!it.axes?.length,
      lastModified: it.lastModified || it.dateAdded,
      popularity: typeof it.popularity === 'number' && it.popularity > 0 ? it.popularity : undefined,
    }),
  );
}

export function parseJsdelivr(items: DevApiItem[], variable: VariableItem[] | null): CatalogFont[] {
  const vf = new Set((variable || []).map((v) => v.family));
  return items.map((it) =>
    makeFont({
      family: it.family,
      category: it.category,
      variants: it.variants.map(fromGoogleVariant).filter((v): v is string => !!v),
      subsets: it.subsets,
      variable: vf.has(it.family),
      lastModified: it.lastModified,
    }),
  );
}

/** Builds the css2 `family=` parameter, e.g. `Open+Sans:ital,wght@0,400;0,700;1,400`. */
export function googleFamilyParam(family: string, variants: VariantKey[]): string {
  const name = family.trim().replace(/\s+/g, '+');
  const parsed = normalizeVariants(variants).map(parseVariant);
  if (!parsed.length) return name;
  const italic = parsed.some((p) => p.italic);
  if (!italic) {
    if (parsed.length === 1 && parsed[0].weight === 400) return name;
    return `${name}:wght@${parsed.map((p) => p.weight).join(';')}`;
  }
  const tuples = parsed
    .map((p) => [p.italic ? 1 : 0, p.weight] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([i, w]) => `${i},${w}`);
  return `${name}:ital,wght@${tuples.join(';')}`;
}

export function createGoogleProvider(options: GoogleProviderOptions = {}): FontProvider {
  const pkg = options.jsdelivrPackage === undefined ? 'google-font-metadata@6' : options.jsdelivrPackage;
  const cssBase = options.cssBase || 'https://fonts.googleapis.com/css2';
  return {
    id: 'google',
    label: 'Google Fonts',
    homepage: 'https://fonts.google.com',
    async loadCatalog(ctx: HttpContext) {
      const errors: unknown[] = [];
      if (options.apiKey) {
        try {
          const url = `https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&capability=VF&key=${encodeURIComponent(options.apiKey)}`;
          const fonts = parseDevApi(await getJson(ctx, url));
          if (fonts.length) return fonts;
        } catch (e) {
          errors.push(e);
        }
      }
      if (ctx.proxy) {
        try {
          const fonts = parseMetadata(await getCatalogJson(ctx, 'https://fonts.google.com/metadata/fonts'));
          if (fonts.length) return fonts;
        } catch (e) {
          errors.push(e);
        }
      }
      if (pkg) {
        const base = `https://cdn.jsdelivr.net/npm/${pkg}/data`;
        const [items, variable] = await Promise.all([
          getJson<DevApiItem[]>(ctx, `${base}/api-response.json`),
          getJson<VariableItem[]>(ctx, `${base}/variable-response.json`).catch(() => null),
        ]);
        return parseJsdelivr(items, variable);
      }
      throw errors[0] || new Error('Google Fonts catalogue source is not configured');
    },
    cssUrls(font: FontRef, variants: VariantKey[], opts: CssUrlOptions = {}) {
      const params = [`family=${googleFamilyParam(font.family, variants)}`, `display=${opts.display || 'swap'}`];
      if (opts.text) params.push(`text=${encodeURIComponent(opts.text)}`);
      return [`${cssBase}?${params.join('&')}`];
    },
  };
}
