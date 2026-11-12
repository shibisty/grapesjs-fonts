import { describe, expect, it } from 'vitest';
import { getCatalogJson, HttpError, parseJsonLoose, toProxyUrl } from '../src/core/http';

describe('http', () => {
  it('maps upstream catalogue URLs to unifont-compatible proxy routes', () => {
    expect(toProxyUrl('https://p.dev/', 'https://fonts.bunny.net/list')).toBe('https://p.dev/bunny/v1/list');
    expect(toProxyUrl('/proxy/fonts-proxy.php', 'https://api.fontshare.com/v2/fonts?offset=100&limit=100')).toBe('/proxy/fonts-proxy.php/fontshare/v1/fonts?offset=100&limit=100');
    expect(toProxyUrl('https://p.dev', 'https://api.fontsource.org/v1/fonts')).toBe('https://p.dev/fontsource/v1/fonts');
    expect(toProxyUrl('https://p.dev', 'https://fonts.google.com/metadata/fonts')).toBe('https://p.dev/google/v1/fonts');
    expect(toProxyUrl('https://p.dev', 'https://example.com/x')).toBeNull();
  });
  it('strips the XSSI guard', () => {
    expect(parseJsonLoose(")]}'\n{\"a\":1}")).toEqual({ a: 1 });
  });
  it('falls back to direct request when the proxy fails, and reports the proxy error if both fail', async () => {
    const calls: string[] = [];
    const ok = await getCatalogJson<{ ok: boolean }>({
      proxy: 'https://p.dev', timeout: 1000,
      fetch: async (u) => { calls.push(u); return u.startsWith('https://p.dev') ? new Response('x', { status: 502 }) : new Response('{"ok":true}'); },
    }, 'https://fonts.bunny.net/list');
    expect(ok).toEqual({ ok: true });
    expect(calls).toEqual(['https://p.dev/bunny/v1/list', 'https://fonts.bunny.net/list']);
    await expect(getCatalogJson({ proxy: 'https://p.dev', timeout: 1000, fetch: async () => { throw new TypeError('Failed to fetch'); } }, 'https://fonts.bunny.net/list'))
      .rejects.toMatchObject({ name: 'HttpError', url: 'https://p.dev/bunny/v1/list' });
    await expect(getCatalogJson({ proxy: false, timeout: 1000, fetch: async () => new Response('', { status: 404 }) }, 'https://fonts.bunny.net/list'))
      .rejects.toBeInstanceOf(HttpError);
  });
});
