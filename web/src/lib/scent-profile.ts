export interface ScentFamilyShare { name: string; slug: string; qty: number; /** 0–1, relative to the family bought most. */ share: number }

/** How to describe a family in the profile, from how much it is bought relative to the top one. */
export function levelFor(share: number): 'Loves' | 'Likes' | 'Sometimes' | 'Rarely' {
  if (share >= 0.75) return 'Loves';
  if (share >= 0.5) return 'Likes';
  if (share >= 0.25) return 'Sometimes';
  return 'Rarely';
}

/** "Amber" -> "Amber", ["Amber", "Woody"] -> "Amber & woody", for the headline of the profile. */
export function profileHeadline(families: ScentFamilyShare[]): string {
  const top = families.filter((f) => f.share >= 0.5).slice(0, 2).map((f) => f.name);
  if (top.length === 0) return '';
  return top.length === 1 ? top[0] : `${top[0]} & ${top[1].toLowerCase()}`;
}

/** A birthday is stored as YYYY-MM-DD; show it without the year as "21 Aug". */
export function birthdayLabel(ymd: string | null | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
