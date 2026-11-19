import { Global, Module } from '@nestjs/common';
import { R2Service } from './r2.service';

// Global: any module can inject R2Service without importing anything.
@Global()
@Module({ providers: [R2Service], exports: [R2Service] })
export class R2Module {}
