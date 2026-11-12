import type { Editor, Plugin } from 'grapesjs';
import { createLocalStorageCache, createMemoryCache } from './core/cache';
import { Catalog } from './core/catalog';
import type { HttpContext } from './core/http';
import { EVENTS, FontsManager, type ApplyTarget } from './core/manager';
import { createTranslator, registerI18n } from './i18n';
import { setupRte } from './integration/rte';
import { setupStyleManager } from './integration/styleManager';
import { resolveOptions, type FontsPluginOptions } from './options';
import { createBunnyProvider } from './providers/bunny';
import { createFontshareProvider } from './providers/fontshare';
import { createFontsourceProvider } from './providers/fontsource';
import { createGoogleProvider } from './providers/google';
import type { FontProvider } from './providers/types';
import type { CatalogFont, ProjectFont, VariantKey } from './types';
import { FontPicker, type PickerOpenOptions } from './ui/picker';

export const COMMANDS = {
  /** Open the font browser. Options: `PickerOpenOptions`. */
  open: 'fonts:open',
} as const;

export { EVENTS };
export { PROPERTY_TYPE } from './integration/styleManager';
export { RTE_ACTION, wrapRangeWithFont } from './integration/rte';
export { locales, SUPPORTED_LOCALES } from './i18n';
export * from './providers';
export * from './types';
export type { FontsPluginOptions } from './options';
export type { PickerOpenOptions } from './ui/picker';
export type { CatalogQuery, SortMode, QueryResult } from './core/query';
export { runQuery, searchScore } from './core/query';
export { fontFamilyValue, parseVariant, variantKey } from './core/variants';
export type { FontsMessages } from './i18n';

export interface FontsApi {
  /** Open the font browser modal. */
  open(options?: PickerOpenOptions): void;
  close(): void;
  /** Fonts added to the project. */
  list(): ProjectFont[];
  /** Add a font (catalogue entry or project font object) with the given variants. */
  add(font: CatalogFont | ProjectFont, variants?: VariantKey[]): ProjectFont | null;
  remove(family: string): boolean;
  /** Apply a project font to a component / CSS rule (default: current Style Manager target). */
  apply(family: string, target?: ApplyTarget): boolean;
  /** CSS value for a project font, e.g. `'Open Sans', sans-serif`. */
  valueOf(family: string): string;
  /** `@import` rules of the project fonts. */
  getImportCss(): string;
  /** `<link rel="stylesheet">` tags of the project fonts. */
  getLinksHtml(): string;
  /** Stylesheet URLs of the project fonts. */
  getCssUrls(): string[];
  /** Load (or with `force`, reload) catalogues. */
  loadCatalogs(force?: boolean): Promise<void>;
  /** Merged catalogue of the loaded providers. */
  getCatalog(providerIds?: string[]): CatalogFont[];
  readonly manager: FontsManager;
  readonly catalog: Catalog;
}

const instances = new WeakMap<Editor, FontsApi>();

/** The plugin API of an editor (undefined if the plugin is not installed). */
export function getFonts(editor: Editor): FontsApi | undefined {
  return instances.get(editor);
}

function buildProviders(opts: ReturnType<typeof resolveOptions>): FontProvider[] {
  const out: FontProvider[] = [];
  for (const p of opts.providers) {
    if (typeof p === 'object' && p && typeof p.loadCatalog === 'function') out.push(p);
    else if (p === 'google') out.push(createGoogleProvider(opts.google));
    else if (p === 'bunny') out.push(createBunnyProvider(opts.bunny));
    else if (p === 'fontsource') out.push(createFontsourceProvider(opts.fontsource));
    else if (p === 'fontshare') out.push(createFontshareProvider(opts.fontshare));
    else console.warn(`[grapesjs-fonts] Unknown provider: ${String(p)}`);
  }
  return out;
}

const SVG_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:middle"><path fill="currentColor" d="M9.6 4h2.1l5.5 15h-2.3l-1.5-4.2H7.1L5.6 19H3.4L9.6 4Zm-1.8 8.9h4.9L10.3 6.2l-2.5 6.7ZM18.2 9.8c1.9 0 3 1 3 2.9V19h-1.8v-1.1c-.5.8-1.4 1.3-2.5 1.3-1.6 0-2.7-.9-2.7-2.3 0-1.5 1.2-2.3 3.2-2.3h1.9v-.6c0-1-.6-1.6-1.6-1.6-.8 0-1.5.4-1.7 1.1l-1.6-.4c.4-1.4 1.8-2.3 3.8-2.3Zm1.1 5.2h-1.7c-1.1 0-1.6.4-1.6 1 0 .7.6 1.1 1.4 1.1 1.1 0 1.9-.7 1.9-1.7V15Z"/></svg>';

const grapesjsFonts: Plugin<FontsPluginOptions> = (editor, rawOptions = {}) => {
  const opts = resolveOptions(rawOptions);
  registerI18n(editor);
  const t = createTranslator(editor, opts.labels);
  const prefix = opts.storagePrefix;

  const http: HttpContext = {
    fetch: opts.fetch || ((url, init) => fetch(url, init)),
    proxy: opts.proxy,
    timeout: opts.timeout,
  };
  const catalog = new Catalog({
    providers: buildProviders(opts),
    http,
    cache: prefix ? createLocalStorageCache(prefix) : createMemoryCache(),
    cacheTtl: opts.cacheTtl,
  });
  const manager = new FontsManager({ editor, catalog, t, display: opts.display, canvasLinks: opts.canvasLinks });
  const picker = new FontPicker(manager, {
    pageSize: opts.pageSize,
    pageSizes: opts.pageSizes,
    defaultQuery: opts.defaultQuery,
    autoSubset: opts.autoSubset,
    storageKey: prefix ? `${prefix}ui` : false,
  });

  // --- Persist project fonts in the project data (getProjectData / loadProjectData / storage).
  const em: any = (editor as any).getModel?.();
  const storables: any[] | undefined = em?.storables || em?.get?.('storables');
  if (Array.isArray(storables)) {
    storables.push({
      name: 'FontsPlugin',
      storageKey: 'fonts',
      store: () => ({ fonts: manager.project.toJSON() }),
      load: (data: { fonts?: unknown }) => manager.project.reset(data?.fonts || []),
      clear: () => manager.project.reset([], { silent: true }),
    });
  } else {
    console.warn('[grapesjs-fonts] Editor storables not found: project fonts will not be saved with the project.');
  }

  // --- Canvas: every frame gets the project font stylesheets.
  editor.on('canvas:frame:load', (ev: { window?: Window }) => manager.syncFrame(ev?.window?.document));
  editor.on('load', () => manager.syncCanvas());

  // Fonts in the editor UI (Style Manager options, project list) render in their own face.
  manager.project.onChange((fonts) => fonts.forEach((f) => manager.loadPreview(f, f.variants)));

  // --- Export: @import in editor.getCss().
  if (opts.exportImport) {
    const original = editor.getCss.bind(editor);
    (editor as any).getCss = (o?: any) => {
      const css = original(o);
      if (o?.component || typeof css !== 'string') return css;
      const imports = manager.getImportCss();
      return imports ? `${imports}\n${css}` : css;
    };
  }

  // --- Command + toolbar button.
  editor.Commands.add(COMMANDS.open, {
    run(_ed: Editor, sender: any, o: PickerOpenOptions = {}) {
      picker.open({
        ...o,
        onClose: () => {
          sender?.set?.('active', false);
          o.onClose?.();
        },
      });
    },
    stop() {
      picker.close();
    },
  } as any);

  if (opts.button) {
    const { panel = 'options', id = 'fonts' } = opts.button;
    const addButton = () => {
      const panels: any = (editor as any).Panels;
      if (!panels?.getPanel?.(panel) || panels.getButton?.(panel, id)) return;
      panels.addButton(panel, {
        id,
        command: COMMANDS.open,
        label: SVG_ICON,
        togglable: false,
        attributes: { title: t('title') },
      });
    };
    editor.onReady ? editor.onReady(addButton) : editor.on('load', addButton);
  }

  if (opts.styleManager) setupStyleManager(editor, manager, picker, { replace: opts.styleManager === true });
  if (opts.rte) setupRte(editor, manager, picker, t('title'));

  const api: FontsApi = {
    open: (o) => picker.open(o),
    close: () => picker.close(),
    list: () => manager.project.list(),
    add: (font, variants) => manager.add(font, variants),
    remove: (family) => manager.remove(family),
    apply: (family, target) => manager.apply(family, target ?? manager.getTarget()),
    valueOf: (family) => manager.valueOf(family),
    getImportCss: () => manager.getImportCss(),
    getLinksHtml: () => manager.getLinksHtml(),
    getCssUrls: () => manager.allCssUrls(),
    loadCatalogs: (force) => catalog.loadAll(force),
    getCatalog: (ids) => catalog.getFonts(ids),
    manager,
    catalog,
  };
  instances.set(editor, api);
  editor.on('destroy', () => instances.delete(editor));
};

export default grapesjsFonts;
export { grapesjsFonts };
