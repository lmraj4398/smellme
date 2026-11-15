import { SetMetadata } from '@nestjs/common';

// Only an unrestricted login (allowed_screens = null, i.e. the owner) may call
// this route, whatever screens a restricted login has been given.
export const OWNER_ONLY_KEY = 'ownerOnly';
export const OwnerOnly = () => SetMetadata(OWNER_ONLY_KEY, true);
