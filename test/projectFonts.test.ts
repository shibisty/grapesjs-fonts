import { describe, expect, it, vi } from 'vitest';
import { ProjectFonts } from '../src/core/projectFonts';
import { syncLinks, ensureLinks } from '../src/core/links';

describe('ProjectFonts', () => {
  it('adds, merges variants of the same source, replaces another source', () => {
    const p = new ProjectFonts();
    const spy = vi.fn();
    p.onChange(spy);
    p.add({ family: 'Lora', provider: 'google', id: 'Lora', category: 'serif', variants: ['400'] });
    p.add({ family: 'lora', provider: 'google', id: 'Lora', category: 'serif', variants: ['700'] });
    expect(p.get('LORA')?.variants).toEqual(['400', '700']);
    p.add({ family: 'Lora', provider: 'google', id: 'Lora', category: 'serif', variants: ['700'] }, { merge: false });
    expect(p.get('Lora')?.variants).toEqual(['700']);
    p.add({ family: 'Lora', provider: 'bunny', id: 'lora', category: 'serif', variants: ['400'] });
    expect(p.get('Lora')).toMatchObject({ provider: 'bunny', variants: ['400'] });
    expect(spy).toHaveBeenCalledTimes(4);
    // no-op add does not emit
    p.add({ family: 'Lora', provider: 'bunny', id: 'lora', category: 'serif', variants: ['400'] });
    expect(spy).toHaveBeenCalledTimes(4);
    expect(p.remove('lora')).toBe(true);
    expect(p.remove('lora')).toBe(false);
  });

  it('sanitizes loaded data', () => {
    const p = new ProjectFonts();
    p.reset([
      { family: ' Inter ', provider: 'google', category: 'nope', variants: ['400', 'bad', '700i'] },
      { family: 'inter', provider: 'google' },
      { provider: 'google' },
      null,
      'x',
    ]);
    expect(p.list()).toEqual([{ family: 'Inter', provider: 'google', id: 'Inter', category: 'other', variants: ['400', '700i'] }]);
    p.reset('garbage');
    expect(p.list()).toEqual([]);
  });
});

describe('links', () => {
  it('syncs a group of stylesheet links', () => {
    expect(syncLinks(document, 'g', ['a.css', 'b.css'])).toBe(2);
    expect(syncLinks(document, 'g', ['b.css', 'c.css'])).toBe(2);
    const hrefs = Array.from(document.head.querySelectorAll('link[data-gjs-fonts="g"]')).map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual(['b.css', 'c.css']);
    expect(syncLinks(document, 'g', ['b.css', 'c.css'])).toBe(0);
    expect(ensureLinks(document, 'preview', ['b.css', 'd.css'])).toHaveLength(1);
    expect(syncLinks(null, 'g', [])).toBe(0);
  });
});
