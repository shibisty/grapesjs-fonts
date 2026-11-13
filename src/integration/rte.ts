import type { Editor } from 'grapesjs';
import type { FontsManager } from '../core/manager';
import type { FontPicker } from '../ui/picker';
import type { ProjectFont } from '../types';

export const RTE_ACTION = 'fontFamily';

/**
 * Wrap the range in `<span style="font-family: …">`. Nested `font-family` declarations inside the
 * wrapped fragment are removed so the new font wins. Returns the span, or null for an empty range.
 */
export function wrapRangeWithFont(range: Range, value: string): HTMLElement | null {
  if (range.collapsed) return null;
  const doc = range.startContainer.ownerDocument as Document;
  const span = doc.createElement('span');
  span.style.fontFamily = value;
  const frag = range.extractContents();
  frag.querySelectorAll?.('[style]').forEach((el) => {
    const e = el as HTMLElement;
    if (!e.style.fontFamily) return;
    e.style.fontFamily = '';
    if (!e.getAttribute('style')?.trim()) e.removeAttribute('style');
  });
  span.appendChild(frag);
  range.insertNode(span);
  // Drop an empty text node left behind by extractContents.
  [span.previousSibling, span.nextSibling].forEach((n) => {
    if (n && n.nodeType === 3 && !n.nodeValue) n.parentNode?.removeChild(n);
  });
  return span;
}

/**
 * Wraps a text range of the canvas in the font and puts the change into the
 * component model (also when the Rich Text Editor is already closed).
 * Returns false when the range is empty or no longer in the document.
 */
export function applyFontToRange(
  editor: Editor,
  range: Range,
  font: ProjectFont,
  value: string,
  editing: any = (editor as any).getEditing?.() || editor.getSelected(),
): boolean {
  const container = range.commonAncestorContainer;
  if (range.collapsed || !container.isConnected) return false;
  const view = editing?.getView?.() || editing?.view;
  const el: HTMLElement | undefined = view?.el;
  if (el && !el.contains(container)) return false;
  const span = wrapRangeWithFont(range, value);
  if (!span) return false;
  // RTE already closed: push the DOM change into the component model ourselves.
  if (view && !view.rteEnabled) view.syncContent?.({ force: true });
  const doc = span.ownerDocument;
  const s = doc.getSelection();
  const r = doc.createRange();
  r.selectNodeContents(span);
  s?.removeAllRanges();
  s?.addRange(r);
  (el || span).dispatchEvent(new Event('input', { bubbles: true }));
  editor.trigger('fonts:apply', { font, value, target: editing, range: r });
  return true;
}

/** Adds an "Aa" action to the built-in Rich Text Editor toolbar. */
export function setupRte(editor: Editor, manager: FontsManager, picker: FontPicker, title: string) {
  const add = () => {
    const rteModule: any = (editor as any).RichTextEditor;
    if (!rteModule?.add || rteModule.get?.(RTE_ACTION)) return;
    rteModule.add(RTE_ACTION, {
      icon: '<span style="font-family: Georgia, serif; font-size: 14px; line-height: 1;">Aa</span>',
      attributes: { title, 'data-gjs-fonts-rte': '' },
      // Never "active": there is no execCommand for this action.
      state: () => 0,
      result: (rte: any) => {
        const doc: Document = rte.doc;
        const el: HTMLElement = rte.el;
        const sel = doc.getSelection();
        const saved = sel && sel.rangeCount && el.contains(sel.getRangeAt(0).commonAncestorContainer) ? sel.getRangeAt(0).cloneRange() : null;
        const editing = (editor as any).getEditing?.() || editor.getSelected();
        picker.open({
          onApply: (font, value) => {
            // The range is usable only if its nodes are still in the text element (they are not if the
            // RTE was closed and the content re-rendered meanwhile).
            if (saved && el.isConnected && el.contains(saved.commonAncestorContainer) && applyFontToRange(editor, saved, font, value, editing)) {
              return;
            }
            // No text selected: apply to the whole text block.
            manager.apply(font.family, editing && editing.addStyle ? editing : manager.getTarget());
          },
        });
      },
    });
  };
  editor.onReady ? editor.onReady(add) : editor.on('load', add);
}
