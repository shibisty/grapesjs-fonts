import { afterEach, describe, expect, it } from 'vitest';
import grapesjs, { type Editor } from 'grapesjs';
import plugin, { META, VERSION, getFonts } from '../src/index';
import { CONTROLS, definePlugin, type PluginControl } from '../src/contract';
import { resolveOptions } from '../src/options';
import pkg from '../package.json';

const control = (ed: object): PluginControl => (ed as Record<symbol, Map<string, PluginControl>>)[CONTROLS].get(META.id)!;
let editor: Editor | undefined;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
  document.body.innerHTML = '';
});

describe('plugin contract', () => {
  it('meta: id = npm name, version = package.json, registered by id', () => {
    expect(META.id).toBe(pkg.name);
    expect(VERSION).toBe(pkg.version);
    expect((plugin as unknown as { meta: unknown }).meta).toBe(META);
    (globalThis as { grapesjs?: unknown }).grapesjs = grapesjs;
    definePlugin(plugin, META);
    expect(grapesjs.plugins.get(META.id)).toBe(plugin);
  });

  it('storageKey is the common name of storagePrefix', () => {
    expect(resolveOptions({ storageKey: 'x:' }).storagePrefix).toBe('x:');
    expect(resolveOptions({ storageKey: 'x:', storagePrefix: 'y:' }).storagePrefix).toBe('y:');
  });

  it('proxy, timeout and labels apply live', async () => {
    const urls: string[] = [];
    const container = document.createElement('div');
    document.body.append(container);
    editor = grapesjs.init({
      container,
      storageManager: false,
      plugins: [(ed: Editor) => plugin(ed, { fetch: (u: string) => (urls.push(u), Promise.reject(new Error('offline'))), storagePrefix: '', providers: ['bunny'] } as never)],
    } as Parameters<typeof grapesjs.init>[0]);
    const c = control(editor);
    expect(c.getOptions()).toMatchObject({ proxy: 'https://proxy.unifont.dev', storageKey: '' });
    expect(c.setOptions({ proxy: 'https://my.proxy/p', timeout: 5, labels: { title: 'Шрифты' }, rte: false })).toEqual({
      applied: ['proxy', 'timeout', 'labels'],
      reload: ['rte'],
    });
    await getFonts(editor)!.loadCatalogs(true).catch(() => undefined);
    expect(urls.some((u) => u.startsWith('https://my.proxy/p'))).toBe(true);
    expect(c.getOptions()).toMatchObject({ timeout: 5, labels: { title: 'Шрифты' }, rte: true });
  });
});
