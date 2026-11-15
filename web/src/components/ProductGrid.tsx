import type { ReactNode } from 'react';
import type { ProductCardData } from '@/api/catalog';
import { cn } from '@/lib/utils';
import { ProductCard } from './ProductCard';

// Tailwind only generates classes it can read in full, so each layout is a literal string rather than a computed one.
const LAYOUTS = {
  /** The shop: as many 250 px columns as fit, a little tighter vertically. */
  catalog: 'grid grid-cols-2 gap-x-3 gap-y-7 md:grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] md:gap-x-6 md:gap-y-11',
  /** A row of featured products (home, "you may also love"): 260 px columns that stretch to fill. */
  rail: 'grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))] md:gap-x-6',
  /** Inside the account area, where the column is narrower. */
  compact: 'grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] md:gap-x-6',
  /** Exactly three picks, e.g. the scent-finder matches. */
  trio: 'grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 md:grid-cols-3',
} as const;
export type ProductGridLayout = keyof typeof LAYOUTS;

/** A responsive grid of product cards. `children` render after the cards (loading skeletons, an empty note). */
export function ProductGrid({ products, layout = 'rail', className, children, ...rest }: {
  products: readonly ProductCardData[];
  layout?: ProductGridLayout;
  className?: string;
  children?: ReactNode;
  role?: string;
}) {
  return (
    <div className={cn(LAYOUTS[layout], className)} {...rest}>
      {products.map((p) => <ProductCard key={p.id} p={p} />)}
      {children}
    </div>
  );
}
