import type { FontsMessages, Translate } from '../i18n';
import { getLocale, isRtlLocale } from '../i18n';
import type { FontsManager } from '../core/manager';
import { collectSubsets, DEFAULT_QUERY, pagerPages, runQuery, SORT_MODES, type CatalogQuery, type SortMode } from '../core/query';
import { defaultVariants, fontFamilyValue, normalizeVariants, parseVariant, previewVariant } from '../core/variants';
import type { CatalogFont, FontCategory, ProjectFont, VariantKey } from '../types';
import { FONT_CATEGORIES } from '../types';
import { clear, debounce, h } from './dom';
import { injectStyles } from './styles';

export interface PickerOpenOptions {
  /** Initial tab. */
  tab?: 'catalog' | 'project';
  /** Preselect this family (project font or catalogue font). */
  family?: string;
  /**
   * Called instead of the default "apply to current target" when the user presses Apply.
   * The font is already added to the project at that point.
   */
  onApply?: (font: ProjectFont, value: string) => void;
  /** Called when the modal closes. */
  onClose?: () => void;
}

export interface PickerConfig {
  pageSize: number;
  pageSizes: number[];
  defaultQuery: Partial<CatalogQuery>;
  /** Pre-filter by the subset of the editor language on first use. */
  autoSubset: boolean;
  storageKey: string | false;
}

const SUBSET_BY_LOCALE: Record<string, string> = {
  ru: 'cyrillic', uk: 'cyrillic', el: 'greek', ar: 'arabic', fa: 'arabic', he: 'hebrew',
  vi: 'vietnamese', ko: 'korean', zh: 'chinese-simplified',
};

const CAT_KEYS: Record<FontCategory, keyof FontsMessages> = {
  'sans-serif': 'catSansSerif', serif: 'catSerif', display: 'catDisplay',
  handwriting: 'catHandwriting', monospace: 'catMonospace', other: 'catOther',
};

const SORT_KEYS: Record<SortMode, keyof FontsMessages> = {
  popular: 'sortPopular', name: 'sortName', 'name-desc': 'sortNameDesc', newest: 'sortNewest', styles: 'sortStyles',
};

const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

interface SavedUi {
  query?: Partial<CatalogQuery>;
  previewText?: string;
  previewSize?: number;
}

const SEARCH_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

type Selection =
  | { kind: 'catalog'; font: CatalogFont }
  | { kind: 'project'; font: CatalogFont; project: ProjectFont }
  | null;

export class FontPicker {
  private t: Translate;
  private root: HTMLElement | null = null;
  private refs: Record<string, HTMLElement> = {};
  private query: CatalogQuery;
  private tab: 'catalog' | 'project' = 'catalog';
  private selection: Selection = null;
  private selVariants: VariantKey[] = [];
  private previewText = '';
  private previewSize = 28;
  private openOpts: PickerOpenOptions = {};
  private unsubs: Array<() => void> = [];
  private statusTimer?: ReturnType<typeof setTimeout>;
  private isOpen = false;

  constructor(
    private manager: FontsManager,
    private config: PickerConfig,
  ) {
    this.t = manager.t;
    this.query = { ...DEFAULT_QUERY, pageSize: config.pageSize, ...config.defaultQuery };
    this.restore();
  }

  // ---------------------------------------------------------------- persistence

  private restore() {
    if (!this.config.storageKey) return;
    try {
      const raw = localStorage.getItem(this.config.storageKey);
      if (!raw) {
        if (this.config.autoSubset) {
          const sub = SUBSET_BY_LOCALE[getLocale(this.manager.editor).split('-')[0]];
          if (sub) this.query.subset = sub;
        }
        return;
      }
      const saved = JSON.parse(raw) as SavedUi;
      if (saved.query) this.query = { ...this.query, ...saved.query, search: '' };
      if (typeof saved.previewText === 'string') this.previewText = saved.previewText;
      if (typeof saved.previewSize === 'number') this.previewSize = saved.previewSize;
    } catch {
      /* ignore */
    }
  }

  private save() {
    if (!this.config.storageKey) return;
    try {
      const { search: _s, ...query } = this.query;
      const data: SavedUi = { query, previewText: this.previewText, previewSize: this.previewSize };
      localStorage.setItem(this.config.storageKey, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  // ---------------------------------------------------------------- open / close

  open(opts: PickerOpenOptions = {}) {
    const { editor } = this.manager;
    const modal: any = (editor as any).Modal;
    this.openOpts = opts;
    this.tab = opts.tab || (opts.family && this.manager.project.has(opts.family) ? 'project' : 'catalog');
    this.selection = null;
    injectStyles();
    this.build();
    if (opts.family) this.preselect(opts.family);

    modal.open({ title: this.t('title'), content: this.root, attributes: { class: 'gjs-fonts-modal' } });
    this.isOpen = true;
    const dialog = this.root!.closest('.gjs-mdl-dialog');
    dialog?.classList.add('gjs-fonts-dialog');
    modal.onceClose?.(() => this.onClosed(dialog));

    this.unsubs.push(this.manager.catalog.onChange(() => this.refresh()));
    this.unsubs.push(this.manager.project.onChange(() => this.refresh()));
    const onSel = () => this.renderDetails();
    editor.on('component:toggled', onSel);
    this.unsubs.push(() => editor.off('component:toggled', onSel));

    this.manager.catalog.loadAll();
    this.refresh();
    setTimeout(() => (this.refs.search as HTMLInputElement | undefined)?.focus(), 30);
  }

  close() {
    if (this.isOpen) (this.manager.editor as any).Modal.close();
  }

  private onClosed(dialog: Element | null) {
    this.isOpen = false;
    dialog?.classList.remove('gjs-fonts-dialog');
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.save();
    const cb = this.openOpts.onClose;
    this.openOpts = {};
    cb?.();
  }

  private preselect(family: string) {
    const pf = this.manager.project.get(family);
    if (pf) {
      this.selectProject(pf, false);
      return;
    }
    const cf = this.manager.catalog.findByFamily(family);
    if (cf) this.selectCatalog(cf, false);
  }

  // ---------------------------------------------------------------- layout

  private build() {
    const t = this.t;
    const rtl = isRtlLocale(getLocale(this.manager.editor));
    const r = (this.refs = {} as Record<string, HTMLElement>);

    r.tabCatalog = h('button', { class: 'gjs-fonts-tab', role: 'tab', type: 'button', onclick: () => this.setTab('catalog') }, t('tabCatalog'));
    r.tabProject = h('button', { class: 'gjs-fonts-tab', role: 'tab', type: 'button', onclick: () => this.setTab('project') });
    r.refreshBtn = h('button', { class: 'gjs-fonts-btn', type: 'button', title: t('refresh'), onclick: () => this.manager.catalog.loadAll(true) }, '↻');

    const search = h('input', {
      class: 'gjs-fonts-input', type: 'search', placeholder: t('searchPlaceholder'), value: this.query.search, 'aria-label': t('searchPlaceholder'),
    });
    const onSearch = debounce(() => this.setQuery({ search: search.value, page: 1 }), 200);
    search.addEventListener('input', onSearch);
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        onSearch.cancel();
        this.setQuery({ search: search.value, page: 1 });
      }
    });
    r.search = search;
    const searchWrap = h('div', { class: 'gjs-fonts-search' }, search);
    searchWrap.insertAdjacentHTML('afterbegin', SEARCH_ICON);

    const sort = h('select', { class: 'gjs-fonts-select', title: t('sortLabel'), 'aria-label': t('sortLabel') },
      SORT_MODES.map((m) => h('option', { value: m }, t(SORT_KEYS[m]))));
    sort.value = this.query.sort;
    sort.addEventListener('change', () => this.setQuery({ sort: sort.value as SortMode, page: 1 }));
    r.sort = sort;

    const source = h('select', { class: 'gjs-fonts-select', 'aria-label': t('allSources') },
      h('option', { value: '' }, t('allSources')),
      this.manager.providers.map((p) => h('option', { value: String(p.id) }, p.label)));
    source.value = this.query.providers.length === 1 ? String(this.query.providers[0]) : '';
    source.addEventListener('change', () => this.setQuery({ providers: source.value ? [source.value] : [], page: 1 }));
    r.source = source;

    r.chips = h('div', { class: 'gjs-fonts-chips', role: 'group' });
    r.subset = h('select', { class: 'gjs-fonts-select', 'aria-label': t('anySubset') });
    r.subset.addEventListener('change', () => this.setQuery({ subset: (r.subset as HTMLSelectElement).value, page: 1 }));
    const weight = h('select', { class: 'gjs-fonts-select', 'aria-label': t('anyWeight') },
      h('option', { value: '0' }, t('anyWeight')),
      WEIGHTS.map((w) => h('option', { value: String(w) }, `${w} · ${this.weightName(w)}`)));
    weight.value = String(this.query.weight || 0);
    weight.addEventListener('change', () => this.setQuery({ weight: Number(weight.value), page: 1 }));
    r.weight = weight;
    const variable = h('input', { type: 'checkbox' });
    variable.checked = this.query.variableOnly;
    variable.addEventListener('change', () => this.setQuery({ variableOnly: variable.checked, page: 1 }));
    const italic = h('input', { type: 'checkbox' });
    italic.checked = this.query.italicOnly;
    italic.addEventListener('change', () => this.setQuery({ italicOnly: italic.checked, page: 1 }));
    r.variable = variable;
    r.italic = italic;

    const previewInput = h('input', { class: 'gjs-fonts-input', type: 'text', placeholder: t('previewPlaceholder'), value: this.previewText, 'aria-label': t('previewPlaceholder') });
    const onPreview = debounce(() => {
      this.previewText = previewInput.value;
      this.renderList();
      this.renderDetails();
    }, 350);
    previewInput.addEventListener('input', onPreview);
    const size = h('input', { type: 'range', min: '14', max: '64', step: '2', value: String(this.previewSize), title: t('previewSize'), 'aria-label': t('previewSize') });
    size.addEventListener('input', () => {
      this.previewSize = Number(size.value);
      this.root?.style.setProperty('--gf-size', `${this.previewSize}px`);
    });

    r.toolbar = h('div', { class: 'gjs-fonts-toolbar' }, searchWrap, sort, source);
    r.filters = h('div', { class: 'gjs-fonts-filters' },
      r.chips, r.subset, weight,
      h('label', { class: 'gjs-fonts-check' }, variable, t('variableOnly')),
      h('label', { class: 'gjs-fonts-check' }, italic, t('italicOnly')),
      h('div', { class: 'gjs-fonts-preview-ctrl' }, previewInput, size));
    r.banner = h('div', { class: 'gjs-fonts-banners' });
    r.list = h('div', { class: 'gjs-fonts-list', role: 'region' });
    r.details = h('aside', { class: 'gjs-fonts-details' });
    r.info = h('div', { class: 'gjs-fonts-footer__info' });
    r.pager = h('nav', { class: 'gjs-fonts-pager' });
    const pageSize = h('select', { class: 'gjs-fonts-select', 'aria-label': t('perPage', { count: '' }).trim() },
      Array.from(new Set([...this.config.pageSizes, this.query.pageSize])).sort((a, b) => a - b).map((n) => h('option', { value: String(n) }, t('perPage', { count: n }))));
    pageSize.value = String(this.query.pageSize);
    pageSize.addEventListener('change', () => this.setQuery({ pageSize: Number(pageSize.value), page: 1 }));
    r.pageSize = pageSize;
    r.status = h('div', { class: 'gjs-fonts-footer__status', role: 'status', 'aria-live': 'polite' });

    this.root = h('div', { class: 'gjs-fonts', dir: rtl ? 'rtl' : 'ltr', style: { ['--gf-size' as any]: `${this.previewSize}px` } as any },
      h('div', { class: 'gjs-fonts-tabs', role: 'tablist' }, r.tabCatalog, r.tabProject, h('div', { class: 'gjs-fonts-tabs__spacer' }), r.refreshBtn),
      r.toolbar, r.filters, r.banner,
      h('div', { class: 'gjs-fonts-main' }, r.list, r.details),
      h('div', { class: 'gjs-fonts-footer' }, r.info, r.pager, r.pageSize, r.status));
    this.root.style.setProperty('--gf-size', `${this.previewSize}px`);
    // GrapesJS ends text editing (RTE) on any mousedown in the main document. Keep the RTE alive
    // while the user works in the picker, so "font for the selected text" can be applied.
    this.root.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  private weightName(w: number): string {
    const key = `w${w}` as keyof FontsMessages;
    return (WEIGHTS.includes(w) && this.t(key)) || String(w);
  }

  private variantLabel(v: VariantKey): string {
    const p = parseVariant(v);
    return `${this.weightName(p.weight)} ${p.weight}${p.italic ? ` · ${this.t('italic')}` : ''}`;
  }

  // ---------------------------------------------------------------- state

  private setTab(tab: 'catalog' | 'project') {
    this.tab = tab;
    this.refresh();
  }

  private setQuery(patch: Partial<CatalogQuery>) {
    const prevPage = this.query.page;
    this.query = { ...this.query, ...patch };
    this.save();
    this.refresh();
    if (this.query.page !== prevPage) this.refs.list?.scrollTo?.({ top: 0 });
  }

  /** Reflect the query in the form controls (after reset / restore). */
  private syncControls() {
    const r = this.refs;
    const q = this.query;
    const setVal = (el: HTMLElement | undefined, v: string) => {
      if (el && (el as HTMLInputElement).value !== v) (el as HTMLInputElement).value = v;
    };
    setVal(r.sort, q.sort);
    setVal(r.source, q.providers.length === 1 ? String(q.providers[0]) : '');
    setVal(r.weight, String(q.weight || 0));
    setVal(r.pageSize, String(q.pageSize));
    if (r.variable) (r.variable as HTMLInputElement).checked = q.variableOnly;
    if (r.italic) (r.italic as HTMLInputElement).checked = q.italicOnly;
  }

  private refresh() {
    if (!this.root) return;
    const projectCount = this.manager.project.list().length;
    this.refs.tabProject.textContent = this.t('tabProject', { count: projectCount });
    this.refs.tabCatalog.setAttribute('aria-selected', String(this.tab === 'catalog'));
    this.refs.tabProject.setAttribute('aria-selected', String(this.tab === 'project'));
    const isCatalog = this.tab === 'catalog';
    this.refs.toolbar.hidden = !isCatalog;
    this.refs.filters.hidden = !isCatalog;
    this.refs.pager.hidden = !isCatalog;
    this.refs.pageSize.hidden = !isCatalog;
    this.syncControls();
    this.renderChips();
    this.renderSubsets();
    this.renderBanner();
    this.renderList();
    this.renderDetails();
  }

  private renderChips() {
    const chips = this.refs.chips;
    clear(chips);
    const cats = this.query.categories;
    const all = h('button', { type: 'button', class: 'gjs-fonts-chip', 'aria-pressed': String(!cats.length), onclick: () => this.setQuery({ categories: [], page: 1 }) }, this.t('allCategories'));
    chips.appendChild(all);
    for (const c of FONT_CATEGORIES) {
      const on = cats.includes(c);
      chips.appendChild(
        h('button', {
          type: 'button', class: 'gjs-fonts-chip', 'aria-pressed': String(on),
          onclick: (e: Event) => {
            const multi = (e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey || (e as MouseEvent).shiftKey;
            const next: FontCategory[] = multi ? (on ? cats.filter((x) => x !== c) : [...cats, c]) : on && cats.length === 1 ? [] : [c];
            this.setQuery({ categories: next, page: 1 });
          },
        }, this.t(CAT_KEYS[c])),
      );
    }
  }

  private renderSubsets() {
    const sel = this.refs.subset as HTMLSelectElement;
    const subsets = collectSubsets(this.manager.catalog.getFonts());
    if (this.query.subset && !subsets.includes(this.query.subset)) subsets.unshift(this.query.subset);
    const sig = subsets.join(',');
    if (sel.dataset.sig !== sig) {
      clear(sel);
      sel.appendChild(h('option', { value: '' }, this.t('anySubset')));
      for (const s of subsets) sel.appendChild(h('option', { value: s }, s));
      sel.dataset.sig = sig;
    }
    sel.value = this.query.subset;
  }

  private renderBanner() {
    const box = this.refs.banner;
    clear(box);
    for (const p of this.manager.providers) {
      const st = this.manager.catalog.states.get(p.id);
      if (st?.status !== 'error') continue;
      box.appendChild(
        h('div', { class: 'gjs-fonts-banner', role: 'alert' },
          h('span', { class: 'gjs-fonts-banner__text', title: st.error || '' }, this.t('loadError', { provider: p.label })),
          h('button', { type: 'button', class: 'gjs-fonts-btn', onclick: () => this.manager.catalog.load(p.id, true) }, this.t('retry'))),
      );
    }
  }

  // ---------------------------------------------------------------- list

  private currentPreviewText(): string {
    return this.previewText.trim() || this.t('previewText');
  }

  private renderList() {
    const list = this.refs.list;
    if (!list) return;
    if (this.tab === 'project') return this.renderProjectList();
    const fonts = this.manager.catalog.getFonts(this.query.providers);
    const res = runQuery(fonts, this.query);
    if (res.page !== this.query.page) this.query.page = res.page;
    clear(list);

    const loading = this.manager.catalog.isLoading();
    if (!res.total) {
      list.appendChild(
        loading
          ? h('div', { class: 'gjs-fonts-empty' }, h('div', { class: 'gjs-fonts-spinner' }), this.t('loading'))
          : h('div', { class: 'gjs-fonts-empty' }, this.t('noResults'),
              fonts.length ? h('button', { type: 'button', class: 'gjs-fonts-btn', onclick: () => this.resetFilters() }, this.t('resetFilters')) : null),
      );
    } else {
      const grid = h('div', { class: 'gjs-fonts-grid', role: 'listbox' });
      const text = this.currentPreviewText();
      for (const font of res.items) grid.appendChild(this.renderCard(font, text));
      list.appendChild(grid);
    }
    this.refs.info.textContent = res.total
      ? this.t('resultsRange', { from: res.offset + 1, to: res.offset + res.items.length, total: res.total.toLocaleString() })
      : '';
    this.renderPager(res.page, res.pages);
  }

  private resetFilters() {
    (this.refs.search as HTMLInputElement).value = '';
    this.setQuery({ ...DEFAULT_QUERY, pageSize: this.query.pageSize, sort: this.query.sort });
  }

  private renderCard(font: CatalogFont, text: string): HTMLElement {
    const pf = this.manager.project.get(font.family);
    const selected = this.selection?.font.key === font.key || (this.selection?.kind === 'project' && this.selection.project.family === font.family);
    const preview = h('div', { class: 'gjs-fonts-card__preview is-pending', style: { fontFamily: fontFamilyValue(font.family, font.category) } }, text);
    const card = h('button', {
      type: 'button', class: 'gjs-fonts-card', role: 'option', 'aria-selected': String(!!selected), title: font.family,
      onclick: () => this.selectCatalog(font),
      ondblclick: () => {
        this.selectCatalog(font);
        this.applySelection();
      },
    },
      h('div', { class: 'gjs-fonts-card__name' }, font.family),
      pf ? h('span', { class: 'gjs-fonts-card__added', title: this.t('inProject') }, '✓') : null,
      preview,
      h('div', { class: 'gjs-fonts-card__meta' },
        h('span', { class: 'gjs-fonts-badge' }, this.manager.providerLabel(font.provider)),
        h('span', null, this.t(CAT_KEYS[font.category])),
        h('span', null, this.t('stylesCount', { count: font.variants.length })),
        font.variable ? h('span', { class: 'gjs-fonts-badge' }, this.t('variable')) : null));
    const pv = previewVariant(font.variants);
    this.manager.loadPreview(font, [pv], text);
    this.whenLoaded(font.family, pv, text).then(() => preview.classList.remove('is-pending'));
    return card;
  }

  private whenLoaded(family: string, v: VariantKey, text: string): Promise<void> {
    const fonts: FontFaceSet | undefined = (document as any).fonts;
    if (!fonts?.load) return Promise.resolve();
    const p = parseVariant(v);
    const spec = `${p.italic ? 'italic ' : ''}${p.weight} 16px "${family.replace(/"/g, '')}"`;
    const timeout = new Promise<void>((res) => setTimeout(res, 4000));
    return Promise.race([fonts.load(spec, text).then(() => undefined, () => undefined), timeout]);
  }

  private renderPager(page: number, pages: number) {
    const nav = this.refs.pager;
    clear(nav);
    if (pages <= 1) return;
    const go = (p: number) => this.setQuery({ page: p });
    nav.appendChild(h('button', { type: 'button', disabled: page <= 1, title: this.t('prevPage'), 'aria-label': this.t('prevPage'), onclick: () => go(page - 1) }, '‹'));
    for (const p of pagerPages(page, pages)) {
      if (!p) nav.appendChild(h('span', { class: 'gjs-fonts-pager__gap' }, '…'));
      else nav.appendChild(h('button', { type: 'button', 'aria-current': p === page ? 'page' : null, onclick: () => go(p) }, String(p)));
    }
    nav.appendChild(h('button', { type: 'button', disabled: page >= pages, title: this.t('nextPage'), 'aria-label': this.t('nextPage'), onclick: () => go(page + 1) }, '›'));
  }

  private renderProjectList() {
    const list = this.refs.list;
    clear(list);
    const fonts = this.manager.project.list();
    this.refs.info.textContent = '';
    clear(this.refs.pager);
    if (!fonts.length) {
      list.appendChild(h('div', { class: 'gjs-fonts-empty' }, this.t('projectEmpty'),
        h('button', { type: 'button', class: 'gjs-fonts-btn', onclick: () => this.setTab('catalog') }, this.t('tabCatalog'))));
      return;
    }
    const wrap = h('div', { class: 'gjs-fonts-project' });
    for (const pf of fonts) {
      this.manager.loadPreview(pf, pf.variants);
      const selected = this.selection?.kind === 'project' && this.selection.project.family === pf.family;
      wrap.appendChild(
        h('div', { class: 'gjs-fonts-prow', 'aria-selected': String(selected) },
          h('div', { class: 'gjs-fonts-prow__main', role: 'button', tabindex: '0', onclick: () => this.selectProject(pf), onkeydown: (e: Event) => (e as KeyboardEvent).key === 'Enter' && this.selectProject(pf) },
            h('div', { class: 'gjs-fonts-prow__name', style: { fontFamily: fontFamilyValue(pf.family, pf.category) } }, pf.family),
            h('div', { class: 'gjs-fonts-prow__meta' }, `${this.manager.providerLabel(pf.provider)} · ${pf.variants.map((v) => this.variantLabel(v)).join(', ')}`)),
          h('button', { type: 'button', class: 'gjs-fonts-btn', disabled: !this.canApply(), onclick: () => this.applyProject(pf) }, this.t('apply')),
          h('button', { type: 'button', class: 'gjs-fonts-btn gjs-fonts-btn--danger', title: this.t('removeFromProject'), 'aria-label': this.t('removeFromProject'), onclick: () => this.removeFont(pf.family) }, '✕')),
      );
    }
    list.appendChild(wrap);
  }

  // ---------------------------------------------------------------- selection & details

  private selectCatalog(font: CatalogFont, render = true) {
    const pf = this.manager.project.get(font.family);
    if (pf && pf.provider === font.provider && pf.id === font.id) {
      this.selection = { kind: 'project', font, project: pf };
      this.selVariants = pf.variants.slice();
    } else {
      this.selection = { kind: 'catalog', font };
      this.selVariants = defaultVariants(font.variants);
    }
    if (render) {
      this.renderList();
      this.renderDetails();
    }
  }

  private selectProject(pf: ProjectFont, render = true) {
    const cf = this.manager.catalog.find(pf.provider, pf.id);
    const font: CatalogFont = cf || {
      key: `${pf.provider}:${pf.id}`, provider: pf.provider, id: pf.id, family: pf.family, category: pf.category,
      variants: pf.variants, subsets: [], variable: false, meta: pf.meta,
    };
    this.selection = { kind: 'project', font, project: pf };
    this.selVariants = pf.variants.slice();
    if (render) {
      this.renderList();
      this.renderDetails();
    }
  }

  private canApply(): boolean {
    return !!this.openOpts.onApply || !!this.manager.getTarget();
  }

  private renderDetails() {
    const box = this.refs.details;
    if (!box) return;
    clear(box);
    const sel = this.selection;
    if (!sel) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const { font } = sel;
    const inProject = this.manager.project.get(font.family);
    const sameSource = !!inProject && inProject.provider === font.provider && inProject.id === font.id;
    const text = this.currentPreviewText();
    this.manager.loadPreview(font, font.variants, text);

    const provider = this.manager.catalog.getProvider(font.provider);
    const sub = h('div', { class: 'gjs-fonts-details__sub' },
      provider?.homepage ? h('a', { href: provider.homepage, target: '_blank', rel: 'noopener noreferrer' }, provider.label) : h('span', null, this.manager.providerLabel(font.provider)),
      h('span', null, `· ${this.t(CAT_KEYS[font.category])}`),
      font.variable ? h('span', null, `· ${this.t('variable')}`) : null,
      font.alternatives?.length ? h('span', null, `· ${this.t('alsoOn', { providers: font.alternatives.map((p) => this.manager.providerLabel(p)).join(', ') })}`) : null);

    const variants = h('div', { class: 'gjs-fonts-variants' });
    const ordered = font.variants.length ? font.variants : ['400'];
    for (const v of ordered) {
      const p = parseVariant(v);
      const cb = h('input', { type: 'checkbox', value: v });
      cb.checked = this.selVariants.includes(v);
      cb.addEventListener('change', () => {
        this.selVariants = cb.checked ? normalizeVariants([...this.selVariants, v]) : this.selVariants.filter((x) => x !== v);
        this.updateDetailButtons();
      });
      variants.appendChild(
        h('label', { class: 'gjs-fonts-variant' }, cb,
          h('span', { style: { minWidth: '0' } },
            h('span', { class: 'gjs-fonts-variant__sample', style: { fontFamily: fontFamilyValue(font.family, font.category), fontWeight: String(p.weight), fontStyle: p.italic ? 'italic' : 'normal' } }, text),
            h('span', { class: 'gjs-fonts-variant__label' }, this.variantLabel(v)))));
    }

    const applyBtn = h('button', { type: 'button', class: 'gjs-fonts-btn gjs-fonts-btn--primary', onclick: () => this.applySelection() }, this.t('apply'));
    const addBtn = h('button', { type: 'button', class: 'gjs-fonts-btn', onclick: () => this.addSelection() }, sameSource ? this.t('updateProject') : this.t('addToProject'));
    const removeBtn = inProject ? h('button', { type: 'button', class: 'gjs-fonts-btn gjs-fonts-btn--danger', onclick: () => this.removeFont(inProject.family) }, this.t('removeFromProject')) : null;
    const hint = h('div', { class: 'gjs-fonts-hint' });
    this.refs.applyBtn = applyBtn;
    this.refs.addBtn = addBtn;
    this.refs.hint = hint;

    box.append(
      h('div', { class: 'gjs-fonts-details__title', style: { fontFamily: fontFamilyValue(font.family, font.category) } }, font.family),
      sub,
      h('div', { class: 'gjs-fonts-hint' }, this.t('styles')),
      h('div', { class: 'gjs-fonts-details__scroll' }, variants),
      h('div', { class: 'gjs-fonts-details__actions' }, hint, applyBtn, addBtn, removeBtn),
    );
    this.updateDetailButtons();
  }

  private updateDetailButtons() {
    const can = this.canApply();
    const has = this.selVariants.length > 0;
    (this.refs.applyBtn as HTMLButtonElement | undefined)?.toggleAttribute('disabled', !can || !has);
    (this.refs.addBtn as HTMLButtonElement | undefined)?.toggleAttribute('disabled', !has);
    if (this.refs.hint) this.refs.hint.textContent = can ? '' : this.t('noTarget');
  }

  private addSelection(): ProjectFont | null {
    const sel = this.selection;
    if (!sel || !this.selVariants.length) return null;
    const pf = this.manager.add(sel.font, this.selVariants, { merge: false });
    if (pf) this.status(this.t('inProject') + ': ' + pf.family);
    return pf;
  }

  private applySelection() {
    if (!this.canApply()) return;
    const pf = this.addSelection();
    if (pf) this.applyProject(pf);
  }

  private applyProject(pf: ProjectFont) {
    const value = fontFamilyValue(pf.family, pf.category);
    if (this.openOpts.onApply) {
      this.openOpts.onApply(pf, value);
    } else if (!this.manager.apply(pf.family)) {
      this.updateDetailButtons();
      return;
    }
    this.close();
  }

  private removeFont(family: string) {
    this.manager.remove(family);
    if (this.selection?.kind === 'project' && this.selection.project.family === family) {
      const font = this.selection.font;
      this.selection = { kind: 'catalog', font };
      this.selVariants = defaultVariants(font.variants);
    }
  }

  private status(msg: string) {
    const el = this.refs.status;
    if (!el) return;
    el.textContent = msg;
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => (el.textContent = ''), 3000);
  }
}

export { SUBSET_BY_LOCALE };
