import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createTranslator, interpolate, locales, registerI18n, SUPPORTED_LOCALES } from '../src/i18n';

describe('i18n', () => {
  const en = locales.en;
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join();

  it('covers every grapesjs/locale language plus uk', () => {
    const core = fs.readdirSync(path.resolve(__dirname, '../node_modules/grapesjs/locale')).filter((f) => f.endsWith('.js') && f !== 'index.js').map((f) => f.replace('.js', ''));
    expect(SUPPORTED_LOCALES.sort()).toEqual([...core, 'uk'].sort());
  });

  it.each(SUPPORTED_LOCALES)('%s has every key with the same placeholders', (code) => {
    const msgs = locales[code] as unknown as Record<string, string>;
    expect(Object.keys(msgs).sort()).toEqual(Object.keys(en).sort());
    for (const [k, v] of Object.entries(en)) {
      expect(typeof msgs[k] === 'string' && msgs[k].length > 0, `${code}.${k}`).toBe(true);
      expect(placeholders(msgs[k]), `${code}.${k}`).toBe(placeholders(v));
    }
  });

  it('translates via editor.I18n with fallbacks and label overrides; user messages win', () => {
    let locale = 'ru';
    let messages: any = { ru: { fonts: { title: 'Мои шрифты' } } };
    const editor: any = { I18n: { getLocale: () => locale, getMessages: () => messages, addMessages: (m: any) => { for (const [l, v] of Object.entries(m)) messages[l] = { ...(messages[l] || {}), ...(v as any) }; } } };
    registerI18n(editor);
    const t = createTranslator(editor, { close: 'X' });
    expect(t('title')).toBe('Мои шрифты');
    expect(t('tabCatalog')).toBe('Каталог');
    expect(t('close')).toBe('X');
    expect(t('tabProject', { count: 3 })).toBe('В проекте (3)');
    locale = 'pt-BR';
    expect(t('tabCatalog')).toBe('Catálogo');
    locale = 'xx';
    expect(t('tabCatalog')).toBe('Catalogue');
  });

  it('interpolates and keeps unknown placeholders', () => {
    expect(interpolate('{a}-{b}', { a: 1 })).toBe('1-{b}');
  });
});
