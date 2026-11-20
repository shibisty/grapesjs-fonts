# grapesjs-fonts

GrapesJS plugin to browse **free web fonts from several CDNs** — Google Fonts, Fontshare, Fontsource and Bunny Fonts — with search, filters, sorting and pagination, and to apply them to text: to a whole block, or to the selected words inside a text.

- One catalogue merged from four sources (duplicates collapsed, "also on …" shown), or one source at a time.
- Search (diacritics- and spacing-insensitive, relevance first), sort by popularity / name / recently updated / number of styles.
- Filters: category (sans serif, serif, display, handwriting, monospace), language subset (cyrillic, greek, …), weight, variable, italic.
- Page-by-page browsing; previews are loaded only for the fonts on the current page (Google Fonts previews download just the glyphs of the preview text).
- Editable preview text and size; localized pangram by default.
- Choose which styles (weights × italic) to load for each font.
- Style Manager: the `font-family` property becomes a select of project + system fonts with a "browse" button.
- Rich Text Editor: "Aa" action — font for the selected words (wrapped in a `<span>`), or for the whole block when nothing is selected.
- Project fonts are saved in the project data, loaded into the canvas, and exported (`@import` in `editor.getCss()`, or `<link>` tags via the API).
- 23 UI languages (all `grapesjs/locale` languages + Ukrainian), RTL for ar/he/fa.

## Install

```bash
npm i grapesjs-fonts
```

```js
import grapesjs from 'grapesjs';
import grapesjsFonts from 'grapesjs-fonts';

grapesjs.init({
  container: '#gjs',
  plugins: [grapesjsFonts],
  pluginsOpts: {
    [grapesjsFonts]: {
      proxy: '/plugins/grapesjs-fonts/proxy/fonts-proxy.php',
    },
  },
});
```

UMD (`<script>`): `dist/grapesjs-fonts.umd.cjs` exposes `window.grapesjsFonts` = `{ default, getFonts, COMMANDS, EVENTS, … }`; pass `grapesjsFonts.default` to `plugins`.

## Where the fonts come from — and why a proxy

| Source | Catalogue (metadata) | Stylesheets / font files |
| --- | --- | --- |
| Google Fonts | API key → Developer API (CORS ✔, popularity) · proxy → `fonts.google.com/metadata/fonts` (popularity) · fallback: `google-font-metadata` on jsDelivr (CORS ✔, no popularity) | `fonts.googleapis.com/css2` |
| Fontshare | `api.fontshare.com/v2/fonts` — via proxy | `api.fontshare.com/v2/css` |
| Fontsource | `api.fontsource.org/v1/fonts` — via proxy | `cdn.jsdelivr.net/npm/@fontsource/<id>@5/<weight>.css` |
| Bunny Fonts | `fonts.bunny.net/list` — via proxy | `fonts.bunny.net/css` |

Stylesheets and font files are loaded by the browser with `<link>`/`@font-face` and need nothing special. The **catalogue APIs** of these services, however, send no CORS headers, so a web page cannot read them with `fetch()`. They are requested through a small proxy that adds CORS:

- **`proxy/fonts-proxy.php`** (bundled) — PHP 7.2+, whitelisted endpoints only, 24 h disk cache, serves the stale copy if the upstream is down. Put the plugin folder under your web root and set `proxy: '/path/to/grapesjs-fonts/proxy/fonts-proxy.php'`. If your server has no `PATH_INFO`, it also accepts `?path=/bunny/v1/list`. Settings (allowed origins, cache dir, TTL) are at the top of the file or in env vars.
- Your own deployment of the [unifont proxy](https://github.com/unjs/unifont/tree/main/proxy) — same URL scheme.
- **Default:** `https://proxy.unifont.dev`, the public instance of the unifont proxy. It is best-effort and may be rate-limited — fine for trying the plugin, **use your own proxy in production**.
- `proxy: false` — no proxy: only Google Fonts works (through jsDelivr or your API key); the other sources show an error with a Retry button.

Catalogues are cached in `localStorage` for 24 h (`cacheTtl`), so the proxy is hit at most once a day per browser. A source that fails does not block the others.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `providers` | `['google', 'fontshare', 'fontsource', 'bunny']` | Sources in priority order (first wins when a family exists in several). Built-in ids or custom provider objects. |
| `proxy` | `'https://proxy.unifont.dev'` | CORS proxy base URL for catalogue APIs, or `false`. |
| `google` | `{}` | `{ apiKey?, jsdelivrPackage?, cssBase? }` — `apiKey` enables the Developer API with popularity order. |
| `fontsource` | `{}` | `{ types?: ['google', 'other'], packageVersion?: '5', cdnBase? }` |
| `bunny`, `fontshare` | `{}` | `{ cssBase? }` |
| `cacheTtl` | `86400000` | Catalogue cache lifetime, ms. |
| `storagePrefix` | `'gjs-fonts:'` | localStorage prefix (catalogue cache + UI state). `false` = no persistence. |
| `pageSize` / `pageSizes` | `24` / `[12, 24, 48, 96]` | Fonts per page. |
| `defaultQuery` | `{}` | Initial filters/sort, e.g. `{ sort: 'name', categories: ['serif'] }`. |
| `autoSubset` | `true` | On first use, filter by the script of the editor language (uk/ru → cyrillic, el → greek, …). |
| `display` | `'swap'` | `font-display` of project fonts. |
| `styleManager` | `true` | `true` replace the `font-family` property; `'options'` keep the built-in select and add project fonts to it; `false` none. |
| `rte` | `true` | "Aa" action in the Rich Text Editor toolbar. |
| `button` | `{ panel: 'options' }` | Toolbar button `{ panel, id }`, or `false`. |
| `canvasLinks` | `true` | Load project fonts into canvas frames. |
| `exportImport` | `true` | Prepend `@import url(…)` of project fonts to `editor.getCss()`. |
| `labels` | `{}` | Override UI texts. |
| `timeout`, `fetch` | `20000`, `window.fetch` | Network settings. |

## API

```js
import { getFonts } from 'grapesjs-fonts';
const fonts = getFonts(editor);

fonts.open();                                  // open the browser
fonts.open({ family: 'Lora', onApply: (font, value) => {/* … */} });
fonts.list();                                  // project fonts
fonts.add({ family: 'Inter', provider: 'google', id: 'Inter', category: 'sans-serif', variants: ['400', '700'] });
fonts.apply('Inter');                          // to the current Style Manager target
fonts.apply('Inter', component);               // or to a component / CSS rule
fonts.applyToRange('Inter', range);            // to a text Range of the canvas (wrapped in a <span>)
fonts.clear(component);                        // remove font-family
fonts.fromValue("'Inter', sans-serif");       // the project font of a CSS value
fonts.remove('Inter');
fonts.getLinksHtml();                          // <link rel="stylesheet" …> for your page <head>
fonts.getImportCss();                          // @import url(…);
fonts.getCssUrls();
await fonts.loadCatalogs();                    // (force = true to bypass the cache)
fonts.getCatalog(['fontshare']);
```

The same API is also `editor.Fonts`, so other plugins can use it without importing this package — [grapesjs-context-menu](https://www.npmjs.com/package/grapesjs-context-menu) 1.1+ shows a **Font** submenu with the project fonts this way (selected text in the canvas or the whole element).

Command: `fonts:open` (`editor.runCommand('fonts:open', { family })`).
Events: `fonts:change`, `fonts:add`, `fonts:remove`, `fonts:apply`, `fonts:catalog`.

Project data gets a `fonts` key:

```json
{ "fonts": [{ "family": "Lora", "provider": "google", "id": "Lora", "category": "serif", "variants": ["400", "400i", "700"] }] }
```

### Custom provider

```js
const myProvider = {
  id: 'self-hosted',
  label: 'Our fonts',
  async loadCatalog() {
    return [{ key: 'self-hosted:brand', provider: 'self-hosted', id: 'brand', family: 'Brand Sans',
      category: 'sans-serif', variants: ['400', '700'], subsets: ['latin', 'cyrillic'], variable: false }];
  },
  cssUrls: (font, variants) => [`/fonts/${font.id}.css`],
};
grapesjs.init({ plugins: [grapesjsFonts], pluginsOpts: { [grapesjsFonts]: { providers: [myProvider, 'google'] } } });
```

## Localization

Messages are registered in `editor.I18n` under `fonts.*` (`ar bs ca de el en es fa fr he id it ko nb nl pl pt ru se tr uk vi zh`); messages you pass in the editor `i18n.messages` config take precedence, `labels` overrides everything.

## Development

```bash
npm i
npm run typecheck
npm test          # unit tests (Vitest + jsdom)
npm run build
npm run e2e       # real GrapesJS in headless Chrome, network mocked (CHROME_PATH to override Chrome)
```


## Using it by name and changing options in the editor

This plugin follows the plugin contract of grapesjs-plugins-manager (its `docs/plugin-contract.md`): with the UMD bundle on the page it registers itself as `grapesjs-fonts`, so it can be listed like an official plugin —

```js
grapesjs.init({
  plugins: ['grapesjs-fonts'],
  pluginsOpts: { 'grapesjs-fonts': { /* options */ } },
});
```

— and grapesjs-plugins-manager shows a form of its options (⚙ in the plugin list). The plugin function carries `meta` (id, version, option schema).

## License

MIT. Font licences are those of the fonts (all four sources serve open-licensed fonts); the plugin only links to them.
