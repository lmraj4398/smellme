import type { ProductCardData } from './catalog';
import { api } from './client';

export const wishlistApi = {
  ids: () => api.get<{ ids: string[] }>('/customer/wishlist/ids').then((r) => r.data.ids),
  list: () => api.get<ProductCardData[]>('/customer/wishlist').then((r) => r.data),
  add: (productId: string) => api.put<{ ok: true }>(`/customer/wishlist/${productId}`).then((r) => r.data),
  remove: (productId: string) => api.delete<{ ok: true }>(`/customer/wishlist/${productId}`).then((r) => r.data),
};
