/**
 * Indian mobile numbers only. Accepts "98765 43210", "09876543210", "+91 98765-43210", "919876543210".
 * Returns the canonical "+91XXXXXXXXXX", or null when it is not a valid mobile (must start 6-9).
 */
export function normalizeIndianMobile(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 20) return null;
  let d = raw.replace(/[\s()-]/g, '');
  if (!/^\+?\d+$/.test(d)) return null;
  d = d.replace(/^\+/, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

/** WhatsApp/Gupshup want digits only with the country code: "919876543210". */
export const toWhatsAppNumber = (canonical: string) => canonical.replace(/\D/g, '');

/** "+919876543210" -> "+91 98765 43210" for display. */
export const formatPhone = (canonical: string) => canonical.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2');

/** Masks all but the last 4 digits, for logs. */
export const maskPhone = (canonical: string) => canonical.replace(/\d(?=\d{4})/g, '•');
