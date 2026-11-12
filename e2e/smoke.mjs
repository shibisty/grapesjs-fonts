import { launch, log } from './run.mjs';
const { browser, page, requests } = await launch();
const r = {};
r.button = await page.evaluate(() => !!document.querySelector('.gjs-pn-btn [title="Fonts"], [title="Fonts"]'));
r.smType = await page.evaluate(() => editor.StyleManager.getProperty('typography','font-family')?.getType());
// open via command
await page.evaluate(() => editor.runCommand('fonts:open'));
await page.waitForSelector('.gjs-fonts-card', { timeout: 15000 });
await page.waitForTimeout(500);
r.cards = await page.$$eval('.gjs-fonts-card', (els) => els.length);
r.info = await page.textContent('.gjs-fonts-footer__info');
r.first = await page.$$eval('.gjs-fonts-card__name', (els) => els.slice(0, 5).map((e) => e.textContent));
r.banners = await page.$$eval('.gjs-fonts-banner', (els) => els.map((e) => e.textContent));
r.providerStates = await page.evaluate(() => { const api = window.grapesjsFonts.getFonts(editor); return Array.from(api.catalog.states.entries()).map(([k,v])=>[k,v.status,v.fonts.length,v.error]); });
// search
await page.fill('.gjs-fonts-search input', 'open sans');
await page.waitForTimeout(400);
r.search = await page.$$eval('.gjs-fonts-card__name', (els) => els.slice(0, 4).map((e) => e.textContent));
await page.fill('.gjs-fonts-search input', '');
await page.waitForTimeout(400);
// category chip serif
await page.click('.gjs-fonts-chip:nth-child(3)');
await page.waitForTimeout(100);
r.serifInfo = await page.textContent('.gjs-fonts-footer__info');
// page 2
await page.click('.gjs-fonts-pager button:has-text("2")');
r.page2 = await page.textContent('.gjs-fonts-footer__info');
// source fontshare
await page.selectOption('.gjs-fonts-toolbar select:nth-of-type(2)', 'fontshare');
await page.click('.gjs-fonts-chip:nth-child(1)');
await page.waitForTimeout(100);
r.fontshare = await page.$$eval('.gjs-fonts-card__name', (els) => els.map((e) => e.textContent));
// select Satoshi, apply to h1
await page.evaluate(() => editor.select(editor.getWrapper().find('#t1')[0]));
await page.click('.gjs-fonts-card:has-text("Satoshi")');
r.variants = await page.$$eval('.gjs-fonts-variant input', (els) => els.map((e) => e.value + (e.checked ? '*' : '')));
await page.click('.gjs-fonts-details .gjs-fonts-btn--primary');
await page.waitForTimeout(200);
r.modalOpen = await page.evaluate(() => editor.Modal.isOpen());
r.style = await page.evaluate(() => { const c = editor.getWrapper().find('#t1')[0]; return JSON.stringify(c.getStyle()) + ' | rule:' + (editor.Css.getRule('#t1')?.toCSS() || ''); });
r.project = await page.evaluate(() => JSON.stringify(grapesjsFonts.getFonts(editor).list()));
r.canvasLinks = await page.evaluate(() => Array.from(editor.Canvas.getDocument().querySelectorAll('link[data-gjs-fonts]')).map((l) => l.href));
r.css = await page.evaluate(() => editor.getCss().slice(0, 200));
r.projectData = await page.evaluate(() => JSON.stringify(editor.getProjectData().fonts));
r.smValue = await page.evaluate(() => { const s = document.querySelector('.gjs-fonts-sm__select'); return s ? s.value + ' opts=' + Array.from(s.options).map(o=>o.textContent).slice(0,4).join('|') : 'none'; });
console.log(JSON.stringify(r, null, 1));
console.log('LOG', log.slice(0, 20));
console.log('reqs', requests.filter((u) => !u.includes('test.local')).slice(0, 15));
await browser.close();
