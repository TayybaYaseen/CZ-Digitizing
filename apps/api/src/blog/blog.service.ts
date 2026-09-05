import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma';
import { AuditLogService } from '../audit/audit-log.service';
import type { AccessTokenPayload } from '../auth/token.types';
import { ApiException } from '../common/exceptions/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import type { PagedResult } from '../designs/designs.service';
import type { BlogQueryDto } from './dto/blog-query.dto';
import { toBlogPostDto, toBlogPostSummaryDto } from './dto/blog.dto';
import type { CreateBlogPostDto, UpdateBlogPostDto } from './dto/blog-write.dto';

// docs/specs/2026-08-28-10-content-knowledge-base.md §3/§4 (aspect A-012d).
@Injectable()
export class BlogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // AC-10 — newest first, published-only + language-filtered for public callers.
  async list(query: BlogQueryDto, includeUnpublished = false): Promise<PagedResult<ReturnType<typeof toBlogPostSummaryDto>>> {
    const where: Prisma.BlogPostWhereInput = { ...(includeUnpublished ? {} : { isPublished: true }) };
    if (query.category) where.category = query.category;
    if (query.language_code) where.languageCode = query.language_code;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return { items: rows.map(toBlogPostSummaryDto), total };
  }

  // AC-14 — header search: matching published post titles/content.
  async search(q: string) {
    if (!q.trim()) return [];
    const rows = await this.prisma.blogPost.findMany({
      where: { isPublished: true, OR: [{ title: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }] },
      orderBy: { publishedAt: 'desc' },
      take: 10,
    });
    return rows.map(toBlogPostSummaryDto);
  }

  async getBySlug(slug: string, includeUnpublished = false) {
    const row = await this.prisma.blogPost.findFirst({ where: { slug, ...(includeUnpublished ? {} : { isPublished: true }) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Blog post not found');
    return toBlogPostDto(row);
  }

  async create(dto: CreateBlogPostDto, admin: AccessTokenPayload) {
    if (await this.prisma.blogPost.findUnique({ where: { slug: dto.slug } })) {
      throw new ApiException('SLUG_ALREADY_EXISTS', 409, 'A blog post with this slug already exists');
    }
    const isPublished = dto.isPublished ?? false;
    const row = await this.prisma.blogPost.create({
      data: {
        title: dto.title,
        slug: dto.slug,
        coverImageUrl: dto.coverImageUrl,
        body: dto.body,
        category: dto.category,
        languageCode: dto.languageCode ?? 'en',
        isPublished,
        publishedAt: isPublished ? new Date() : null,
        createdByAdminId: BigInt(admin.sub),
      },
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'BLOG_POST_CREATED', resourceType: 'blog_post', resourceId: row.id.toString() });
    return toBlogPostDto(row);
  }

  // AC-15 — edit reflects immediately, updatedAt changes (Prisma's @updatedAt does this for free).
  async update(id: string, dto: UpdateBlogPostDto, admin: AccessTokenPayload) {
    const existing = await this.findOrThrow(id);
    if (dto.slug && dto.slug !== existing.slug) {
      const conflict = await this.prisma.blogPost.findUnique({ where: { slug: dto.slug } });
      if (conflict) throw new ApiException('SLUG_ALREADY_EXISTS', 409, 'A blog post with this slug already exists');
    }

    const nowPublishing = dto.isPublished === true && !existing.isPublished;
    const row = await this.prisma.blogPost.update({
      where: { id: BigInt(id) },
      data: {
        title: dto.title,
        slug: dto.slug,
        coverImageUrl: dto.coverImageUrl,
        body: dto.body,
        category: dto.category,
        languageCode: dto.languageCode,
        isPublished: dto.isPublished,
        publishedAt: nowPublishing ? new Date() : undefined,
      },
    });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'BLOG_POST_UPDATED', resourceType: 'blog_post', resourceId: id, changes: dto as Record<string, unknown> });
    return toBlogPostDto(row);
  }

  // AC-16 — hard delete, no soft-delete precedent for this content type.
  async remove(id: string, admin: AccessTokenPayload) {
    await this.findOrThrow(id);
    await this.prisma.blogPost.delete({ where: { id: BigInt(id) } });
    await this.audit.record({ adminUserId: BigInt(admin.sub), actionType: 'BLOG_POST_DELETED', resourceType: 'blog_post', resourceId: id });
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.blogPost.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new ApiException('RESOURCE_NOT_FOUND', 404, 'Blog post not found');
    return row;
  }
}
