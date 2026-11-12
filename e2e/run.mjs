import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fx = (f) => fs.readFileSync(path.join(root, 'e2e/fixtures', f));
export const log = [];
export async function launch({ locale = 'en', opts = {}, failGoogleMeta = true, storage } = {}) {
  // CHROME_PATH=/path/to/chrome, otherwise the installed Google Chrome is used.
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] } : { channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const requests = [];
  await ctx.route('**/*', async (route) => {
    const url = route.request().url();
    requests.push(url);
    const u = new URL(url);
    const ok = (body, type = 'application/json') => route.fulfill({ status: 200, body, headers: { 'content-type': type, 'access-control-allow-origin': '*' } });
    if (u.host === 'test.local') {
      if (u.pathname === '/') return ok(fs.readFileSync(path.join(root, 'e2e/index.html')), 'text/html');
      if (u.pathname.startsWith('/gjs/')) return ok(fs.readFileSync(path.join(root, 'node_modules/grapesjs/dist', u.pathname.slice(5))), u.pathname.endsWith('.css') ? 'text/css' : 'text/javascript');
      if (u.pathname.startsWith('/dist/')) return ok(fs.readFileSync(path.join(root, u.pathname.slice(1))), 'text/javascript');
    }
    if (u.host === 'cdn.jsdelivr.net' && u.pathname.endsWith('/api-response.json')) return ok(fx('api-response.json'));
    if (u.host === 'cdn.jsdelivr.net' && u.pathname.endsWith('/variable-response.json')) return ok(fx('variable-response.json'));
    if (u.host === 'proxy.unifont.dev') {
      if (u.pathname === '/google/v1/fonts') return failGoogleMeta ? route.fulfill({ status: 502, body: 'bad' }) : ok('{}');
      if (u.pathname === '/bunny/v1/list') return ok(fx('bunny.json'));
      if (u.pathname === '/fontsource/v1/fonts') return ok(fx('fontsource.json'));
      if (u.pathname === '/fontshare/v1/fonts') return ok(fx(`fontshare-${u.searchParams.get('offset') || 0}.json`));
    }
    if (/googleapis|bunny\.net|fontshare\.com|jsdelivr/.test(u.host) && /\.css|css2|\/css/.test(u.pathname)) return ok('/* font css */', 'text/css');
    return route.fulfill({ status: 404, body: 'blocked in test' });
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => log.push(`[pageerror] ${e.message}`));
  await page.addInitScript(({ locale, opts, storage }) => {
    window.__LOCALE = locale; window.__FONTS_OPTS = opts;
    if (storage) for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
  }, { locale, opts, storage });
  await page.goto('http://test.local/');
  await page.waitForFunction(() => window.editor && window.editor.getModel().get('readyLoad'));
  await page.waitForTimeout(300);
  return { browser, page, requests };
}
