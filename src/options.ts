import type { PluginMeta } from './contract';
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
  /** Same as `storagePrefix` (common name of this plugin family). */
  storageKey?: string | false;
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

export type ResolvedOptions = Required<Omit<FontsPluginOptions, 'google' | 'bunny' | 'fontsource' | 'fontshare' | 'fetch' | 'defaultQuery' | 'labels' | 'storageKey'>> &
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
  for (const [k, v] of Object.entries(opts)) if (v !== undefined && k !== 'storageKey') (out as any)[k] = v;
  if (opts.storageKey !== undefined && opts.storagePrefix === undefined) out.storagePrefix = opts.storageKey;
  out.labels = { ...(out.labels || {}) };
  return out;
}

export const PLUGIN_ID = 'grapesjs-fonts';
/** Version of this package (a test checks it against package.json). */
export const VERSION = '0.3.0';

const providerChoices = ['google', 'fontshare', 'fontsource', 'bunny'];

/** Options for forms (plugin contract). Texts, proxy and timeout apply live. */
export const META: PluginMeta = {
  id: PLUGIN_ID,
  version: VERSION,
  title: 'Fonts',
  description: 'Fonts from Google Fonts, Fontshare, Fontsource and Bunny Fonts for the project.',
  options: [
    { key: 'providers', type: 'list', default: providerChoices, title: 'Sources', description: `In priority order: ${providerChoices.join(', ')}.` },
    {
      key: 'proxy',
      type: 'string',
      default: DEFAULT_OPTIONS.proxy,
      title: 'Catalogue proxy',
      description: 'CORS proxy for catalogue APIs, e.g. /plugins/grapesjs-fonts/proxy/fonts-proxy.php. Empty — none (Google only).',
      live: true,
    },
    { key: 'google', type: 'json', default: {}, title: 'Google Fonts', description: '{ "apiKey": "…" } — Developer API with popularity order.', advanced: true },
    {
      key: 'styleManager',
      type: 'select',
      default: true,
      title: 'Style Manager',
      choices: [
        { value: true, label: 'Replace font-family' },
        { value: 'options', label: 'Add to the list' },
        { value: false, label: 'No' },
      ],
    },
    { key: 'rte', type: 'boolean', default: true, title: '"Aa" in the text toolbar' },
    { key: 'button', type: 'json', default: { panel: 'options' }, title: 'Toolbar button', description: '{ "panel": "options", "id": "fonts" }, or false.' },
    { key: 'pageSize', type: 'number', default: DEFAULT_OPTIONS.pageSize, title: 'Fonts per page' },
    { key: 'autoSubset', type: 'boolean', default: true, title: 'Filter by the editor language', description: 'uk/ru → cyrillic, el → greek, …' },
    { key: 'display', type: 'select', default: 'swap', title: 'font-display', choices: ['auto', 'block', 'swap', 'fallback', 'optional'].map((value) => ({ value })) },
    { key: 'canvasLinks', type: 'boolean', default: true, title: 'Load fonts into the canvas' },
    { key: 'exportImport', type: 'boolean', default: true, title: '@import in getCss()' },
    { key: 'timeout', type: 'number', default: DEFAULT_OPTIONS.timeout, title: 'Request timeout, ms', live: true, advanced: true },
    { key: 'cacheTtl', type: 'number', default: DEFAULT_OPTIONS.cacheTtl, title: 'Catalogue cache, ms', advanced: true },
    { key: 'storageKey', type: 'string', default: DEFAULT_OPTIONS.storagePrefix, title: 'localStorage prefix', aliases: ['storagePrefix'], advanced: true },
    { key: 'pageSizes', type: 'json', default: DEFAULT_OPTIONS.pageSizes, title: 'Page sizes', advanced: true },
    { key: 'defaultQuery', type: 'json', default: {}, title: 'Initial filters', description: 'e.g. { "sort": "name", "categories": ["serif"] }', advanced: true },
    { key: 'labels', type: 'json', default: {}, title: 'Texts', description: 'Overrides of UI texts.', live: true, advanced: true },
  ],
};

/** The options a form can show (no functions or provider objects). */
export function publicOptions(o: ResolvedOptions): Record<string, unknown> {
  return {
    providers: o.providers.map((p) => (typeof p === 'string' ? p : (p as { id?: string }).id || 'custom')),
    proxy: o.proxy === false ? '' : o.proxy,
    google: { ...((o as unknown as { google?: object }).google || {}) },
    styleManager: o.styleManager,
    rte: o.rte,
    button: o.button,
    pageSize: o.pageSize,
    autoSubset: o.autoSubset,
    display: o.display,
    canvasLinks: o.canvasLinks,
    exportImport: o.exportImport,
    timeout: o.timeout,
    cacheTtl: o.cacheTtl,
    storageKey: o.storagePrefix,
    pageSizes: o.pageSizes,
    defaultQuery: o.defaultQuery,
    labels: { ...o.labels },
  };
}
