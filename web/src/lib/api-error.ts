import axios from 'axios';

// One place that turns any thrown value into a message safe to show a user.
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Connection problem - check your internet and try again.';
    const data = err.response.data as { message?: string; retry_after?: number } | undefined;
    if (err.response.status === 429) {
      return data?.retry_after
        ? `Too many attempts. Try again in ${data.retry_after}s.`
        : (data?.message ?? 'Too many attempts. Try again later.');
    }
    return data?.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
