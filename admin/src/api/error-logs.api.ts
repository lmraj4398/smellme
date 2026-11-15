import { api } from './client';
import type { Page } from './catalog.api';

export type Severity = 'error' | 'warning';
export interface ErrorGroup { group_key: string; group_label: string; count: number; last_at: string; has_error: boolean; status_code: number }
export interface ErrorEntry {
  id: string; severity: Severity; status_code: number; method: string; url: string; message: string; created_at: string;
  request_query: string | null; request_body: string | null; user_id: string | null; user_type: 'admin' | 'customer' | null; screen: string | null;
}

export const errorLogsApi = {
  groups: (q: { severity?: Severity; page?: number }) => {
    const p = new URLSearchParams();
    if (q.severity) p.set('severity', q.severity);
    if (q.page) p.set('page', String(q.page));
    return api.get<Page<ErrorGroup>>(`/admin/error-logs?${p}`).then((r) => r.data);
  },
  entries: (group: string, page = 1) => api.get<Page<ErrorEntry>>(`/admin/error-logs/entries?group=${encodeURIComponent(group)}&page=${page}`).then((r) => r.data),
  clear: (group: string) => api.delete<{ deleted: number }>(`/admin/error-logs?group=${encodeURIComponent(group)}`).then((r) => r.data),
};
