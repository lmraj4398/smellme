import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { catalogApi, type ProductDetailData, type VariantData } from '@/api/catalog';
import { PincodeCheck } from '@/components/PincodeCheck';
import { ProductReviews, RatingLink } from '@/components/ProductReviews';
import { WishlistButton } from '@/components/WishlistButton';
import { Bottle } from '@/components/ui/Bottle';
import { Container, ErrorState, Eyebrow, H2, Loading } from '@/components/ui/States';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn, formatINR } from '@/lib/utils';
import { MAX_QTY, useBag } from '@/store/cart.store';
import { ProductGrid } from '@/components/ProductGrid';

const TIER_COPY = {
  top: { title: 'Top notes', when: 'The first 15 minutes' },
  heart: { title: 'Heart notes', when: 'The next 2–4 hours' },
  base: { title: 'Base notes', when: 'What lingers' },
} as const;
const METER_ENDS: Record<string, [string, string]> = {
  longevity: ['Brief', 'All day'], projection: ['Skin close', 'Fills a room'], season: ['Summer', 'Winter'], occasion: ['Day', 'Night'],
};
const METER_TITLE: Record<string, string> = { longevity: 'Longevity', projection: 'Projection', season: 'Best season', occasion: 'Wear it' };

export default function ProductPage() {
  const { slug = '' } = useParams();
  const q = useQuery({ queryKey: ['product', slug], queryFn: () => catalogApi.product(slug), staleTime: 60_000, retry: (n, e) => !(axios.isAxiosError(e) && e.response?.status === 404) && n < 1, retryDelay: 400 });
  usePageTitle(q.data?.name, q.data?.short_description || undefined);

  if (q.isLoading) return <Loading />;
  if (axios.isAxiosError(q.error) && q.error.response?.status === 404) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="font-serif text-5xl">Fragrance not found</h1>
        <p className="text-taupe">It may have been renamed or is no longer available.</p>
        <Link to="/shop" className="btn-primary">Browse all fragrances</Link>
      </div>
    );
  }
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;
  // key: switching products resets the size/quantity/image state.
  return <Product key={q.data.id} p={q.data} />;
}

function Product({ p }: { p: ProductDetailData }) {
  const defaultVariant = p.variants.find((v) => v.is_default) ?? p.variants[0];
  const [variantId, setVariantId] = useState(defaultVariant?.id);
  const [qty, setQty] = useState(1);
  const [image, setImage] = useState(0);
  const add = useBag((s) => s.add);
  const v: VariantData | undefined = p.variants.find((x) => x.id === variantId) ?? defaultVariant;

  useStructuredData(p, v);

  function addToBag() {
    if (!v || !v.in_stock) return;
    add({ variantId: v.id, productSlug: p.slug, name: p.name, brand: p.brand.name, label: v.label, price_paise: v.price_paise, tint: p.tint, liquid: p.liquid, mono: p.mono, image: p.media[0]?.url ?? null }, qty);
    toast.success(`${p.name} · ${v.label} added to your bag`, { id: 'bag-added' });
  }

  return (
    <>
      <Container className="flex flex-wrap items-start gap-14 pb-20 pt-7">
        {/* gallery */}
        <div className="flex min-w-0 flex-[1_1_520px] flex-wrap-reverse gap-4">
          {p.media.length > 1 && (
            <div role="group" aria-label="Product images" className="flex flex-row gap-3 md:flex-col">
              {p.media.map((m, i) => (
                <button key={m.url} type="button" aria-label={`Show image ${i + 1}`} aria-pressed={image === i} onClick={() => setImage(i)}
                  className={cn('h-[78px] w-16 overflow-hidden rounded-t-[40px] rounded-b-[3px] border md:h-[92px] md:w-[76px]', image === i ? 'border-ink' : 'border-line')}>
                  <img src={m.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
          <div className="relative flex aspect-[4/5] min-w-0 flex-[1_1_380px] items-end justify-center overflow-hidden rounded-t-[280px] rounded-b-md border border-[#E8DAC4] pb-[14%]" style={{ background: `radial-gradient(ellipse 70% 60% at 50% 40%, #FFFFFF 0%, ${p.tint} 70%)` }}>
            {p.badge && <span className="absolute left-1/2 top-7 z-10 -translate-x-1/2 rounded-full bg-ivory px-3.5 py-1.5 text-[11px] uppercase tracking-[0.2em]">{p.badge}</span>}
            {p.media[image] ? (
              <img src={p.media[image].url} alt={p.media[image].alt || p.name} className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
            ) : (
              <Bottle liquid={p.liquid} mono={p.mono} className="!w-[40%]" />
            )}
          </div>
        </div>

        {/* buy box */}
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-[22px]">
          <div className="flex flex-col gap-2.5">
            <Link to={`/shop?brand=${p.brand.slug}`} className="eyebrow">{p.brand.name}</Link>
            <h1 className="font-serif text-[clamp(44px,4.6vw,68px)] font-normal leading-none">{p.name}</h1>
            <RatingLink slug={p.slug} />
            <span className="text-base text-taupe">{[p.concentration_label, p.family.name, p.descriptors && p.descriptors !== p.family.name ? p.descriptors : '', cap(p.gender)].filter(Boolean).join(' · ')}</span>
          </div>
          {p.short_description && <p className="text-[17px] font-light leading-[1.7] text-[#4A4238]">{p.short_description}</p>}

          {v && (
            <div className="flex flex-wrap items-baseline gap-3.5">
              <span className="font-serif text-[40px]">{formatINR(v.price_paise)}</span>
              {v.mrp_paise && v.mrp_paise > v.price_paise && <s className="text-base text-taupe">{formatINR(v.mrp_paise)}</s>}
              <span className="text-[13px] text-taupe">MRP incl. of all taxes</span>
            </div>
          )}

          {p.variants.length > 0 && (
            <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
              <legend className="mb-3 text-[13px] font-medium uppercase tracking-[0.16em]">Size — <span className="normal-case tracking-normal text-antique">{v?.label}</span></legend>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(120px,100%),1fr))] gap-2.5">
                {p.variants.map((s) => (
                  <button key={s.id} type="button" aria-pressed={s.id === v?.id} onClick={() => setVariantId(s.id)}
                    className={cn('flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-md border', s.id === v?.id ? 'border-ink bg-ink text-ivory' : 'border-field bg-white', !s.in_stock && 'opacity-60')}>
                    <span className="text-[15px] font-medium">{s.label}</span>
                    <span className="text-[13px] opacity-80">{s.in_stock ? formatINR(s.price_paise) : 'Sold out'}</span>
                  </button>
                ))}
              </div>
              {v?.low_stock && <p className="text-sm text-antique">Only a few left in this size.</p>}
            </fieldset>
          )}

          <div className="flex flex-wrap gap-3">
            <div role="group" aria-label="Quantity" className="flex min-h-14 items-center rounded-full border border-field">
              <button type="button" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((n) => Math.max(1, n - 1))} className="h-[54px] w-12 text-xl disabled:opacity-30">−</button>
              <span aria-live="polite" className="min-w-6 text-center text-base">{qty}</span>
              <button type="button" aria-label="Increase quantity" disabled={qty >= MAX_QTY} onClick={() => setQty((n) => Math.min(MAX_QTY, n + 1))} className="h-[54px] w-12 text-xl disabled:opacity-30">+</button>
            </div>
            <button type="button" onClick={addToBag} disabled={!v?.in_stock} className="btn-primary min-h-14 flex-[1_1_220px] px-8">
              {!v ? 'Unavailable' : v.in_stock ? `Add to bag · ${formatINR(v.price_paise * qty)}` : 'Sold out'}
            </button>
            <WishlistButton productId={p.id} name={p.name} variant="page" />
          </div>

          <PincodeCheck />

          <div className="border-t border-line">
            {p.story && <Detail title="The story" open text={p.story} />}
            {p.how_to_wear && <Detail title="How to wear it" text={p.how_to_wear} />}
            {p.ingredients && <Detail title="Ingredients & safety" text={p.ingredients} />}
          </div>
        </div>
      </Container>

      {p.notes.length > 0 && (
        <section className="bg-pearl">
          <Container className="flex flex-col gap-12 py-24">
            <div className="flex flex-col items-center gap-3.5 text-center"><Eyebrow>Fragrance notes</Eyebrow><H2>How it unfolds on your skin</H2></div>
            <div className="grid gap-6 md:grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))]">
              {p.notes.map((t) => (
                <div key={t.tier} className="flex flex-col items-center gap-3.5 rounded-t-[160px] rounded-b bg-ivory px-8 pb-9 pt-14 text-center">
                  <span className="font-serif text-[22px] italic text-antique">{TIER_COPY[t.tier].title}</span>
                  <span className="text-[13px] text-taupe">{TIER_COPY[t.tier].when}</span>
                  <ul className="flex flex-wrap justify-center gap-[18px] pt-2.5">
                    {t.items.map((n) => (
                      <li key={n.name} className="flex w-[84px] flex-col items-center gap-2.5">
                        <span aria-hidden className="h-[68px] w-[68px] rounded-full border border-antique/25" style={{ background: n.color }} />
                        <span className="text-sm">{n.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Container>
        </section>
      )}

      {p.meters.length > 0 && (
        <Container className="grid gap-10 py-24 md:grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))]">
          {p.meters.map((m) => {
            const [lo, hi] = METER_ENDS[m.key] ?? ['', ''];
            return (
              <div key={m.key} className="flex flex-col gap-3">
                <span className="text-xs uppercase tracking-[0.2em] text-taupe">{METER_TITLE[m.key] ?? m.key}</span>
                <span className="font-serif text-[30px]">{m.label}</span>
                <div role="img" aria-label={`${METER_TITLE[m.key]}: ${m.label}`} className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5].map((i) => <span key={i} className={cn('h-1.5 rounded-[3px]', i <= m.level ? 'bg-antique' : 'bg-line')} />)}
                </div>
                <div className="flex justify-between text-xs text-taupe"><span>{lo}</span><span>{hi}</span></div>
              </div>
            );
          })}
        </Container>
      )}

      <ProductReviews slug={p.slug} productId={p.id} />

      {p.related.length > 0 && (
        <section>
          <Container className="pb-24 pt-6">
            <div className="mb-10 flex flex-col gap-3.5"><Eyebrow>If you like {p.name}</Eyebrow><H2>You may also love</H2></div>
            <ProductGrid products={p.related} />
          </Container>
        </section>
      )}
    </>
  );
}

function Detail({ title, text, open }: { title: string; text: string; open?: boolean }) {
  return (
    <details open={open} className="group border-b border-line">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between text-[15px] font-medium [&::-webkit-details-marker]:hidden">
        {title}<span aria-hidden className="text-antique group-open:hidden">+</span><span aria-hidden className="hidden text-antique group-open:inline">−</span>
      </summary>
      {/* Plain text only (never HTML), with the owner's line breaks kept. */}
      <p className="mb-[18px] whitespace-pre-line text-[15px] leading-[1.7] text-[#4A4238]">{text}</p>
    </details>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// schema.org Product data so search engines can show price and availability.
function useStructuredData(p: ProductDetailData, v?: VariantData) {
  useEffect(() => {
    if (!v) return;
    const data = {
      '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.short_description || undefined,
      brand: { '@type': 'Brand', name: p.brand.name }, image: p.media.map((m) => m.url), sku: v.sku,
      offers: { '@type': 'Offer', priceCurrency: 'INR', price: (v.price_paise / 100).toFixed(2), availability: v.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    // "<" is escaped so a product name can never close the script tag.
    el.text = JSON.stringify(data).replace(/</g, '\\u003c');
    document.head.appendChild(el);
    return () => el.remove();
  }, [p, v]);
}
