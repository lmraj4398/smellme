import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { ProductCardData } from '@/api/catalog';
import { selectCount, useBag } from '@/store/cart.store';
import { formatINR } from '@/lib/utils';
import { Bottle } from './ui/Bottle';
import { WishlistButton } from './WishlistButton';

export function ProductCard({ p }: { p: ProductCardData }) {
  const add = useBag((s) => s.add);
  const inBag = useBag((s) => s.lines.some((l) => l.variantId === p.default_variant?.id));
  const out = !p.default_variant || !p.default_variant.in_stock;

  function addToBag() {
    if (!p.default_variant || out) return;
    add({
      variantId: p.default_variant.id, productSlug: p.slug, name: p.name, brand: p.brand.name, label: p.default_variant.label,
      price_paise: p.price_paise, tint: p.tint, liquid: p.liquid, mono: p.mono, image: p.image,
    });
    toast.success(`${p.name} added to your bag`, { id: 'bag-added', description: `${selectCount(useBag.getState())} in bag` });
  }

  return (
    <article className="flex w-full flex-col gap-4 bg-ivory">
      <div className="relative">
      <Link
        to={`/product/${p.slug}`}
        aria-label={`View ${p.name}`}
        className="relative flex aspect-[4/5] items-end justify-center overflow-hidden rounded-t-[180px] rounded-b-[4px] pb-[14%]"
        style={{ background: p.tint }}
      >
        {p.badge && (
          <span className="absolute left-1/2 top-[18px] z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-ivory px-3 py-1.5 text-[11px] uppercase tracking-[0.18em]">{p.badge}</span>
        )}
        {p.image ? (
          <img src={p.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Bottle liquid={p.liquid} mono={p.mono} />
        )}
      </Link>
      <WishlistButton productId={p.id} name={p.name} />
      </div>

      <div className="flex flex-col gap-1.5 px-1">
        <span className="eyebrow !text-[11px] !tracking-[0.2em]">{p.brand.name}</span>
        <Link to={`/product/${p.slug}`} className="font-serif text-[21px] leading-[1.1] hover:text-antique md:text-[26px]">{p.name}</Link>
        {p.descriptors && <span className="text-sm text-taupe">{p.descriptors}</span>}
        <span className="text-[13px] text-taupe">{p.size_label}</span>
      </div>

      <div className="flex flex-col gap-2.5 px-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className="text-[17px] font-medium">{formatINR(p.price_paise)}</span>
        {out ? (
          <span className="inline-flex min-h-10 items-center justify-center rounded-full border border-line px-5 text-[11px] uppercase tracking-[0.16em] text-taupe sm:min-h-11 sm:text-xs">Sold out</span>
        ) : (
          <button
            type="button"
            onClick={addToBag}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-ink px-5 text-[11px] uppercase tracking-[0.16em] hover:bg-pearl sm:min-h-11 sm:text-xs"
          >
            {inBag ? 'Add another' : 'Add to bag'}
          </button>
        )}
      </div>
    </article>
  );
}
