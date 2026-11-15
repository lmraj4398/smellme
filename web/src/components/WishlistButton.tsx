import { Heart } from 'lucide-react';
import { useWishlist } from '@/hooks/useWishlist';
import { cn } from '@/lib/utils';

/** The heart on a product card (`card`) or beside "Add to bag" on the product page (`page`). */
export function WishlistButton({ productId, name, variant = 'card' }: { productId: string; name: string; variant?: 'card' | 'page' }) {
  const { has, toggle } = useWishlist();
  const on = has(productId);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
      onClick={() => toggle(productId)}
      className={cn(
        'flex items-center justify-center text-ink',
        variant === 'card' ? 'absolute bottom-3 right-3 z-10 h-11 w-11 rounded-full bg-ivory' : 'h-14 w-14 rounded-full border border-field bg-white',
      )}
    >
      <Heart size={variant === 'card' ? 18 : 20} strokeWidth={1.4} className={cn(on && 'fill-antique text-antique')} />
    </button>
  );
}
