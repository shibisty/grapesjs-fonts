import type { Editor } from 'grapesjs';
import type { FontsManager } from '../core/manager';
import { firstFamily, fontFamilyValue } from '../core/variants';
import { h } from '../ui/dom';
import type { FontPicker } from '../ui/picker';

export const PROPERTY_TYPE = 'font-picker';
const BROWSE = '__gjs_fonts_browse__';

interface Option {
  id: string;
  label: string;
}

export interface StyleManagerIntegrationOptions {
  /** Replace the built-in `font-family` select with the plugin's property (select + browse button). */
  replace: boolean;
  /** System font options (default: the options of the built-in `font-family` property). */
  systemFonts?: Option[];
}

/** Options of the original `font-family` property (taken before it is replaced). */
function findFontFamilyProps(editor: Editor): Array<{ sector: any; prop: any; index: number }> {
  const sm: any = (editor as any).StyleManager;
  const out: Array<{ sector: any; prop: any; index: number }> = [];
  const sectors: any[] = sm?.getSectors?.()?.models || sm?.getSectors?.() || [];
  for (const sector of Array.from(sectors)) {
    const props: any[] = sector.getProperties?.() || sector.get?.('properties')?.models || [];
    Array.from(props).forEach((prop: any, index: number) => {
      const name = prop.getName?.() || prop.get?.('property');
      if (name === 'font-family') out.push({ sector, prop, index });
    });
  }
  return out;
}

function toOptions(raw: any[]): Option[] {
  return (raw || [])
    .map((o: any) => (typeof o === 'string' ? { id: o, label: firstFamily(o) } : { id: String(o.id ?? o.value ?? ''), label: String(o.label ?? o.name ?? o.id ?? '') }))
    .filter((o) => o.id);
}

export function setupStyleManager(editor: Editor, manager: FontsManager, picker: FontPicker, opts: StyleManagerIntegrationOptions) {
  const sm: any = (editor as any).StyleManager;
  if (!sm) return;
  const t = manager.t;
  let systemFonts: Option[] = opts.systemFonts || [];
  const selects = new Set<HTMLSelectElement>();

  const projectOptions = (): Option[] =>
    manager.project.list().map((f) => ({ id: fontFamilyValue(f.family, f.category), label: f.family }));

  const fillSelect = (select: HTMLSelectElement, value: string) => {
    while (select.firstChild) select.removeChild(select.firstChild);
    select.appendChild(h('option', { value: '' }, `— ${t('defaultFont')} —`));
    const proj = projectOptions();
    const known = new Set<string>(['']);
    if (proj.length) {
      const g = h('optgroup', { label: t('projectFonts') });
      proj.forEach((o) => {
        known.add(o.id);
        g.appendChild(h('option', { value: o.id, style: { fontFamily: o.id } }, o.label));
      });
      select.appendChild(g);
    }
    const sys = systemFonts.filter((o) => !known.has(o.id));
    if (sys.length) {
      const g = h('optgroup', { label: t('systemFonts') });
      sys.forEach((o) => {
        known.add(o.id);
        g.appendChild(h('option', { value: o.id, style: { fontFamily: o.id } }, o.label));
      });
      select.appendChild(g);
    }
    if (value && !known.has(value)) {
      // Value not in the lists (set elsewhere): show it as is, matched by first family if possible.
      const pf = manager.fromValue(value);
      const match = pf ? fontFamilyValue(pf.family, pf.category) : '';
      if (!match || !known.has(match)) select.insertBefore(h('option', { value }, firstFamily(value) || value), select.children[1] || null);
    }
    select.appendChild(h('option', { value: BROWSE }, t('browseFonts')));
    const pf = manager.fromValue(value);
    const normalized = pf ? fontFamilyValue(pf.family, pf.category) : value;
    select.value = Array.from(select.options).some((o) => o.value === normalized) ? normalized : value;
    select.dataset.value = select.value;
  };

  sm.addType(PROPERTY_TYPE, {
    create({ change }: { change: (arg: { value: string }) => void }) {
      const select = h('select', { class: 'gjs-fonts-sm__select', 'aria-label': 'font-family' });
      const openPicker = () => {
        const current = select.dataset.value || '';
        picker.open({
          family: firstFamily(current) || undefined,
          onApply: (_font, value) => change({ value }),
        });
      };
      select.addEventListener('change', () => {
        if (select.value === BROWSE) {
          select.value = select.dataset.value || '';
          openPicker();
          return;
        }
        select.dataset.value = select.value;
        change({ value: select.value });
      });
      const btn = h('button', { type: 'button', title: t('browseFonts'), 'aria-label': t('browseFonts'), onclick: openPicker }, 'Aa');
      selects.add(select);
      fillSelect(select, '');
      // Inherit GrapesJS field look.
      return h('div', { class: 'gjs-fonts-sm' }, h('div', { class: 'gjs-field gjs-select', style: { flex: '1', minWidth: '0' } }, select), btn);
    },
    emit({ updateStyle }: { updateStyle: (v: string) => void }, { value }: { value: string }) {
      updateStyle(value);
    },
    update({ value, el }: { value: string; el: HTMLElement }) {
      const select = el.querySelector('select.gjs-fonts-sm__select') as HTMLSelectElement | null;
      if (select) fillSelect(select, value || '');
    },
    destroy({ el }: { el?: HTMLElement } = {}) {
      const select = el?.querySelector('select.gjs-fonts-sm__select') as HTMLSelectElement | null;
      if (select) selects.delete(select);
    },
  });

  const refreshSelects = () => {
    selects.forEach((s) => {
      if (!s.isConnected) {
        selects.delete(s);
        return;
      }
      fillSelect(s, s.dataset.value || '');
    });
  };

  const install = () => {
    const found = findFontFamilyProps(editor);
    if (!opts.systemFonts && found[0]) systemFonts = toOptions(found[0].prop.getOptions?.() || found[0].prop.get?.('options') || []);
    if (!opts.systemFonts && !systemFonts.length) systemFonts = toOptions(sm.getBuiltIn?.('font-family')?.options || []);
    if (opts.replace) {
      for (const { sector, prop, index } of found) {
        if (prop.getType?.() === PROPERTY_TYPE || prop.get?.('type') === PROPERTY_TYPE) continue;
        const sectorId = sector.getId?.() || sector.get?.('id');
        const def = {
          type: PROPERTY_TYPE,
          property: 'font-family',
          name: prop.get?.('name') || undefined,
          label: prop.get?.('label') || undefined,
          default: prop.get?.('default') ?? '',
          full: true,
        };
        sm.removeProperty(sectorId, 'font-family');
        sm.addProperty(sectorId, def, { at: index });
      }
    } else {
      // Keep the built-in select, but list project fonts on top of the system ones.
      const syncOptions = () => {
        for (const { prop } of findFontFamilyProps(editor)) {
          if (typeof prop.setOptions !== 'function') continue;
          const proj = projectOptions();
          const ids = new Set(proj.map((o) => o.id));
          prop.setOptions([...proj, ...systemFonts.filter((o) => !ids.has(o.id))]);
        }
      };
      syncOptions();
      manager.project.onChange(syncOptions);
    }
  };

  manager.project.onChange(refreshSelects);
  // Sectors from the config exist once the editor is loaded.
  if ((editor as any).getModel?.().get?.('readyLoad')) install();
  else editor.on('load', install);
}
