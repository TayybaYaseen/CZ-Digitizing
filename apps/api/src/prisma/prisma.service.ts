import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';

// Deliberately no eager $connect() in onModuleInit: Prisma connects lazily on
// the first query, so the API can boot and serve /health before Postgres is
// reachable. Only $disconnect on shutdown to release the pool cleanly.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
