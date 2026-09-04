import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
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
import { BundlesModule } from './bundles/bundles.module';
import { CartModule } from './cart/cart.module';
import { CartSessionMiddleware } from './cart/cart-session.middleware';
import { CreditsModule } from './credits/credits.module';
import { FilesModule } from './files/files.module';
import { OrdersModule } from './orders/orders.module';
import { RedisModule } from './redis/redis.module';
import { SettingsModule } from './settings/settings.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { FaqModule } from './faq/faq.module';
import { TipsModule } from './tips/tips.module';
import { TestimonialsModule } from './testimonials/testimonials.module';
import { BlogModule } from './blog/blog.module';
import { AboutModule } from './about/about.module';
import { PortfolioModule } from './portfolio/portfolio.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(), // notification-batching.service.ts / notification-cleanup.service.ts / cart-cleanup.service.ts
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
    BundlesModule,
    // Before OrdersModule: OrdersModule imports CreditsModule (checkout credit deduction/refund
    // reversal — see PaymentsModule's own doc comment for why the dependency runs this direction).
    CreditsModule,
    SubscriptionsModule,
    // Before CartModule: CartService.checkout() calls OrdersService.createFromCart() directly
    // (CartModule itself also imports OrdersModule — listed here too for the same top-level
    // feature-module visibility every other module gets in this list).
    OrdersModule,
    CartModule,
    FilesModule,
    // Content & Knowledge Base (A-012, sub-aspects A-012a-f). FaqModule/BlogModule export their
    // service so other modules (Taebo A-020 on FaqService; header search on BlogService) can
    // consume them directly, the same "exported for cross-module use" shape as OrdersModule.
    FaqModule,
    TipsModule,
    TestimonialsModule,
    BlogModule,
    AboutModule,
    PortfolioModule,
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
    // Mints/reads the guest-cart-session cookie on every cart route regardless of auth state —
    // see cart-session.middleware.ts for why this can't just reuse the @Public()/JwtAuthGuard
    // optional-auth pattern (cart needs a real identity even with zero user ever issued).
    consumer.apply(CartSessionMiddleware).forRoutes({ path: 'api/cart*', method: RequestMethod.ALL });
  }
}
