import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validationSchema } from './config/env.validation';
import { R2Module } from './common/r2/r2.module';
import { ApiErrorLogsModule } from './common/api-error-logs/api-error-logs.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { EncryptResponseInterceptor } from './common/interceptors/encrypt-response.interceptor';
import { DecryptBodyMiddleware } from './common/middleware/decrypt-body.middleware';
import { HealthController } from './health/health.controller';
import { AdminUsersModule } from './models/admin-users/admin-users.module';
import { CatalogModule } from './models/catalog/catalog.module';
import { ContentModule } from './models/content/content.module';
import { InboxModule } from './models/inbox/inbox.module';
import { CouponsModule } from './models/coupons/coupons.module';
import { CustomersModule } from './models/customers/customers.module';
import { OrdersModule } from './models/orders/orders.module';
import { ReviewsModule } from './models/reviews/reviews.module';
import { WishlistModule } from './models/wishlist/wishlist.module';
import { SettingsModule } from './models/settings/settings.module';
import { WhatsAppModule } from './models/whatsapp/whatsapp.module';
import { AuthModule } from './security/auth/auth.module';
import { AdminAuthGuard } from './security/guards/admin-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema, validationOptions: { abortEarly: false } }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        type: 'postgres' as const,
        host: c.getOrThrow<string>('DB_HOST'),
        port: c.getOrThrow<number>('DB_PORT'),
        username: c.getOrThrow<string>('DB_USERNAME'),
        password: c.getOrThrow<string>('DB_PASSWORD'),
        database: c.getOrThrow<string>('DB_NAME'),
        ssl: c.get<boolean>('DB_SSL') ? { rejectUnauthorized: true } : false,
        autoLoadEntities: true,
        synchronize: c.get<boolean>('DB_SYNC'),
        migrations: [__dirname + '/migrations/*.js'],
        migrationsRun: c.get<boolean>('DB_MIGRATIONS_RUN'),
      }),
    }),
    ScheduleModule.forRoot(),
    R2Module,
    ApiErrorLogsModule,
    AuthModule,
    AdminUsersModule,
    CatalogModule,
    ContentModule,
    InboxModule,
    SettingsModule,
    WhatsAppModule,
    CustomersModule,
    CouponsModule,
    OrdersModule,
    WishlistModule,
    ReviewsModule,
    // Feature modules are added per phase: auth, catalog, orders, ...
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    // Deny by default: every route needs an admin token unless marked @Public().
    { provide: APP_GUARD, useClass: AdminAuthGuard },
    // Only active when API_ENCRYPTION_KEY is set (see main.ts for the warning).
    ...(process.env.API_ENCRYPTION_KEY?.length === 64
      ? [{ provide: APP_INTERCEPTOR, useClass: EncryptResponseInterceptor }]
      : []),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(DecryptBodyMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
