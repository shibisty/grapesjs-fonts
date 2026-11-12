import type { HttpContext } from '../core/http';
import type { CatalogFont, ProviderId, VariantKey } from '../types';

export interface CssUrlOptions {
  /** `font-display` value. */
  display?: string;
  /**
   * Only the glyphs needed to render this text (used for previews).
   * Providers that cannot subset by text ignore it.
   */
  text?: string;
}

export type FontRef = Pick<CatalogFont, 'id' | 'family' | 'variants' | 'meta'>;

export interface FontProvider {
  id: ProviderId;
  /** Human-readable name shown in the UI. */
  label: string;
  /** Link to the provider's site (shown in the UI). */
  homepage?: string;
  /** Load the whole catalogue (the plugin caches it). */
  loadCatalog(ctx: HttpContext): Promise<CatalogFont[]>;
  /** Stylesheet URL(s) that declare `@font-face` rules for the given variants. */
  cssUrls(font: FontRef, variants: VariantKey[], options?: CssUrlOptions): string[];
}
