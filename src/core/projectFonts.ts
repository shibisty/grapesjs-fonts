import type { FontCategory, ProjectFont, ProviderId, VariantKey } from '../types';
import { FONT_CATEGORIES } from '../types';
import { normalizeVariants } from './variants';

export type ProjectFontsListener = (fonts: ProjectFont[]) => void;

function sanitize(f: Partial<ProjectFont> | null | undefined): ProjectFont | null {
  if (!f || typeof f.family !== 'string' || !f.family.trim() || typeof f.provider !== 'string') return null;
  const category = FONT_CATEGORIES.includes(f.category as FontCategory) ? (f.category as FontCategory) : 'other';
  const variants = Array.isArray(f.variants) ? normalizeVariants(f.variants.filter((v) => /^\d{3}i?$/.test(String(v)))) : [];
  const out: ProjectFont = {
    family: f.family.trim(),
    provider: f.provider as ProviderId,
    id: typeof f.id === 'string' && f.id ? f.id : f.family.trim(),
    category,
    variants: variants.length ? variants : ['400'],
  };
  if (f.meta && typeof f.meta === 'object') out.meta = JSON.parse(JSON.stringify(f.meta));
  return out;
}

/** Fonts used by the project. Keyed by family name (case-insensitive): one source per family. */
export class ProjectFonts {
  private fonts: ProjectFont[] = [];
  private listeners = new Set<ProjectFontsListener>();

  onChange(fn: ProjectFontsListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    const snapshot = this.list();
    this.listeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch (e) {
        console.error('[grapesjs-fonts]', e);
      }
    });
  }

  list(): ProjectFont[] {
    return this.fonts.map((f) => ({ ...f, variants: f.variants.slice() }));
  }

  get(family: string): ProjectFont | undefined {
    const k = family.trim().toLowerCase();
    const f = this.fonts.find((x) => x.family.toLowerCase() === k);
    return f ? { ...f, variants: f.variants.slice() } : undefined;
  }

  has(family: string): boolean {
    return !!this.get(family);
  }

  /**
   * Add a font or update the existing entry of the same family. With `merge` the variants are
   * united with the ones already loaded (adding Bold to a font that has Regular keeps Regular).
   */
  add(font: ProjectFont, { merge = true }: { merge?: boolean } = {}): ProjectFont | null {
    const clean = sanitize(font);
    if (!clean) return null;
    const k = clean.family.toLowerCase();
    const idx = this.fonts.findIndex((x) => x.family.toLowerCase() === k);
    if (idx >= 0) {
      const prev = this.fonts[idx];
      const sameSource = prev.provider === clean.provider && prev.id === clean.id;
      const variants: VariantKey[] =
        merge && sameSource ? normalizeVariants([...prev.variants, ...clean.variants]) : clean.variants;
      const meta = sameSource && prev.meta && clean.meta ? { ...prev.meta, ...clean.meta } : clean.meta;
      const next = { ...clean, variants, ...(meta ? { meta } : {}) };
      if (JSON.stringify(next) === JSON.stringify(prev)) return { ...prev };
      this.fonts[idx] = next;
    } else {
      this.fonts.push(clean);
    }
    this.emit();
    return this.get(clean.family) || null;
  }

  remove(family: string): boolean {
    const k = family.trim().toLowerCase();
    const before = this.fonts.length;
    this.fonts = this.fonts.filter((f) => f.family.toLowerCase() !== k);
    if (this.fonts.length === before) return false;
    this.emit();
    return true;
  }

  /** Replace everything (used when the project is loaded). */
  reset(fonts: unknown, { silent = false } = {}) {
    const list = Array.isArray(fonts) ? fonts : [];
    const seen = new Set<string>();
    this.fonts = [];
    for (const raw of list) {
      const f = sanitize(raw as ProjectFont);
      if (!f || seen.has(f.family.toLowerCase())) continue;
      seen.add(f.family.toLowerCase());
      this.fonts.push(f);
    }
    if (!silent) this.emit();
  }

  toJSON(): ProjectFont[] {
    return this.list();
  }
}
