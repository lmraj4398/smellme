import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { reviewsApi, type MyReview } from '@/api/reviews';
import { Container } from '@/components/ui/States';
import { apiErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import { useCustomerStore } from '@/store/customer.store';
import { Stars } from '@/components/ui/Stars';

/** "★★★★★ 4.5 · 12 reviews" under the product name, jumping to the reviews. Renders nothing until there is a review. */
export function RatingLink({ slug }: { slug: string }) {
  const q = useQuery({ queryKey: ['reviews', slug, 'summary'], queryFn: () => reviewsApi.list(slug, 1), staleTime: 60_000 });
  const s = q.data?.summary;
  if (!s || s.count === 0) return null;
  return (
    <a href="#reviews" className="flex items-center gap-2.5 text-sm text-ink no-underline">
      <Stars rating={s.average} /><span>{s.average.toFixed(1)} · {s.count} {s.count === 1 ? 'review' : 'reviews'}</span>
    </a>
  );
}

/** Reviews for one product: the rating summary, everyone's reviews, and (for a customer who received it) a form to write or edit theirs. */
export function ProductReviews({ slug, productId }: { slug: string; productId: string }) {
  const authed = useCustomerStore((s) => s.status === 'authed');
  const list = useInfiniteQuery({
    queryKey: ['reviews', slug],
    queryFn: ({ pageParam }) => reviewsApi.list(slug, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.summary.count ? last.page + 1 : undefined),
    staleTime: 60_000,
  });
  const mine = useQuery({ queryKey: ['my-review', productId], queryFn: () => reviewsApi.mine(productId), enabled: authed });
  const [writing, setWriting] = useState(false);

  // A failed load just hides the section: reviews are never worth blocking the page for.
  const first = list.data?.pages[0];
  if (!first) return null;
  const { summary } = first;
  const items = (list.data?.pages ?? []).flatMap((p) => p.items);
  const myReview = mine.data?.review ?? null;
  const canWrite = authed && !!mine.data?.can_review;
  if (summary.count === 0 && !canWrite) return null;

  return (
    <section id="reviews" aria-label="Reviews" className="border-t border-line">
      <Container className="flex flex-wrap gap-14 py-16 md:py-24">
        <div className="flex flex-[1_1_280px] flex-col gap-4">
          <h2 className="font-serif text-[44px] font-normal leading-[1.05]">Reviews</h2>
          {summary.count > 0 && (
            <>
              <span className="font-serif text-[56px] leading-none">{summary.average.toFixed(1)}</span>
              <Stars rating={summary.average} className="text-xl" />
              <span className="text-sm text-taupe">Based on {summary.count} verified {summary.count === 1 ? 'buyer' : 'buyers'}</span>
              <ul className="flex flex-col gap-2 pt-2" aria-label="Rating breakdown">
                {(['5', '4', '3', '2', '1'] as const).map((s) => (
                  <li key={s} className="flex items-center gap-2.5 text-[13px]">
                    <span className="w-6">{s}★</span>
                    <span className="h-1 flex-1 rounded-sm bg-line"><span className="block h-1 rounded-sm bg-antique" style={{ width: `${(summary.distribution[s] / summary.count) * 100}%` }} /></span>
                    <span className="w-6 text-right text-taupe">{summary.distribution[s]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {canWrite && !writing && (
            <button type="button" className="btn-secondary mt-3 min-h-[52px]" onClick={() => setWriting(true)}>{myReview ? 'Edit your review' : 'Write a review'}</button>
          )}
        </div>

        <div className="flex min-w-0 flex-[999_1_520px] flex-col">
          {writing && <ReviewForm productId={productId} slug={slug} existing={myReview} onDone={() => setWriting(false)} />}
          {myReview?.status === 'hidden' && !writing && <p className="mb-4 rounded bg-pearl p-4 text-sm text-taupe">Your review is currently hidden from the shop.</p>}
          <ul>
            {items.map((r) => (
              <li key={r.id}>
                <article className="flex flex-col gap-2.5 border-t border-line py-7">
                  <div className="flex flex-wrap justify-between gap-2">
                    <Stars rating={r.rating} />
                    <span className="text-[13px] text-taupe">{new Date(r.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · Verified buyer</span>
                  </div>
                  {r.title && <h3 className="font-serif text-2xl font-normal">{r.title}</h3>}
                  {/* Plain text only: a review is untrusted input from the public. */}
                  {r.body && <p className="whitespace-pre-line break-words text-[15px] leading-[1.7] text-[#4A4238]">{r.body}</p>}
                  <span className="text-[13px] text-taupe">{r.author}</span>
                </article>
              </li>
            ))}
          </ul>
          {list.hasNextPage && (
            <button type="button" className="btn-secondary mt-4 self-center" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
              {list.isFetchingNextPage ? 'Loading…' : 'Show more reviews'}
            </button>
          )}
        </div>
      </Container>
    </section>
  );
}

function ReviewForm({ productId, slug, existing, onDone }: { productId: string; slug: string; existing: MyReview | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [error, setError] = useState('');
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['reviews', slug] }); void qc.invalidateQueries({ queryKey: ['my-review', productId] }); };

  const save = useMutation({
    mutationFn: () => reviewsApi.save(productId, { rating, title: title.trim(), body: body.trim() }),
    onSuccess: () => { refresh(); toast.success(existing ? 'Review updated' : 'Thank you for your review'); onDone(); },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => reviewsApi.remove(productId),
    onSuccess: () => { refresh(); toast.success('Review deleted'); onDone(); },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <form
      noValidate
      onSubmit={(e) => { e.preventDefault(); if (!rating) return setError('Choose a rating from 1 to 5 stars.'); setError(''); save.mutate(); }}
      className="mb-6 flex flex-col gap-4 rounded border border-line bg-white p-5"
    >
      <h3 className="font-serif text-2xl font-normal">{existing ? 'Edit your review' : 'Write a review'}</h3>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 text-sm font-medium">Your rating</legend>
        <div role="radiogroup" aria-label="Your rating" className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`} onClick={() => setRating(n)}
              className={cn('h-11 w-11 text-3xl leading-none', n <= rating ? 'text-antique' : 'text-line')}>★</button>
          ))}
        </div>
      </fieldset>
      <div><label htmlFor="rv-title" className="label">Headline <span className="font-normal text-taupe">optional</span></label><input id="rv-title" className="field" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div><label htmlFor="rv-body" className="label">Your review <span className="font-normal text-taupe">optional</span></label><textarea id="rv-body" className="field min-h-28 py-3" maxLength={1500} value={body} onChange={(e) => setBody(e.target.value)} placeholder="How it smells, how long it lasts, what you were wearing it for…" /></div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : existing ? 'Save changes' : 'Post review'}</button>
        <button type="button" className="btn-secondary" onClick={onDone}>Cancel</button>
        {existing && <button type="button" className="ml-auto min-h-11 text-sm text-taupe underline" disabled={remove.isPending} onClick={() => confirm('Delete your review?') && remove.mutate()}>Delete review</button>}
      </div>
    </form>
  );
}
