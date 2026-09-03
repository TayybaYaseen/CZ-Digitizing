import { randomUUID, createHash, createHmac, timingSafeEqual } from 'crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Env } from '../config/env.validation';
import { RedisService } from '../redis/redis.service';

const DOWNLOAD_TOKEN_PREFIX = 'file-download:used:';

export interface SignedDownloadToken {
  token: string;
  expiresAt: Date;
}

// docs/specs/2026-08-28-05-private-file-management.md §1/AC-4 — "short-lived signed URLs", "the
// real storage path is never present in the response". No cloud storage client is configured in
// this repo yet (per plan, an explicit scope decision), so this stores files on local disk under a
// private, non-web-served root and issues a real signed/expiring/single-use token in its place —
// swapping to S3/GCS/etc. later only touches this one service, nothing that calls it.
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly root: string;
  private readonly tokenSecret: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly redis: RedisService,
  ) {
    this.root = config.get('STORAGE_PRIVATE_ROOT', { infer: true });
    // Reuses APP_ENCRYPTION_KEY rather than adding a new secret — this token's only job is
    // integrity/expiry, not encrypting the file itself, so a dedicated secret isn't warranted.
    this.tokenSecret = config.get('APP_ENCRYPTION_KEY', { infer: true });
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }

  hashContent(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  // Content-addressed storage path — a byte-identical re-upload lands on the same path (AC-7 dedup
  // pairs with DesignsService checking uploadHash before writing again).
  private pathForHash(hash: string): string {
    return join(this.root, hash.slice(0, 2), hash.slice(2, 4), hash);
  }

  async save(buffer: Buffer, hash: string): Promise<string> {
    const path = this.pathForHash(hash);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, buffer);
    return path;
  }

  async read(storagePath: string): Promise<Buffer> {
    return readFile(storagePath);
  }

  async delete(storagePath: string): Promise<void> {
    await rm(storagePath, { force: true });
  }

  // AC-4 — 10-minute expiry, single-use (a captured/replayed token can't be reused). jti-based
  // single-use consumption mirrors MagicLinkService.claimSingleUse's Redis `SET NX` pattern.
  generateSignedToken(fileId: string, ttlSeconds: number): SignedDownloadToken {
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const payload = `${fileId}.${jti}.${expiresAt.getTime()}`;
    const signature = createHmac('sha256', this.tokenSecret).update(payload).digest('base64url');
    const token = Buffer.from(`${payload}.${signature}`).toString('base64url');
    return { token, expiresAt };
  }

  verifyTokenSignature(token: string): { fileId: string; jti: string; expiresAt: Date } | null {
    let decoded: string;
    try {
      decoded = Buffer.from(token, 'base64url').toString('utf8');
    } catch {
      return null;
    }
    const parts = decoded.split('.');
    if (parts.length !== 4) return null;
    const [fileId, jti, expiresAtMs, signature] = parts;
    const payload = `${fileId}.${jti}.${expiresAtMs}`;
    const expected = createHmac('sha256', this.tokenSecret).update(payload).digest('base64url');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const expiresAt = new Date(Number(expiresAtMs));
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) return null;

    return { fileId, jti, expiresAt };
  }

  // Atomically claims the jti — a second attempt to consume the same token fails, closing the
  // "captured URL replayed within its 10-minute window" gap a bare signature check leaves open.
  async claimSingleUse(jti: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.client.set(`${DOWNLOAD_TOKEN_PREFIX}${jti}`, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }
}
