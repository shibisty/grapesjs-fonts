import type { Editor } from 'grapesjs';
import type { FontsMessages } from './types';
import ar from './locales/ar';
import bs from './locales/bs';
import ca from './locales/ca';
import de from './locales/de';
import el from './locales/el';
import en from './locales/en';
import es from './locales/es';
import fa from './locales/fa';
import fr from './locales/fr';
import he from './locales/he';
import id from './locales/id';
import it from './locales/it';
import ko from './locales/ko';
import nb from './locales/nb';
import nl from './locales/nl';
import pl from './locales/pl';
import pt from './locales/pt';
import ru from './locales/ru';
import se from './locales/se';
import tr from './locales/tr';
import uk from './locales/uk';
import vi from './locales/vi';
import zh from './locales/zh';

export type { FontsMessages };

/** Same codes as `grapesjs/locale` (note: `se` is Swedish there) plus Ukrainian. */
export const locales: Record<string, FontsMessages> = {
  ar, bs, ca, de, el, en, es, fa, fr, he, id, it, ko, nb, nl, pl, pt, ru, se, tr, uk, vi, zh,
};

export const SUPPORTED_LOCALES = Object.keys(locales);

/** Key under which the plugin's messages live in `editor.I18n`. */
export const I18N_NS = 'fonts';

const RTL = ['ar', 'he', 'fa'];

export function isRtlLocale(locale: string): boolean {
  return RTL.includes(locale.split('-')[0]);
}

/**
 * Registers the plugin's messages in `editor.I18n` under `fonts.*`. Messages already present
 * (e.g. passed by the user in the editor `i18n.messages` config) win over the built-in ones.
 */
export function registerI18n(editor: Editor) {
  const i18n = (editor as any).I18n;
  if (!i18n?.addMessages) return;
  const existing = (i18n.getMessages?.() || {}) as Record<string, any>;
  const payload: Record<string, any> = {};
  for (const [code, msgs] of Object.entries(locales)) {
    payload[code] = { [I18N_NS]: { ...msgs, ...(existing[code]?.[I18N_NS] || {}) } };
  }
  i18n.addMessages(payload);
}

export type Translate = (key: keyof FontsMessages, params?: Record<string, string | number>) => string;

export function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
}

export function getLocale(editor: Editor): string {
  try {
    return String((editor as any).I18n?.getLocale?.() || 'en');
  } catch {
    return 'en';
  }
}

/**
 * Translator: option `labels` → `editor.I18n` messages for the current locale → built-in locale →
 * English.
 */
export function createTranslator(editor: Editor, labels: Partial<FontsMessages> = {}): Translate {
  return (key, params) => {
    const own = labels[key];
    if (typeof own === 'string' && own) return interpolate(own, params);
    const locale = getLocale(editor);
    const base = locale.split('-')[0];
    let msg: unknown;
    try {
      const all = (editor as any).I18n?.getMessages?.() || {};
      msg = all[locale]?.[I18N_NS]?.[key] ?? all[base]?.[I18N_NS]?.[key];
    } catch {
      /* ignore */
    }
    if (typeof msg !== 'string' || !msg) msg = locales[locale]?.[key] ?? locales[base]?.[key];
    if (typeof msg !== 'string' || !msg) msg = en[key];
    return interpolate(String(msg), params);
  };
}
