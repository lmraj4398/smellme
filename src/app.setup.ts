import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createCorsOrigin } from './config/cors.config';
import { TrimStringsPipe } from './common/pipes/trim-strings.pipe';
import { applyRateLimits } from './common/security/rate-limits';
import { isProductionEnv } from './common/utils/env.util';

// Everything between "create app" and "listen". Shared by main.ts and the e2e
// harness so tests exercise the real middleware, limiters, pipes and prefix.
export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  const isProd = isProductionEnv(process.env.NODE_ENV);

  // Behind Caddy: needed for correct per-IP rate limiting via X-Forwarded-For.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(cookieParser());
  app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));
  app.use(compression());

  app.enableCors({
    origin: isProd
      ? createCorsOrigin({
          websiteUrl: config.getOrThrow('WEBSITE_URL'),
          adminUrl: config.getOrThrow('ADMIN_URL'),
          extraOrigins: config.get('CORS_EXTRA_ORIGINS'),
        })
      : true,
    credentials: true,
  });

  // Limiters must be registered before routes.
  applyRateLimits(app, { isProd, globalMax: config.get<number>('RATE_LIMIT_MAX', 100) });

  app.setGlobalPrefix('api');
  // Trim first so validators (@MinLength, @IsEmail) see the trimmed value.
  app.useGlobalPipes(
    new TrimStringsPipe(),
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
