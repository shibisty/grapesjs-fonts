import type { FetchLike } from './core/http';
import type { CatalogQuery } from './core/query';
import type { FontsMessages } from './i18n';
import type { BunnyProviderOptions } from './providers/bunny';
import type { FontshareProviderOptions } from './providers/fontshare';
import type { FontsourceProviderOptions } from './providers/fontsource';
import type { GoogleProviderOptions } from './providers/google';
import type { FontProvider } from './providers/types';
import type { BuiltinProviderId } from './types';

export interface FontsPluginOptions {
  /**
   * Font sources, in priority order (when the same family exists in several, the first wins in
   * "All sources"). Built-in ids or custom provider objects.
   * @default ['google', 'fontshare', 'fontsource', 'bunny']
   */
  providers?: Array<BuiltinProviderId | FontProvider>;
  google?: GoogleProviderOptions;
  bunny?: BunnyProviderOptions;
  fontsource?: FontsourceProviderOptions;
  fontshare?: FontshareProviderOptions;
  /**
   * CORS proxy for catalogue APIs that send no CORS headers (Bunny, Fontsource, Fontshare, Google
   * metadata). Base URL with unifont-compatible routes: the bundled `proxy/fonts-proxy.php`, your
   * own deployment of the unifont proxy, or `https://proxy.unifont.dev` (public, best effort — not
   * for production). `false` = no proxy (only Google Fonts via jsDelivr / API key will work).
   * @default 'https://proxy.unifont.dev'
   */
  proxy?: string | false;
  /** Catalogue cache lifetime, ms. @default 86400000 (24 h) */
  cacheTtl?: number;
  /** localStorage key prefix for catalogue cache and UI state. `false` disables persistence. @default 'gjs-fonts:' */
  storagePrefix?: string | false;
  /** Request timeout, ms. @default 20000 */
  timeout?: number;
  /** Custom fetch (tests, auth headers…). */
  fetch?: FetchLike;
  /** Fonts per page. @default 24 */
  pageSize?: number;
  /** Page size choices. @default [12, 24, 48, 96] */
  pageSizes?: number[];
  /** Initial filters/sort for first-time users. */
  defaultQuery?: Partial<CatalogQuery>;
  /** On first use, pre-filter by the script of the editor language (e.g. `cyrillic` for uk/ru). @default true */
  autoSubset?: boolean;
  /** `font-display` for project fonts. @default 'swap' */
  display?: string;
  /**
   * Style Manager integration: `true` = replace the `font-family` property with a select of project +
   * system fonts and a "browse" button; `'options'` = keep the built-in select and only add project
   * fonts to its options; `false` = none.
   * @default true
   */
  styleManager?: boolean | 'options';
  /** Add an "Aa" action to the Rich Text Editor toolbar (font for the selected text). @default true */
  rte?: boolean;
  /**
   * Toolbar button that opens the font browser. `false` = no button, or `{ panel, id }`.
   * @default { panel: 'options' }
   */
  button?: false | { panel?: string; id?: string };
  /** Load project fonts into canvas frames via `<link>`. @default true */
  canvasLinks?: boolean;
  /**
   * Prepend `@import url(...)` of project fonts to `editor.getCss()` output (code export, storage of
   * HTML/CSS). Use `getFonts(editor).getLinksHtml()` instead if you build the page `<head>` yourself.
   * @default true
   */
  exportImport?: boolean;
  /** Override UI texts (any language). */
  labels?: Partial<FontsMessages>;
}

export type ResolvedOptions = Required<Omit<FontsPluginOptions, 'google' | 'bunny' | 'fontsource' | 'fontshare' | 'fetch' | 'defaultQuery' | 'labels'>> &
  Pick<FontsPluginOptions, 'google' | 'bunny' | 'fontsource' | 'fontshare' | 'fetch'> & {
    defaultQuery: Partial<CatalogQuery>;
    labels: Partial<FontsMessages>;
  };

export const DEFAULT_OPTIONS: ResolvedOptions = {
  providers: ['google', 'fontshare', 'fontsource', 'bunny'],
  proxy: 'https://proxy.unifont.dev',
  cacheTtl: 24 * 60 * 60 * 1000,
  storagePrefix: 'gjs-fonts:',
  timeout: 20000,
  pageSize: 24,
  pageSizes: [12, 24, 48, 96],
  defaultQuery: {},
  autoSubset: true,
  display: 'swap',
  styleManager: true,
  rte: true,
  button: { panel: 'options' },
  canvasLinks: true,
  exportImport: true,
  labels: {},
};

export function resolveOptions(opts: FontsPluginOptions = {}): ResolvedOptions {
  const out = { ...DEFAULT_OPTIONS } as ResolvedOptions;
  for (const [k, v] of Object.entries(opts)) if (v !== undefined) (out as any)[k] = v;
  return out;
}
