import { api, type SessionResponse } from './client';
import { useAuthStore } from '@/store/auth.store';

// Contract implemented by the API's auth module (phase 2):
//   POST /auth/login    {email, password} -> {token, user}  + sets httpOnly refresh cookie
//   POST /auth/refresh  (cookie)          -> {token, user}  rotates the cookie
//   POST /auth/logout   (cookie)          -> 204            revokes + clears the cookie
export const authApi = {
  login: async (email: string, password: string): Promise<SessionResponse> => {
    const { data } = await api.post<SessionResponse>('/auth/login', { email, password });
    useAuthStore.getState().setAuth(data.user, data.token);
    return data;
  },
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      useAuthStore.getState().clear();
    }
  },
};
