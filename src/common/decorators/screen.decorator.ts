import { SetMetadata } from '@nestjs/common';

// Marks a controller/route as belonging to an admin screen (e.g. 'orders').
// A login whose allowed_screens is non-null is refused unless it lists the key.
// Routes without @Screen are open to any signed-in admin.
export const SCREEN_KEY = 'adminScreen';
export const Screen = (screen: string) => SetMetadata(SCREEN_KEY, screen);

// Keep in sync with admin/src/lib/nav-routes.ts.
export const SCREENS = [
  'orders', 'products', 'inventory', 'customers', 'coupons', 'reviews',
  'content', 'marketing', 'logs', 'settings',
] as const;
