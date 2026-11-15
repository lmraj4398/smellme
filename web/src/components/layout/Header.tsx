import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useContent } from '@/api/content';
import { NAV_ITEMS } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { selectCount, useBag } from '@/store/cart.store';
import { useCustomerStore } from '@/store/customer.store';

const iconBtn = 'flex h-11 w-11 items-center justify-center text-ink hover:text-antique';

export function Header() {
  const [open, setOpen] = useState(false);
  const bagCount = useBag(selectCount);
  const signedIn = useCustomerStore((s) => s.status === 'authed');
  const account = signedIn ? '/account' : '/login';
  const { data } = useContent('site');
  const announcement = data?.site.announcement;

  return (
    <div className="sticky top-0 z-30 bg-ivory md:static">
      {announcement && (
        <div className="hidden bg-ink px-4 py-2.5 text-center text-xs uppercase tracking-[0.16em] text-pearl md:block">{announcement}</div>
      )}
      <header className="mx-auto flex max-w-[1360px] items-center justify-between gap-4 px-4 py-3 md:flex-wrap md:px-10 md:py-[18px]">
        <button
          className={cn(iconBtn, 'md:hidden')}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={22} strokeWidth={1.4} /> : <Menu size={22} strokeWidth={1.4} />}
        </button>

        <Link to="/" aria-label="SmellMe home" className="font-serif text-[30px] font-medium leading-none md:text-4xl">
          Smell<em className="italic text-antique">Me</em>
        </Link>

        <nav aria-label="Main" className="hidden flex-1 justify-center gap-7 md:flex">
          {NAV_ITEMS.map((n) => (
            <NavLink
              key={n.path}
              to={n.path}
              end
              className={({ isActive }) =>
                cn('flex min-h-11 items-center border-b text-[13px] uppercase tracking-[0.16em]', isActive ? 'border-antique' : 'border-transparent hover:border-line')
              }
            >
              {n.nav}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-0.5">
          <Link to="/shop" aria-label="Search" className={iconBtn}><Search size={20} strokeWidth={1.4} /></Link>
          <Link to={account} aria-label={signedIn ? 'My account' : 'Sign in'} className={cn(iconBtn, 'hidden md:flex')}><User size={20} strokeWidth={1.4} /></Link>
          <Link to={signedIn ? '/account?tab=wishlist' : `/login?next=${encodeURIComponent('/account?tab=wishlist')}`} aria-label="Wishlist" className={iconBtn}><Heart size={20} strokeWidth={1.4} /></Link>
          <Link to="/bag" aria-label={`Bag, ${bagCount} ${bagCount === 1 ? 'item' : 'items'}`} className="flex h-11 items-center gap-1.5 px-2">
            <ShoppingBag size={20} strokeWidth={1.4} />
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-antique px-1 text-[11px] text-white">{bagCount}</span>
          </Link>
        </div>
      </header>

      {open && (
        <nav aria-label="Mobile menu" className="fixed inset-x-0 bottom-0 top-[61px] z-20 overflow-y-auto bg-ivory px-6 pb-10 pt-4 md:hidden">
          <div className="border-t border-line">
            {[...NAV_ITEMS, { path: '/help', nav: 'Help & FAQ', title: '' }].map((n) => (
              <Link
                key={n.path}
                to={n.path}
                onClick={() => setOpen(false)}
                className="flex min-h-[60px] items-center justify-between border-b border-line font-serif text-3xl"
              >
                {n.nav}
                <span aria-hidden className="font-sans text-base text-antique">→</span>
              </Link>
            ))}
          </div>
          <Link to={account} onClick={() => setOpen(false)} className="mt-6 flex min-h-11 items-center text-[15px]">{signedIn ? 'My account' : 'Sign in'}</Link>
        </nav>
      )}
      <div className="h-px bg-line" />
    </div>
  );
}
