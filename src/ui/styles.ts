// NOTE: no backticks inside this template literal (comments included).
export const STYLES = `
.gjs-fonts-dialog.gjs-mdl-dialog { max-width: 1100px; width: 94vw; }
.gjs-fonts-dialog .gjs-mdl-content { padding: 0; }
.gjs-fonts { --gf-line: rgba(127,127,127,.28); --gf-soft: rgba(127,127,127,.12); --gf-accent: var(--gjs-color-highlight, #3b97e3);
  display: flex; flex-direction: column; height: min(78vh, 820px); min-height: 520px; font-size: 13px; line-height: 1.35; }
.gjs-fonts [hidden] { display: none !important; }
.gjs-fonts button, .gjs-fonts input, .gjs-fonts select { font: inherit; color: inherit; }
.gjs-fonts button { cursor: pointer; }
.gjs-fonts-btn { background: var(--gf-soft); border: 1px solid var(--gf-line); border-radius: 4px; padding: 5px 10px; white-space: nowrap; }
.gjs-fonts-btn:hover:not(:disabled) { border-color: var(--gf-accent); }
.gjs-fonts-btn:disabled { opacity: .45; cursor: default; }
.gjs-fonts-btn--primary { background: var(--gf-accent); border-color: var(--gf-accent); color: #fff !important; }
.gjs-fonts-btn--danger:hover:not(:disabled) { border-color: #e5534b; color: #e5534b; }
.gjs-fonts-input, .gjs-fonts-select { background: rgba(0,0,0,.12); border: 1px solid var(--gf-line); border-radius: 4px; padding: 5px 8px; min-width: 0; }
.gjs-fonts-select option { color: #222; }
.gjs-fonts-input:focus, .gjs-fonts-select:focus { outline: none; border-color: var(--gf-accent); }

.gjs-fonts-tabs { display: flex; gap: 2px; padding: 0 14px; border-bottom: 1px solid var(--gf-line); flex: none; }
.gjs-fonts-tab { background: none; border: 0; border-bottom: 2px solid transparent; padding: 10px 12px 8px; opacity: .75; }
.gjs-fonts-tab[aria-selected="true"] { opacity: 1; border-bottom-color: var(--gf-accent); }
.gjs-fonts-tabs__spacer { flex: 1; }
.gjs-fonts-tabs .gjs-fonts-btn { align-self: center; padding: 3px 8px; }

.gjs-fonts-toolbar { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 14px 6px; align-items: center; flex: none; }
.gjs-fonts-search { flex: 1 1 260px; position: relative; display: flex; }
.gjs-fonts-search .gjs-fonts-input { flex: 1; padding-left: 28px; }
.gjs-fonts-search svg { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; opacity: .6; pointer-events: none; }
.gjs-fonts-filters { display: flex; flex-wrap: wrap; gap: 6px 10px; padding: 0 14px 8px; align-items: center; flex: none; }
.gjs-fonts-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.gjs-fonts-chip { background: none; border: 1px solid var(--gf-line); border-radius: 999px; padding: 3px 10px; }
.gjs-fonts-chip[aria-pressed="true"] { background: var(--gf-accent); border-color: var(--gf-accent); color: #fff; }
.gjs-fonts-check { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; cursor: pointer; }
.gjs-fonts-preview-ctrl { display: flex; gap: 8px; align-items: center; flex: 1 1 280px; }
.gjs-fonts-preview-ctrl .gjs-fonts-input { flex: 1; }
.gjs-fonts-preview-ctrl input[type=range] { width: 90px; }

.gjs-fonts-banner { margin: 0 14px 8px; padding: 6px 10px; border-radius: 4px; background: rgba(229,83,75,.14); border: 1px solid rgba(229,83,75,.45); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.gjs-fonts-banner__text { flex: 1; }

.gjs-fonts-main { flex: 1; display: flex; min-height: 0; border-top: 1px solid var(--gf-line); }
.gjs-fonts-list { flex: 1; overflow: auto; padding: 12px 14px; min-width: 0; }
.gjs-fonts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.gjs-fonts-card { text-align: start; background: var(--gf-soft); border: 1px solid var(--gf-line); border-radius: 6px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; min-width: 0; position: relative; }
.gjs-fonts-card:hover { border-color: var(--gf-accent); }
.gjs-fonts-card[aria-selected="true"] { border-color: var(--gf-accent); box-shadow: 0 0 0 1px var(--gf-accent) inset; }
.gjs-fonts-card__name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-inline-end: 18px; }
.gjs-fonts-card__preview { font-size: var(--gf-size, 28px); line-height: 1.2; height: calc(var(--gf-size, 28px) * 2.4); overflow: hidden; word-break: break-word; transition: opacity .2s; }
.gjs-fonts-card__preview.is-pending { opacity: .35; }
.gjs-fonts-card__meta { display: flex; gap: 6px; flex-wrap: wrap; font-size: 11px; opacity: .75; }
.gjs-fonts-badge { border: 1px solid var(--gf-line); border-radius: 3px; padding: 0 5px; }
.gjs-fonts-card__added { position: absolute; top: 9px; inset-inline-end: 10px; color: var(--gf-accent); font-weight: 700; }

.gjs-fonts-empty { padding: 40px 10px; text-align: center; opacity: .8; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.gjs-fonts-spinner { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--gf-line); border-top-color: var(--gf-accent); animation: gjs-fonts-spin .8s linear infinite; }
@keyframes gjs-fonts-spin { to { transform: rotate(360deg); } }

.gjs-fonts-details { width: 320px; flex: none; border-inline-start: 1px solid var(--gf-line); overflow: hidden; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.gjs-fonts-details__scroll { flex: 1 1 auto; min-height: 60px; overflow: auto; margin: 0 -6px; padding: 0 6px; }
.gjs-fonts-details__title { font-size: 18px; font-weight: 600; word-break: break-word; }
.gjs-fonts-details__sub { font-size: 12px; opacity: .75; display: flex; flex-wrap: wrap; gap: 2px 6px; }
.gjs-fonts-details__sub a { color: inherit; }
.gjs-fonts-variants { display: flex; flex-direction: column; gap: 2px; }
.gjs-fonts-variant { display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: center; padding: 3px 4px; border-radius: 4px; cursor: pointer; }
.gjs-fonts-variant:hover { background: var(--gf-soft); }
.gjs-fonts-variant__sample { display: block; font-size: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gjs-fonts-variant__label { font-size: 11px; opacity: .7; display: block; }
.gjs-fonts-details__actions { display: flex; flex-direction: column; gap: 6px; flex: none; }
.gjs-fonts-hint { font-size: 12px; opacity: .75; }

.gjs-fonts-footer { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-top: 1px solid var(--gf-line); flex: none; flex-wrap: wrap; }
.gjs-fonts-footer__info { opacity: .8; min-width: 110px; }
.gjs-fonts-footer__status { flex: 1; text-align: end; color: var(--gf-accent); min-height: 1em; }
.gjs-fonts-pager { display: flex; gap: 3px; align-items: center; flex-wrap: wrap; }
.gjs-fonts-pager button { min-width: 30px; padding: 3px 7px; background: none; border: 1px solid transparent; border-radius: 4px; }
.gjs-fonts-pager button:hover:not(:disabled) { border-color: var(--gf-line); }
.gjs-fonts-pager button[aria-current="page"] { border-color: var(--gf-accent); color: var(--gf-accent); font-weight: 600; }
.gjs-fonts-pager button:disabled { opacity: .35; cursor: default; }
.gjs-fonts-pager__gap { padding: 0 4px; opacity: .6; }

.gjs-fonts-project { display: flex; flex-direction: column; gap: 8px; }
.gjs-fonts-prow { display: flex; gap: 10px; align-items: center; padding: 8px 10px; border: 1px solid var(--gf-line); border-radius: 6px; background: var(--gf-soft); }
.gjs-fonts-prow[aria-selected="true"] { border-color: var(--gf-accent); }
.gjs-fonts-prow__main { flex: 1; min-width: 0; cursor: pointer; }
.gjs-fonts-prow__name { font-size: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gjs-fonts-prow__meta { font-size: 11px; opacity: .75; }

.gjs-fonts-sm { display: flex; gap: 4px; align-items: stretch; width: 100%; }
.gjs-fonts-sm select { flex: 1; min-width: 0; }
.gjs-fonts-sm button { flex: none; padding: 0 7px; background: none; border: 1px solid rgba(127,127,127,.35); border-radius: 2px; color: inherit; cursor: pointer; font-family: Georgia, serif; }

@media (max-width: 760px) {
  .gjs-fonts-dialog.gjs-mdl-dialog { width: 100vw; max-width: 100vw; margin-top: 0; }
  .gjs-fonts { height: calc(100vh - 60px); min-height: 0; }
  .gjs-fonts-toolbar, .gjs-fonts-filters { padding-left: 10px; padding-right: 10px; gap: 6px; }
  .gjs-fonts-chips { flex-wrap: nowrap; overflow-x: auto; width: 100%; padding-bottom: 2px; }
  .gjs-fonts-chip { flex: none; }
  .gjs-fonts-filters > .gjs-fonts-select { flex: 1 1 40%; }
  .gjs-fonts-main { flex-direction: column; }
  .gjs-fonts-list { padding: 10px; }
  .gjs-fonts-details { width: auto; border-inline-start: 0; border-top: 1px solid var(--gf-line); max-height: 42%; padding: 10px; overflow: auto; }
  .gjs-fonts-details__scroll { flex: none; overflow: visible; }
  .gjs-fonts-details__actions { flex-direction: row; flex-wrap: wrap; }
  .gjs-fonts-details__actions .gjs-fonts-btn { flex: 1 1 auto; }
  .gjs-fonts-grid { grid-template-columns: 1fr; }
  .gjs-fonts-card__preview { height: calc(var(--gf-size, 28px) * 1.3); }
}
`;

let injected = false;

export function injectStyles(doc: Document = document) {
  if (injected && doc === document) return;
  if (doc.getElementById('gjs-fonts-styles')) return;
  const style = doc.createElement('style');
  style.id = 'gjs-fonts-styles';
  style.textContent = STYLES;
  doc.head.appendChild(style);
  if (doc === document) injected = true;
}
