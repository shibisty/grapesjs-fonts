import { launch, log } from './run.mjs';
const out = {};
const check = (name, cond, extra) => { out[name] = cond ? 'OK' : `FAIL ${extra !== undefined ? JSON.stringify(extra) : ''}`; };

// ---- 1. Style Manager select + browse, RTE, project reload
{
  const { browser, page, requests } = await launch();
  await page.evaluate(() => {
    const api = grapesjsFonts.getFonts(editor);
    api.add({ family: 'Open Sans', provider: 'google', id: 'Open Sans', category: 'sans-serif', variants: ['400', '700', '400i'] }, ['400', '700']);
    api.add({ family: 'Roboto Mono', provider: 'fontsource', id: 'roboto-mono', category: 'monospace', variants: ['400'] });
  });
  // SM: select the paragraph, open the typography sector, choose Open Sans in the select
  await page.evaluate(() => { editor.select(editor.getWrapper().find('#p1')[0]); });
  await page.click('.gjs-pn-btn.fa-paint-brush').catch(() => {});
  await page.waitForTimeout(200);
  const opts = await page.evaluate(() => Array.from(document.querySelectorAll('.gjs-fonts-sm__select option')).map((o) => o.value));
  check('sm options contain project fonts', opts.includes("'Open Sans', sans-serif") && opts.includes("'Roboto Mono', monospace"), opts.slice(0, 5));
  await page.evaluate(() => { const s = document.querySelector('.gjs-fonts-sm__select'); s.value = "'Open Sans', sans-serif"; s.dispatchEvent(new Event('change')); });
  await page.waitForTimeout(100);
  const pStyle = await page.evaluate(() => editor.getWrapper().find('#p1')[0].getStyle()['font-family']);
  check('sm select applies', pStyle === "'Open Sans', sans-serif", pStyle);
  // SM "browse" option opens modal and Apply writes via property
  await page.evaluate(() => { const s = document.querySelector('.gjs-fonts-sm__select'); s.value = '__gjs_fonts_browse__'; s.dispatchEvent(new Event('change')); });
  await page.waitForSelector('.gjs-fonts-details', { timeout: 10000 });
  const preselected = await page.evaluate(() => document.querySelector('.gjs-fonts-details__title')?.textContent);
  check('browse preselects current font', preselected === 'Open Sans', preselected);
  check('browse opens project tab', await page.evaluate(() => document.querySelector('.gjs-fonts-tab:nth-child(2)').getAttribute('aria-selected')) === 'true');
  await page.click('.gjs-fonts-tab:nth-child(1)');
  await page.waitForSelector('.gjs-fonts-card');
  await page.fill('.gjs-fonts-search input', 'lora');
  await page.waitForTimeout(400);
  await page.click('.gjs-fonts-card:has-text("Lora")');
  await page.click('.gjs-fonts-details .gjs-fonts-btn--primary');
  await page.waitForTimeout(200);
  const pStyle2 = await page.evaluate(() => editor.getWrapper().find('#p1')[0].getStyle()['font-family']);
  check('browse+apply via SM', pStyle2 === 'Lora, serif', pStyle2);
  const selVal = await page.evaluate(() => document.querySelector('.gjs-fonts-sm__select').value);
  check('sm select shows new value', selVal === 'Lora, serif', selVal);

  // Remove from project updates select options
  await page.evaluate(() => grapesjsFonts.getFonts(editor).remove('Roboto Mono'));
  const opts2 = await page.evaluate(() => Array.from(document.querySelectorAll('.gjs-fonts-sm__select option')).map((o) => o.value));
  check('sm options update on remove', !opts2.includes("'Roboto Mono', monospace"));

  // RTE: dblclick paragraph, select "bold paragraph" range, run action
  const frame = page.frameLocator('.gjs-frame');
  await frame.locator('#p1').dblclick();
  await page.waitForTimeout(300);
  const hasAction = await page.evaluate(() => !!document.querySelector('[data-gjs-fonts-rte]'));
  check('rte action present', hasAction);
  await page.evaluate(() => {
    const doc = editor.Canvas.getDocument();
    const p = doc.getElementById('p1');
    const r = doc.createRange();
    r.setStart(p.childNodes[0], 5); // "Some |"
    r.setEnd(p.childNodes[2], 10);  // " paragraph|"
    const s = doc.getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await page.click('[data-gjs-fonts-rte]');
  await page.waitForSelector('.gjs-fonts-card');
  await page.click('.gjs-fonts-tab:nth-child(2)'); // In project
  await page.waitForTimeout(100);
  await page.click('.gjs-fonts-prow:has-text("Open Sans") .gjs-fonts-btn:not(.gjs-fonts-btn--danger)');
  await page.waitForTimeout(200);
  const html = await page.evaluate(() => editor.Canvas.getDocument().getElementById('p1').innerHTML);
  check('rte wraps selection', /Some <span style="font-family: [^"]*Open Sans[^"]*"><b[^>]*>bold<\/b> paragraph<\/span> text/.test(html), html);
  // leave RTE like a user: click another element on the canvas
  out.editingBeforeLeave = await page.evaluate(() => !!editor.getEditing());
  await frame.locator('#t1').click();
  await page.waitForTimeout(300);
  out.editingAfterLeave = await page.evaluate(() => !!editor.getEditing());
  const exported = await page.evaluate(() => editor.getHtml() + '\n' + editor.getCss());
  check('rte result in model/export', /<span[^>]*><b>bold<\/b> paragraph<\/span>/.test(exported) && /font-family:["']Open Sans["'], sans-serif/.test(exported), exported);
  out.exportedHtml = exported;
  out.exportedCss = await page.evaluate(() => editor.getCss());

  // Project data round-trip
  const data = await page.evaluate(() => editor.getProjectData());
  const reloaded = await page.evaluate((d) => {
    editor.loadProjectData({ ...d, fonts: [] });
    const a = grapesjsFonts.getFonts(editor).list().length;
    editor.loadProjectData(d);
    return [a, grapesjsFonts.getFonts(editor).list().map((f) => f.family)];
  }, data);
  check('project data round-trip', reloaded[0] === 0 && reloaded[1].join() === 'Open Sans,Lora', reloaded);
  const links = await page.evaluate(() => Array.from(editor.Canvas.getDocument().querySelectorAll('link[data-gjs-fonts]')).map((l) => l.getAttribute('href')));
  check('canvas links after reload', links.length === 2 && links[0].includes('Open+Sans') && links[1].includes('Lora'), links);
  // @import in CSS parses back without junk rules
  const parsed = await page.evaluate(() => {
    const before = editor.Css.getAll().length;
    editor.addStyle(editor.getCss());
    return [before, editor.Css.getAll().length, editor.Css.getAll().map((r) => r.toCSS()).filter((c) => /import/.test(c))];
  });
  check('@import css re-parse adds no junk', parsed[2].length === 0, parsed);
  await browser.close();
}

// ---- 2. Cached catalogue: second editor load makes no catalogue requests
{
  const first = await launch();
  await first.page.evaluate(() => grapesjsFonts.getFonts(editor).loadCatalogs());
  const storage = await first.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('gjs-fonts:')).map((k) => [k, localStorage.getItem(k)])));
  out.cacheKeys = Object.keys(storage).map((k) => `${k}=${Math.round(storage[k].length / 1024)}KB`);
  await first.browser.close();
  const second = await launch({ storage });
  await second.page.evaluate(() => editor.runCommand('fonts:open'));
  await second.page.waitForSelector('.gjs-fonts-card');
  const catReq = second.requests.filter((u) => /proxy\.unifont|api-response|variable-response/.test(u));
  check('catalogue served from cache', catReq.length === 0, catReq);
  await second.browser.close();
}

// ---- 3. styleManager: 'options' mode keeps built-in select
{
  const { browser, page } = await launch({ opts: { styleManager: 'options', rte: false, button: false } });
  await page.evaluate(() => grapesjsFonts.getFonts(editor).add({ family: 'Inter', provider: 'google', id: 'Inter', category: 'sans-serif', variants: ['400'] }));
  const r = await page.evaluate(() => {
    const p = editor.StyleManager.getProperty('typography', 'font-family');
    return [p.getType(), p.getOptions().slice(0, 2).map((o) => o.id)];
  });
  check('options mode', r[0] === 'select' && r[1][0] === 'Inter, sans-serif', r);
  check('no button', !(await page.evaluate(() => !!editor.Panels.getButton('options', 'fonts'))));
  await browser.close();
}

// ---- 4. proxy: false -> google from jsDelivr, others error banner with retry
{
  const { browser, page } = await launch({ opts: { proxy: false, storagePrefix: false } });
  await page.evaluate(() => editor.runCommand('fonts:open'));
  await page.waitForSelector('.gjs-fonts-card');
  await page.waitForTimeout(500);
  const banners = await page.$$eval('.gjs-fonts-banner__text', (els) => els.map((e) => e.textContent));
  check('proxy false: banners for 3 providers', banners.length === 3, banners);
  const info = await page.textContent('.gjs-fonts-footer__info');
  const gCount = (await import('node:fs')).default.readFileSync(new URL('./fixtures/api-response.json', import.meta.url), 'utf8');
  check('proxy false: google works', info.includes(JSON.parse(gCount).length.toLocaleString('en')), info);
  await browser.close();
}
console.log(JSON.stringify(out, null, 1));
console.log('console:', log.filter((l) => !/Failed to load resource|catalogue failed to load/.test(l)));
const failed = Object.entries(out).filter(([, v]) => typeof v === 'string' && v.startsWith('FAIL'));
if (failed.length) { console.error(`${failed.length} check(s) failed`); process.exit(1); }
console.log('ALL E2E CHECKS PASSED');
