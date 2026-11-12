import type { Editor } from 'grapesjs';
import type { Translate } from '../i18n';
import type { FontProvider } from '../providers/types';
import type { CatalogFont, ProjectFont, ProviderId, VariantKey } from '../types';
import { Catalog } from './catalog';
import { ensureLinks, syncLinks } from './links';
import { ProjectFonts } from './projectFonts';
import { defaultVariants, fontFamilyValue, firstFamily, normalizeVariants, previewVariant } from './variants';

export const EVENTS = {
  /** Project fonts changed. Payload: `{ fonts: ProjectFont[] }`. */
  change: 'fonts:change',
  /** A font was added or its variants changed. Payload: `{ font: ProjectFont }`. */
  add: 'fonts:add',
  /** A font was removed. Payload: `{ family: string }`. */
  remove: 'fonts:remove',
  /** A font was applied. Payload: `{ font: ProjectFont, value: string, target }`. */
  apply: 'fonts:apply',
  /** A provider catalogue changed state (loading / ready / error). */
  catalog: 'fonts:catalog',
} as const;

export interface ApplyTarget {
  addStyle: (style: Record<string, string>) => unknown;
  getStyle?: () => Record<string, string>;
}

export interface ManagerOptions {
  editor: Editor;
  catalog: Catalog;
  t: Translate;
  display: string;
  canvasLinks: boolean;
}

export class FontsManager {
  readonly editor: Editor;
  readonly catalog: Catalog;
  readonly project = new ProjectFonts();
  readonly t: Translate;
  private display: string;
  private canvasLinks: boolean;

  constructor(opts: ManagerOptions) {
    this.editor = opts.editor;
    this.catalog = opts.catalog;
    this.t = opts.t;
    this.display = opts.display;
    this.canvasLinks = opts.canvasLinks;
    this.project.onChange((fonts) => {
      this.syncCanvas();
      this.editor.trigger(EVENTS.change, { fonts });
    });
    this.catalog.onChange(() => this.editor.trigger(EVENTS.catalog, { catalog: this.catalog }));
  }

  get providers(): FontProvider[] {
    return this.catalog.providers;
  }

  providerLabel(id: ProviderId): string {
    return this.catalog.getProvider(id)?.label || String(id);
  }

  /** Stylesheet URLs for a project font (what the page needs). */
  cssUrls(font: ProjectFont): string[] {
    const provider = this.catalog.getProvider(font.provider);
    if (!provider) return [];
    try {
      return provider.cssUrls(font, font.variants, { display: this.display });
    } catch (e) {
      console.error('[grapesjs-fonts]', e);
      return [];
    }
  }

  /** All stylesheet URLs of the project, deduplicated, in order. */
  allCssUrls(): string[] {
    return Array.from(new Set(this.project.list().flatMap((f) => this.cssUrls(f))));
  }

  /** `@import` rules for the project fonts (prepend to exported CSS). */
  getImportCss(): string {
    return this.allCssUrls()
      .map((u) => `@import url('${u.replace(/'/g, '%27')}');`)
      .join('\n');
  }

  /** `<link>` tags for the project fonts (put in the exported page `<head>`). */
  getLinksHtml(): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return this.allCssUrls()
      .map((u) => `<link rel="stylesheet" href="${esc(u)}">`)
      .join('\n');
  }

  /** Keep `<link>`s of every canvas frame in sync with the project fonts. */
  syncCanvas() {
    if (!this.canvasLinks) return;
    const urls = this.allCssUrls();
    for (const doc of this.frameDocuments()) syncLinks(doc, 'project', urls);
  }

  syncFrame(doc: Document | null | undefined) {
    if (!this.canvasLinks || !doc) return;
    syncLinks(doc, 'project', this.allCssUrls());
  }

  frameDocuments(): Document[] {
    const docs: Document[] = [];
    try {
      const canvas = (this.editor as any).Canvas;
      const frames: any[] = canvas?.getFrames?.() || [];
      for (const frame of frames) {
        const win: Window | undefined = frame?.view?.getWindow?.() || frame?.view?.el?.contentWindow;
        if (win?.document) docs.push(win.document);
      }
      if (!docs.length) {
        const doc = canvas?.getDocument?.();
        if (doc) docs.push(doc);
      }
    } catch {
      /* canvas not ready */
    }
    return docs;
  }

  /** Load a font into the editor UI document for previews (never removed: browser caches them anyway). */
  loadPreview(font: CatalogFont | ProjectFont, variants?: VariantKey[], text?: string) {
    const provider = this.catalog.getProvider(font.provider);
    if (!provider) return;
    const list = variants && variants.length ? variants : [previewVariant(font.variants)];
    try {
      ensureLinks(document, 'preview', provider.cssUrls(font, list, { display: 'block', text }));
    } catch (e) {
      console.error('[grapesjs-fonts]', e);
    }
  }

  /** Add a catalogue font (or update the variants of an existing one). */
  add(font: CatalogFont | ProjectFont, variants?: VariantKey[], { merge = false } = {}): ProjectFont | null {
    const chosen = normalizeVariants(
      (variants && variants.length ? variants : defaultVariants(font.variants)).filter(
        (v) => !font.variants.length || font.variants.includes(v),
      ),
    );
    const meta = font.meta ? { ...font.meta } : undefined;
    const added = this.project.add(
      {
        family: font.family,
        provider: font.provider,
        id: font.id,
        category: font.category,
        variants: chosen.length ? chosen : [previewVariant(font.variants)],
        ...(meta ? { meta } : {}),
      },
      { merge },
    );
    if (added) this.editor.trigger(EVENTS.add, { font: added });
    return added;
  }

  remove(family: string): boolean {
    const ok = this.project.remove(family);
    if (ok) this.editor.trigger(EVENTS.remove, { family });
    return ok;
  }

  /** CSS value for a project font, e.g. `'Open Sans', sans-serif`. */
  valueOf(family: string): string {
    const f = this.project.get(family);
    return f ? fontFamilyValue(f.family, f.category) : family;
  }

  /** The current style target: what the Style Manager edits (component or CSS rule), else the selected component. */
  getTarget(): ApplyTarget | null {
    const ed: any = this.editor;
    try {
      const smTarget = ed.StyleManager?.getSelected?.();
      if (smTarget?.addStyle) return smTarget;
    } catch {
      /* ignore */
    }
    const sel = ed.getSelected?.();
    return sel?.addStyle ? sel : null;
  }

  /** Apply a project font to a target (default: current Style Manager target). */
  apply(family: string, target: ApplyTarget | null = this.getTarget()): boolean {
    const font = this.project.get(family);
    if (!font || !target) return false;
    const value = fontFamilyValue(font.family, font.category);
    target.addStyle({ 'font-family': value });
    this.editor.trigger(EVENTS.apply, { font, value, target });
    return true;
  }

  /** Project font matching a `font-family` CSS value (by its first family). */
  fromValue(value: string | undefined | null): ProjectFont | undefined {
    const fam = firstFamily(value);
    return fam ? this.project.get(fam) : undefined;
  }
}
