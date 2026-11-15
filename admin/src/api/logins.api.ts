import { api } from './client';

export interface LoginRow {
  id: string; name: string; email: string; screens: string[] | null; is_active: boolean; last_login_at: string | null; created_at: string;
}

export const loginsApi = {
  list: () => api.get<{ screens: string[]; items: LoginRow[] }>('/admin/logins').then((r) => r.data),
  create: (b: { name: string; email: string; password: string; screens: string[] | null }) => api.post<LoginRow>('/admin/logins', b).then((r) => r.data),
  update: (id: string, b: { name?: string; screens?: string[] | null; is_active?: boolean }) =>
    api.patch<LoginRow>(`/admin/logins/${id}`, b).then((r) => r.data),
  resetPassword: (id: string, new_password: string) => api.post(`/admin/logins/${id}/reset-password`, { new_password }).then((r) => r.data),
};
