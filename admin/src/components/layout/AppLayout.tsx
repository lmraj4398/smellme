import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@/api/orders.api';
import { authApi } from '@/api/auth.api';
import { canOpen, NAV } from '@/lib/nav-routes';
import { cn } from '@/lib/utils';
import { canOpenScreen, useAuthStore } from '@/store/auth.store';

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => canOpen(user, n));
  // The number of payments waiting to be checked, as a badge on the menu item. Only for logins that can see orders.
  const summary = useQuery({ queryKey: ['orders-summary'], queryFn: ordersApi.summary, enabled: canOpenScreen(user, 'orders'), refetchInterval: 60_000, retry: false });
  const badge = (path: string) => (path === '/payments' && summary.data?.awaiting_verification ? summary.data.awaiting_verification : 0);

  const signOut = async () => {
    await authApi.logout().catch(() => undefined);
    navigate('/login', { replace: true });
  };

  const nav = (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {items.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 items-center gap-3 rounded-full px-4 text-[15px] transition',
              isActive ? 'bg-champagne font-medium' : 'text-ink/80 hover:bg-pearl',
            )
          }
        >
          <Icon size={18} strokeWidth={1.5} aria-hidden />
          <span className="flex-1">{label}</span>
          {badge(path) > 0 && <span aria-label={`${badge(path)} waiting`} className="flex h-6 min-w-6 items-center justify-center rounded-full bg-antique px-1.5 text-xs text-white">{badge(path)}</span>}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-ivory md:flex">
        <div className="border-b border-line px-6 py-5 font-serif text-3xl font-medium leading-none">
          Smell<em className="text-antique">Me</em>
          <div className="eyebrow mt-2 !text-[10px]">Admin</div>
        </div>
        {nav}
        <div className="border-t border-line p-4 text-sm">
          <div className="truncate font-medium">{user?.name}</div>
          <div className="truncate text-taupe">{user?.email}</div>
          <button onClick={signOut} className="mt-3 flex min-h-11 items-center gap-2 text-taupe hover:text-ink">
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ivory px-4 py-2 md:hidden">
        <span className="font-serif text-2xl font-medium">Smell<em className="text-antique">Me</em></span>
        <button
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
          className="flex h-11 w-11 items-center justify-center"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-[57px] z-20 flex flex-col bg-ivory md:hidden">
          {nav}
          <button onClick={signOut} className="m-3 flex min-h-11 items-center gap-2 px-4 text-taupe">
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </div>
      )}

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
