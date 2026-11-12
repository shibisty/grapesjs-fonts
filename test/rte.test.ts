import { describe, expect, it } from 'vitest';
import { wrapRangeWithFont } from '../src/integration/rte';

describe('wrapRangeWithFont', () => {
  it('wraps a range and strips nested font-family', () => {
    document.body.innerHTML = '<p id="p">Some <b>bold</b> <i style="font-family: Arial; color: red">x</i> y</p>';
    const p = document.getElementById('p')!;
    const r = document.createRange();
    r.setStart(p.childNodes[0], 5);
    r.setEnd(p.childNodes[4], 0);
    const span = wrapRangeWithFont(r, "'Open Sans', sans-serif")!;
    expect(span.style.fontFamily).toContain('Open Sans');
    expect(p.innerHTML).toMatch(/^Some <span style="font-family: ['"&quot;]+Open Sans['"&quot;]+, sans-serif;"><b>bold<\/b> <i style="color: red;">x<\/i><\/span> y$/);
  });
  it('returns null for a collapsed range', () => {
    document.body.innerHTML = '<p>t</p>';
    const r = document.createRange();
    r.setStart(document.body.firstChild!.firstChild!, 0);
    expect(wrapRangeWithFont(r, 'Arial')).toBeNull();
  });
});
