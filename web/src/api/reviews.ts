import { api } from './client';

interface ReviewSummary { count: number; average: number; distribution: Record<'1' | '2' | '3' | '4' | '5', number> }
export interface PublicReview { id: string; rating: number; title: string; body: string; created_at: string; author: string; verified: boolean }
export interface ReviewsPage { summary: ReviewSummary; page: number; limit: number; items: PublicReview[] }
export interface MyReview { id: string; rating: number; title: string; body: string; status: 'published' | 'hidden' }
export interface ReviewInput { rating: number; title: string; body: string }

export const reviewsApi = {
  list: (slug: string, page = 1) => api.get<ReviewsPage>(`/products/${encodeURIComponent(slug)}/reviews?page=${page}`).then((r) => r.data),
  mine: (productId: string) => api.get<{ can_review: boolean; review: MyReview | null }>(`/customer/reviews/${productId}`).then((r) => r.data),
  save: (productId: string, b: ReviewInput) => api.put<MyReview>(`/customer/reviews/${productId}`, b).then((r) => r.data),
  remove: (productId: string) => api.delete<{ ok: true }>(`/customer/reviews/${productId}`).then((r) => r.data),
};
