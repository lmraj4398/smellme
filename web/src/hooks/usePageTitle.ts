import { useEffect } from 'react';

const BASE = 'SmellMe';

/** Sets the tab title (and meta description when given) for the current page. */
export function usePageTitle(title?: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} — ${BASE}` : `${BASE} — Perfumes, attars & SmellMe Originals`;
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description.slice(0, 160));
  }, [title, description]);
}
