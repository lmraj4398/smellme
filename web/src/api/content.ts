import { useQuery } from '@tanstack/react-query';
import { api } from './client';

// Shapes mirror the section specs in api/src/models/content/content.pages.ts.
// Every field can be an empty string/list (the owner may blank it), so the UI must hide empty blocks.
export interface HomeContent {
  hero: { eyebrow: string; headline: string; body: string; primary_label: string; secondary_label: string; image: string };
  trust: { items: { title: string; sub: string }[] };
  families: { eyebrow: string; heading: string };
  bestsellers: { eyebrow: string; heading: string };
  originals: { eyebrow: string; heading: string; body: string; image_1: string; image_2: string; stats: { value: string; label: string }[]; cta_label: string };
  discovery: { eyebrow: string; heading: string; body: string; price_text: string; cta_label: string };
  quiz: { eyebrow: string; heading: string; body: string; steps: { text: string }[]; cta_label: string };
  moments: { eyebrow: string; heading: string; items: { label: string; sub: string }[] };
  guides: { eyebrow: string; heading: string; items: { tag: string; title: string; image: string }[] };
  newsletter: { kicker: string; heading: string };
}
interface GiftingContent {
  hero: { eyebrow: string; heading: string; body: string };
  sets: { eyebrow: string; heading: string; items: { name: string; tag: string; description: string; price_text: string; product_slug: string; image: string }[] };
  personalise: { eyebrow: string; heading: string; wrap_price_text: string };
  occasions: { heading: string; items: { label: string; image: string }[] };
  corporate: { eyebrow: string; heading: string; cta_label: string };
}
export interface AboutContent {
  hero: { eyebrow: string; heading: string; body: string };
  story: { kicker: string; heading: string; paragraph_1: string; paragraph_2: string; image: string };
  values: { heading: string; items: { title: string; body: string }[] };
  steps: { eyebrow: string; heading: string; items: { title: string; body: string }[] };
  visit: { eyebrow: string; place: string; details: string; cta_label: string };
}
interface HelpContent {
  hero: { eyebrow: string; heading: string };
  faq: { categories: { name: string; faqs: { q: string; a: string }[] }[] };
  contact: { heading: string; body: string };
}
export interface SiteContent {
  site: { announcement: string; tagline: string; whatsapp: string; phone: string; email: string; hours: string; instagram: string; youtube: string };
}
export interface ContentMap { home: HomeContent; gifting: GiftingContent; about: AboutContent; help: HelpContent; site: SiteContent }

/** One page of editable content. Cached for a minute, like the API's own Cache-Control. */
export function useContent<P extends keyof ContentMap>(page: P) {
  return useQuery({
    queryKey: ['content', page],
    queryFn: () => api.get<{ page: string; sections: ContentMap[P] }>(`/content/${page}`).then((r) => r.data.sections),
    staleTime: 60_000,
  });
}

export const inboxApi = {
  contact: (b: { name: string; phone?: string; email?: string; topic: string; message: string; website?: string }) =>
    api.post<{ ok: true }>('/contact', b).then((r) => r.data),
  subscribe: (b: { email: string; website?: string }) => api.post<{ ok: true }>('/newsletter', b).then((r) => r.data),
};

export const CONTACT_TOPICS = [
  'Help choosing a fragrance', 'An order I placed', 'Returns & refunds', 'Corporate or wedding gifting', 'Something else',
] as const;
