import { Logger, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { serveClients } from './config/clients.config';
import { setupSwagger } from './config/swagger.config';
import { isProductionEnv } from './common/utils/env.util';

async function bootstrap() {
  const isProd = isProductionEnv(process.env.NODE_ENV);
  const logLevels: LogLevel[] = isProd ? ['log', 'warn', 'error'] : ['debug', 'log', 'warn', 'error'];
  const app = await NestFactory.create(AppModule, { logger: logLevels });

  configureApp(app);

  if (process.env.API_ENCRYPTION_KEY?.length !== 64) {
    Logger.warn('Response encryption DISABLED - API_ENCRYPTION_KEY not set', 'Bootstrap');
  }
  if (!isProd) setupSwagger(app);
  serveClients(app);

  const port = app.get(ConfigService).get<number>('PORT', 3001);
  await app.listen(port);
  Logger.log(`SmellMe on :${port} (site /, admin /admin, api /api)${isProd ? '' : `  (Swagger: http://localhost:${port}/api/docs)`}`, 'Bootstrap');
}
bootstrap();
