import { Injectable } from '@nestjs/common';
import { ApiException } from '../exceptions/api-exception';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RateLimiterService {
  constructor(private readonly redis: RedisService) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<void> {
    const count = await this.redis.client.incr(key);
    if (count === 1) await this.redis.client.expire(key, windowSeconds);
    if (count > limit) throw new ApiException('RATE_LIMITED', 429, 'Too many requests — try again later');
  }
}
