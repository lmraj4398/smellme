import type { NavItem } from '@/lib/nav-routes';

export default function ComingSoonPage({ item }: { item: NavItem }) {
  return (
    <div>
      <h1 className="font-serif text-4xl">{item.label}</h1>
      <p className="mt-3 max-w-prose text-taupe">
        This screen is scheduled for a later phase. Its menu entry and permission guard are already in place.
      </p>
    </div>
  );
}
