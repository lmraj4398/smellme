import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUser } from '../../models/admin-users/admin-user.entity';
import { RefreshToken } from '../token/refresh-token.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenCleanupService } from './token-cleanup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser, RefreshToken]),
    JwtModule.registerAsync({
      global: true, // the global AdminAuthGuard needs JwtService everywhere
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret: c.getOrThrow<string>('JWT_SECRET'),
        signOptions: { algorithm: 'HS256', expiresIn: c.get<number>('TOKEN_EXPIRATION_TIME', 900) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenCleanupService],
  exports: [AuthService],
})
export class AuthModule {}
