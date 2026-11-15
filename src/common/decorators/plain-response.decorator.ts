import { SetMetadata } from '@nestjs/common';

// Opt a route out of response encryption. Use only for public, non-sensitive
// data (catalog, CMS content) so a CDN can cache it. Customer, order and
// payment data stays encrypted.
export const PLAIN_RESPONSE_KEY = 'plainResponse';
export const PlainResponse = () => SetMetadata(PLAIN_RESPONSE_KEY, true);
