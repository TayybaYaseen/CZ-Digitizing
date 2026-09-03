import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AdminPermissionsGuard } from './common/guards/admin-permissions.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { TraceIdMiddleware } from './common/middleware/trace-id.middleware';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { validateEnv } from './config/env.validation';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { DesignsModule } from './designs/designs.module';
import { RedisModule } from './redis/redis.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(), // notification-batching.service.ts / notification-cleanup.service.ts
    PrismaModule,
    RedisModule,
    EmailModule,
    AuditModule,
    RateLimitModule,
    HealthModule,
    // Before AuthModule: auth's new-device-login trigger (AC-3) calls NotificationService.
    NotificationsModule,
    AuthModule,
    AdminModule,
    SettingsModule,
    DesignsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // Order matters: cheap rate-limit check first, then who-you-are, then what-role-you-have,
    // then fine-grained module permissions (AC-8) — each stage assumes the ones before it ran.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: AdminPermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TraceIdMiddleware).forRoutes('*');
  }
}
