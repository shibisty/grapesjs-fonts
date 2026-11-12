import { describe, expect, it } from 'vitest';
import { parseBunny, createBunnyProvider } from '../src/providers/bunny';
import { parseFontsource, createFontsourceProvider } from '../src/providers/fontsource';
import { parseFontshare, createFontshareProvider } from '../src/providers/fontshare';
import { createGoogleProvider, googleFamilyParam, parseDevApi, parseJsdelivr, parseMetadata } from '../src/providers/google';
import type { HttpContext } from '../src/core/http';

const jsonRes = (body: unknown, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

function ctx(routes: Record<string, unknown>, proxy: string | false = 'https://px.test'): HttpContext & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    proxy,
    timeout: 1000,
    fetch: async (url: string) => {
      calls.push(url);
      for (const [prefix, body] of Object.entries(routes)) if (url.startsWith(prefix)) return body instanceof Response ? body : jsonRes(body);
      return jsonRes('nope', 404);
    },
  };
}

describe('google', () => {
  it('builds css2 family params', () => {
    expect(googleFamilyParam('Roboto', ['400'])).toBe('Roboto');
    expect(googleFamilyParam('Open Sans', ['700', '400'])).toBe('Open+Sans:wght@400;700');
    expect(googleFamilyParam('Lora', ['700i', '400', '400i'])).toBe('Lora:ital,wght@0,400;1,400;1,700');
  });
  it('builds css urls with text subsetting', () => {
    const p = createGoogleProvider();
    expect(p.cssUrls({ id: 'Open Sans', family: 'Open Sans', variants: [] }, ['400'], { text: 'Hi there' })).toEqual([
      'https://fonts.googleapis.com/css2?family=Open+Sans&display=swap&text=Hi%20there',
    ]);
  });
  it('parses the three catalogue formats', () => {
    const dev = parseDevApi({ items: [{ family: 'A', variants: ['regular', '700italic'], subsets: ['latin', 'menu'], category: 'serif', axes: [{ tag: 'wght' }] }] });
    expect(dev[0]).toMatchObject({ family: 'A', variants: ['400', '700i'], subsets: ['latin'], variable: true, popularity: 1, category: 'serif' });
    const meta = parseMetadata({ familyMetadataList: [{ family: 'B', category: 'Sans Serif', subsets: ['latin'], fonts: { '400': {}, '400i': {} }, popularity: 7, lastModified: '2025-01-01' }] });
    expect(meta[0]).toMatchObject({ category: 'sans-serif', variants: ['400', '400i'], popularity: 7, variable: false });
    const js = parseJsdelivr([{ family: 'C', variants: ['regular'], subsets: ['latin'], category: 'display' }], [{ family: 'C' }]);
    expect(js[0]).toMatchObject({ variable: true, popularity: undefined });
  });
  it('uses the API key source first, then the proxy metadata, then jsDelivr', async () => {
    const c1 = ctx({ 'https://www.googleapis.com/': { items: [{ family: 'K', variants: ['regular'], subsets: [], category: 'serif' }] } });
    expect((await createGoogleProvider({ apiKey: 'xyz' }).loadCatalog(c1))[0].family).toBe('K');

    const c2 = ctx({ 'https://px.test/google/v1/fonts': ")]}'\n" + JSON.stringify({ familyMetadataList: [{ family: 'M', category: 'Serif', subsets: [], fonts: { 400: {} } }] }) });
    expect((await createGoogleProvider().loadCatalog(c2))[0].family).toBe('M');

    const c3 = ctx({ 'https://cdn.jsdelivr.net/npm/google-font-metadata@6/data/api-response.json': [{ family: 'J', variants: ['regular'], subsets: [], category: 'serif' }] });
    const res = await createGoogleProvider().loadCatalog(c3);
    expect(res[0].family).toBe('J');
    expect(c3.calls[0]).toBe('https://px.test/google/v1/fonts');
  });
});

describe('bunny', () => {
  it('parses list and builds css', () => {
    const fonts = parseBunny({ 'open-sans': { category: 'sans-serif', familyName: 'Open Sans', styles: ['normal', 'italic'], variants: { latin: 1, cyrillic: 1 }, weights: [400, 700] } });
    expect(fonts[0]).toMatchObject({ key: 'bunny:open-sans', variants: ['400', '400i', '700', '700i'], subsets: ['latin', 'cyrillic'] });
    expect(createBunnyProvider().cssUrls(fonts[0], ['700i', '400'])).toEqual(['https://fonts.bunny.net/css?family=open-sans:400,700i&display=swap']);
  });
});

describe('fontsource', () => {
  it('filters types and builds per-variant stylesheet urls', async () => {
    const data = [
      { id: 'inter', family: 'Inter', subsets: ['latin'], weights: [400, 700], styles: ['normal', 'italic'], variable: true, category: 'sans-serif', type: 'google' },
      { id: 'material-icons', family: 'Material Icons', subsets: ['latin'], weights: [400], styles: ['normal'], variable: false, category: 'other', type: 'icons' },
    ];
    expect(parseFontsource(data, ['google', 'other']).map((f) => f.id)).toEqual(['inter']);
    const p = createFontsourceProvider();
    const c = ctx({ 'https://px.test/fontsource/v1/fonts': data });
    const fonts = await p.loadCatalog(c);
    expect(fonts).toHaveLength(1);
    expect(p.cssUrls(fonts[0], ['400', '700i'])).toEqual([
      'https://cdn.jsdelivr.net/npm/@fontsource/inter@5/400.css',
      'https://cdn.jsdelivr.net/npm/@fontsource/inter@5/700-italic.css',
    ]);
  });
});

describe('fontshare', () => {
  const st = (w: number, i: boolean, n: number, v = false) => ({ is_italic: i, is_variable: v, weight: { weight: w, number: n } });
  it('maps style numbers and paginates', async () => {
    const p = createFontshareProvider();
    const c = ctx({
      'https://px.test/fontshare/v1/fonts?offset=0': { fonts: [{ slug: 'satoshi', name: 'Satoshi', category: 'Sans', styles: [st(400, false, 400), st(400, true, 401), st(0, false, 1, true)] }], has_more: true },
      'https://px.test/fontshare/v1/fonts?offset=100': { fonts: [{ slug: 'gambetta', name: 'Gambetta', category: 'Serif', styles: [st(700, false, 700)] }], has_more: false },
    });
    const fonts = await p.loadCatalog(c);
    expect(fonts.map((f) => f.family)).toEqual(['Satoshi', 'Gambetta']);
    expect(fonts[0]).toMatchObject({ variants: ['400', '400i'], variable: true, category: 'sans-serif' });
    expect(p.cssUrls(fonts[0], ['400i', '400'])).toEqual(['https://api.fontshare.com/v2/css?f[]=satoshi@400,401&display=swap']);
    expect(parseFontshare([])).toEqual([]);
  });
});
