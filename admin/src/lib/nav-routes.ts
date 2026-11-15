import type { AuthUser } from '@/store/auth.store';
import { canOpenScreen } from '@/store/auth.store';
import {
  BadgeCheck, Boxes, FileWarning, HelpCircle, LayoutDashboard, LayoutTemplate,
  Mail, MessageSquareQuote, Package, Settings, ShieldCheck, ShoppingBag, Sparkles, Star, Tag, Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Screen key, as listed in a login's allowed screens and in the API's @Screen(). Omitted = always open. */
  screen?: string;
  /** Only an unrestricted login (the owner) sees this, whatever screens a restricted login has. */
  ownerOnly?: boolean;
}

// Single source of truth for the sidebar AND the route table, so a page can't
// be reachable without being listed (or listed without a guard).
// Screen keys must match the API's @Screen('...') decorators.
export const NAV: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/payments', label: 'Verify payments', icon: BadgeCheck, screen: 'orders' },
  { path: '/orders', label: 'Orders', icon: ShoppingBag, screen: 'orders' },
  { path: '/products', label: 'Products', icon: Package, screen: 'products' },
  { path: '/brands', label: 'Brands & families', icon: Tag, screen: 'products' },
  { path: '/inventory', label: 'Inventory', icon: Boxes, screen: 'inventory' },
  { path: '/customers', label: 'Customers', icon: Users, screen: 'customers' },
  { path: '/coupons', label: 'Coupons', icon: Sparkles, screen: 'coupons' },
  { path: '/reviews', label: 'Reviews', icon: Star, screen: 'reviews' },
  { path: '/content', label: 'Website content', icon: LayoutTemplate, screen: 'content' },
  { path: '/faqs', label: 'FAQs', icon: HelpCircle, screen: 'content' },
  { path: '/messages', label: 'Messages', icon: Mail, screen: 'marketing' },
  { path: '/notifications', label: 'WhatsApp log', icon: MessageSquareQuote, screen: 'logs' },
  { path: '/error-logs', label: 'Error logs', icon: FileWarning, screen: 'logs' },
  { path: '/settings', label: 'Settings', icon: Settings, screen: 'settings' },
  { path: '/logins', label: 'Logins & access', icon: ShieldCheck, ownerOnly: true },
];

/** Hides UI only. The API enforces the same rule on every request. */
export const canOpen = (user: AuthUser | null, item: NavItem) =>
  item.ownerOnly ? user !== null && user.screens === null : canOpenScreen(user, item.screen);
