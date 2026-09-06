'use client';

import { useParams } from 'next/navigation';
import { ServiceDetail } from '@/components/ServiceDetail';

// docs/specs/2026-08-29-17-services-module.md AC-2/AC-3 —
// /services/embroidery-digitizing/:subSlug, /services/vector-art/:subSlug. Services are resolved
// by their own flat slug (GET /api/services/:slug) regardless of URL depth, so this reuses the
// same ServiceDetail component as the parent route.
export default function SubServiceDetailPage() {
  const { subSlug } = useParams<{ slug: string; subSlug: string }>();
  return <ServiceDetail slug={subSlug} />;
}
