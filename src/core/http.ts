/**
 * Network helpers.
 *
 * Font *files* and CSS stylesheets of every supported CDN are loaded by the browser through
 * `<link>`/`@font-face`, which needs no CORS from the stylesheet host. But the *catalogue* (metadata)
 * APIs of Google Fonts, Bunny Fonts, Fontsource and Fontshare send no CORS headers, so a page cannot
 * read them with `fetch()`. Those requests go through a proxy that adds CORS: the bundled
 * `proxy/fonts-proxy.php`, your own one, or the public `proxy.unifont.dev` (same URL scheme).
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpContext {
  fetch: FetchLike;
  /**
   * Base URL of a CORS proxy with unifont-compatible routes
   * (`/google/v1/fonts`, `/bunny/v1/list`, `/fontsource/v1/fonts`, `/fontshare/v1/fonts`),
   * or `false` to call upstream APIs directly.
   */
  proxy: string | false;
  timeout: number;
}

const PROXY_ROUTES: Array<[RegExp, string]> = [
  [/^https:\/\/fonts\.google\.com\/metadata\/fonts/, '/google/v1/fonts'],
  [/^https:\/\/fonts\.bunny\.net\/list/, '/bunny/v1/list'],
  [/^https:\/\/api\.fontsource\.org\/v1\/fonts/, '/fontsource/v1/fonts'],
  [/^https:\/\/api\.fontshare\.com\/v2\/fonts/, '/fontshare/v1/fonts'],
];

/** Rewrites an upstream catalogue URL to the proxy URL (keeping the query string), or returns null. */
export function toProxyUrl(proxy: string, url: string): string | null {
  for (const [re, route] of PROXY_ROUTES) {
    const m = re.exec(url);
    if (m) {
      const rest = url.slice(m[0].length);
      const query = rest.includes('?') ? rest.slice(rest.indexOf('?')) : '';
      return proxy.replace(/\/+$/, '') + route + query;
    }
  }
  return null;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

async function fetchText(ctx: HttpContext, url: string): Promise<string> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), ctx.timeout) : undefined;
  try {
    const res = await ctx.fetch(url, { signal: ctrl?.signal, credentials: 'omit' });
    if (!res.ok) throw new HttpError(`HTTP ${res.status} for ${url}`, res.status, url);
    return await res.text();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const msg = (err as Error)?.name === 'AbortError' ? 'timeout' : (err as Error)?.message || String(err);
    throw new HttpError(`Network error for ${url}: ${msg}`, undefined, url);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Google's metadata endpoints may prefix JSON with an XSSI guard `)]}'`. */
export function parseJsonLoose(text: string): unknown {
  const clean = text.replace(/^\)\]\}'\s*/, '');
  return JSON.parse(clean);
}

/** GET a JSON document that is served with CORS (e.g. jsDelivr, googleapis.com). */
export async function getJson<T = unknown>(ctx: HttpContext, url: string): Promise<T> {
  return parseJsonLoose(await fetchText(ctx, url)) as T;
}

/**
 * GET a catalogue JSON that has no CORS upstream: through the proxy when one is set
 * (falling back to a direct request if the proxy fails), directly otherwise.
 */
export async function getCatalogJson<T = unknown>(ctx: HttpContext, upstreamUrl: string): Promise<T> {
  const proxied = ctx.proxy ? toProxyUrl(ctx.proxy, upstreamUrl) : null;
  if (proxied) {
    try {
      return await getJson<T>(ctx, proxied);
    } catch (proxyErr) {
      try {
        return await getJson<T>(ctx, upstreamUrl);
      } catch {
        throw proxyErr;
      }
    }
  }
  return getJson<T>(ctx, upstreamUrl);
}
