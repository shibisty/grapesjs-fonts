export const LINK_ATTR = 'data-gjs-fonts';

/**
 * Make the stylesheet links marked with `attr=group` in `doc.head` match `urls` exactly
 * (adds missing, removes stale, keeps order of the rest). Returns the number of changes.
 */
export function syncLinks(doc: Document | null | undefined, group: string, urls: string[], attr = LINK_ATTR): number {
  const head = doc?.head;
  if (!doc || !head) return 0;
  let changes = 0;
  const wanted = new Set(urls);
  const existing = Array.from(head.querySelectorAll<HTMLLinkElement>(`link[${attr}="${cssEscape(group)}"]`));
  const have = new Set<string>();
  for (const link of existing) {
    const href = link.getAttribute('href') || '';
    if (!wanted.has(href) || have.has(href)) {
      link.remove();
      changes++;
    } else {
      have.add(href);
    }
  }
  for (const url of urls) {
    if (have.has(url)) continue;
    head.appendChild(createLink(doc, url, group, attr));
    have.add(url);
    changes++;
  }
  return changes;
}

/** Add links that are not present yet (never removes). Returns the newly created elements. */
export function ensureLinks(doc: Document, group: string, urls: string[], attr = LINK_ATTR): HTMLLinkElement[] {
  const head = doc.head;
  if (!head) return [];
  const present = new Set(
    Array.from(head.querySelectorAll<HTMLLinkElement>(`link[${attr}]`)).map((l) => l.getAttribute('href')),
  );
  const created: HTMLLinkElement[] = [];
  for (const url of urls) {
    if (present.has(url)) continue;
    const link = createLink(doc, url, group, attr);
    head.appendChild(link);
    present.add(url);
    created.push(link);
  }
  return created;
}

function createLink(doc: Document, url: string, group: string, attr: string): HTMLLinkElement {
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  link.setAttribute(attr, group);
  return link;
}

function cssEscape(v: string): string {
  return v.replace(/["\\]/g, '\\$&');
}
