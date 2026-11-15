export interface CorsInput {
  websiteUrl: string;
  adminUrl: string;
  extraOrigins?: string;
}

const strip = (u: string) => u.trim().replace(/\/+$/, '');

// Exact-match allow list built from env. No wildcards: SmellMe has one
// storefront and one admin. Requests with no Origin (curl, server-to-server,
// webhooks) are allowed through; browsers always send one.
export function createCorsOrigin(input: CorsInput) {
  const allowed = new Set(
    [input.websiteUrl, input.adminUrl, ...(input.extraOrigins ?? '').split(',')]
      .map(strip)
      .filter(Boolean),
  );
  return (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => {
    if (!origin || allowed.has(strip(origin))) return cb(null, true);
    cb(null, false);
  };
}
