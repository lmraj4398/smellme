import { SetMetadata } from '@nestjs/common';

// Route needs no login. (The global JWT guard arrives with the auth module.)
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
