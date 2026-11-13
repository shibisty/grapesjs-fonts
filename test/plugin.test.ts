import './gjsQuirks';
import grapesjs, { type Editor } from 'grapesjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import grapesjsFonts, { getFonts, type FontsApi } from '../src/index';

let editor: Editor | undefined;
afterEach(async () => {
  try {
    editor?.select([]);
  } catch {
    /* gone */
  }
  await new Promise((r) => setTimeout(r, 30));
  try {
    editor?.destroy();
  } catch {
    /* jsdom teardown noise */
  }
  editor = undefined;
  document.body.innerHTML = '';
});

async function create(): Promise<{ editor: Editor; fonts: FontsApi }> {
  const container = document.createElement('div');
  document.body.append(container);
  editor = grapesjs.init({
    container,
    height: '600px',
    storageManager: false,
    telemetry: false,
    components: '<p id="p1">Hello brave world</p><div id="box">Box</div>',
    plugins: [(ed: Editor) => grapesjsFonts(ed, { fetch: () => Promise.reject(new Error('offline')), storagePrefix: '' } as any)],
  } as Parameters<typeof grapesjs.init>[0]);
  await new Promise<void>((r) => editor!.onReady(() => r()));
  const fonts = getFonts(editor)!;
  fonts.add({ family: 'Lora', provider: 'google', id: 'Lora', category: 'serif', variants: ['400'] });
  return { editor, fonts };
}

const comp = (ed: Editor, id: string) => ed.getWrapper()!.find(`#${id}`)[0];

describe('plugin API', () => {
  it('is reachable as editor.Fonts', async () => {
    const { editor, fonts } = await create();
    expect((editor as any).Fonts).toBe(fonts);
    expect(fonts.fromValue("'Lora', serif")?.family).toBe('Lora');
    expect(fonts.fromValue('Arial')).toBeUndefined();
  });

  it('apply / clear on a component', async () => {
    const { editor, fonts } = await create();
    const box = comp(editor, 'box') as any;
    expect(fonts.apply('Lora', box)).toBe(true);
    expect(box.getStyle()['font-family']).toBe(fonts.valueOf('Lora'));
    expect(fonts.clear(box)).toBe(true);
    expect(box.getStyle()['font-family']).toBeUndefined();
    expect(fonts.apply('Nope', box)).toBe(false);
  });

  it('applyToRange wraps the selected text and updates the component', async () => {
    const { editor, fonts } = await create();
    const p = comp(editor, 'p1');
    editor.select(p);
    const el = p.getEl()!;
    const text = el.firstChild!;
    const range = el.ownerDocument.createRange();
    range.setStart(text, 6);
    range.setEnd(text, 11);
    const applied = vi.fn();
    editor.on('fonts:apply', applied);
    expect(fonts.applyToRange('Lora', range)).toBe(true);
    expect(applied).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 10)); // syncContent is async
    // the span became a component; GrapesJS moves its style into a CSS rule
    const span = p.find('span')[0];
    expect(span.getEl()!.textContent).toBe('brave');
    expect(String(span.getStyle()['font-family'])).toContain('Lora');
    expect(editor.getHtml()).toMatch(/Hello <span[^>]*>brave<\/span> world/);
    // collapsed / unknown font
    const empty = el.ownerDocument.createRange();
    expect(fonts.applyToRange('Lora', empty)).toBe(false);
    expect(fonts.applyToRange('Nope', range)).toBe(false);
  });

  it('editor.Fonts goes away with the editor', async () => {
    const { editor } = await create();
    editor.trigger('destroy');
    expect((editor as any).Fonts).toBeUndefined();
  });
});
