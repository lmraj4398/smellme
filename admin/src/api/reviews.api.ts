import { api } from './client';
import type { Page } from './catalog.api';

export type ReviewStatus = 'published' | 'hidden';
export interface ReviewRow {
  id: string; rating: number; title: string; body: string; status: ReviewStatus; created_at: string;
  customer_name: string | null; customer_phone: string | null; product_name: string | null; product_slug: string | null;
}

export const reviewsApi = {
  list: (q: { status?: ReviewStatus; page?: number }) => {
    const p = new URLSearchParams();
    if (q.status) p.set('status', q.status);
    if (q.page) p.set('page', String(q.page));
    return api.get<Page<ReviewRow> & { hidden: number }>(`/admin/reviews?${p}`).then((r) => r.data);
  },
  setStatus: (id: string, status: ReviewStatus) => api.patch<{ id: string; status: ReviewStatus }>(`/admin/reviews/${id}`, { status }).then((r) => r.data),
};
