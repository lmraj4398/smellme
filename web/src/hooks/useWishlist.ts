import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { wishlistApi } from '@/api/wishlist';
import { apiErrorMessage } from '@/lib/api-error';
import { useCustomerStore } from '@/store/customer.store';

const IDS = ['wishlist', 'ids'] as const;

/**
 * The signed-in shopper's hearted products. Every heart on the site shares one cached list of ids, and a click
 * updates it at once (rolled back if the server refuses). Signed-out shoppers are sent to sign in and brought back.
 */
export function useWishlist() {
  const authed = useCustomerStore((s) => s.status === 'authed');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const q = useQuery({ queryKey: IDS, queryFn: wishlistApi.ids, enabled: authed, staleTime: 60_000 });
  const ids = useMemo(() => new Set(q.data ?? []), [q.data]);

  const set = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => (on ? wishlistApi.add(id) : wishlistApi.remove(id)),
    onMutate: async ({ id, on }) => {
      await qc.cancelQueries({ queryKey: IDS });
      const prev = qc.getQueryData<string[]>(IDS);
      qc.setQueryData<string[]>(IDS, (old = []) => (on ? [id, ...old.filter((x) => x !== id)] : old.filter((x) => x !== id)));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(IDS, ctx?.prev);
      toast.error(apiErrorMessage(e));
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['wishlist'] }),
  });

  return {
    has: (id: string) => ids.has(id),
    toggle: (id: string) => {
      if (!authed) return navigate(`/login?next=${encodeURIComponent(pathname + search)}`);
      set.mutate({ id, on: !ids.has(id) });
    },
  };
}
