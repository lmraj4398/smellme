import { api } from './client';
import type { Page } from './catalog.api';

// Mirrors api/src/models/content/content.types.ts.
interface TextField { type: 'text' | 'textarea'; key: string; label: string; hint?: string; max?: number; required?: boolean }
interface ImageField { type: 'image'; key: string; label: string; hint?: string }
export interface ListField { type: 'list'; key: string; label: string; hint?: string; itemLabel: string; max: number; fields: Field[] }
export type Field = TextField | ImageField | ListField;

export interface SectionSpec { key: string; title: string; description?: string; fields: Field[] }
interface PageSpec { key: string; title: string; sections: SectionSpec[] }
export interface ContentSchema { media_base: string; pages: PageSpec[] }

export type Data = Record<string, unknown>;
export interface SectionState { key: string; customised: boolean; updated_at: string | null; data: Data }

export const contentApi = {
  schema: () => api.get<ContentSchema>('/admin/content/schema').then((r) => r.data),
  page: (page: string) => api.get<{ page: string; title: string; sections: SectionState[] }>(`/admin/content/${page}`).then((r) => r.data),
  save: (page: string, section: string, data: Data) => api.put<SectionState>(`/admin/content/${page}/${section}`, { data }).then((r) => r.data),
  reset: (page: string, section: string) => api.delete<SectionState>(`/admin/content/${page}/${section}`).then((r) => r.data),
};

export interface Message {
  id: string; name: string; phone: string; email: string; topic: string; message: string; is_read: boolean; created_at: string;
}
export interface Subscriber { id: string; email: string; created_at: string }

export const inboxApi = {
  messages: (q: { unread?: boolean; page?: number }) => {
    const p = new URLSearchParams();
    if (q.unread) p.set('unread', 'true');
    if (q.page) p.set('page', String(q.page));
    return api.get<Page<Message> & { unread: number }>(`/admin/inbox/messages?${p}`).then((r) => r.data);
  },
  markRead: (id: string, is_read: boolean) => api.patch(`/admin/inbox/messages/${id}`, { is_read }).then((r) => r.data),
  subscribers: (page: number, limit = 100) => api.get<Page<Subscriber>>(`/admin/inbox/subscribers?page=${page}&limit=${limit}`).then((r) => r.data),
};
