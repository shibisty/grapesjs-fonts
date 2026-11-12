/** Built-in provider ids. Custom providers may use any other string. */
export type BuiltinProviderId = 'google' | 'bunny' | 'fontsource' | 'fontshare';
export type ProviderId = BuiltinProviderId | (string & {});

export type FontCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace' | 'other';

export const FONT_CATEGORIES: FontCategory[] = ['sans-serif', 'serif', 'display', 'handwriting', 'monospace', 'other'];

/**
 * A variant key: weight plus optional `i` for italic, e.g. `400`, `700i`.
 */
export type VariantKey = string;

/** One font family as it appears in a provider catalogue (normalised across providers). */
export interface CatalogFont {
  /** Unique key, `${provider}:${id}`. */
  key: string;
  provider: ProviderId;
  /** Provider-specific id used to build CSS URLs (Google: family name, Bunny/Fontsource: slug, Fontshare: slug). */
  id: string;
  /** CSS `font-family` name. */
  family: string;
  category: FontCategory;
  /** Sorted variant keys, e.g. `['300', '400', '400i', '700']`. */
  variants: VariantKey[];
  /** Character subsets (`latin`, `cyrillic`, ...). Empty when the provider does not say. */
  subsets: string[];
  variable: boolean;
  /** ISO date (YYYY-MM-DD) of the last update, when known. */
  lastModified?: string;
  /** Popularity rank: 1 = most popular. Undefined when the provider has no such data. */
  popularity?: number;
  /** Provider-specific extra data needed to build CSS URLs (kept small: it is persisted). */
  meta?: Record<string, unknown>;
  /** Other providers that also serve this family (filled when catalogues are merged). */
  alternatives?: ProviderId[];
}

/** A font added to the project (persisted in the project data). */
export interface ProjectFont {
  family: string;
  provider: ProviderId;
  id: string;
  category: FontCategory;
  /** Variants loaded on the page. */
  variants: VariantKey[];
  meta?: Record<string, unknown>;
}

export interface ParsedVariant {
  weight: number;
  italic: boolean;
}
