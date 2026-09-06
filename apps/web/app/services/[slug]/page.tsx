'use client';

import { useParams } from 'next/navigation';
import { ServiceDetail } from '@/components/ServiceDetail';

// docs/specs/2026-08-29-17-services-module.md AC-2/AC-3 — /services/embroidery-digitizing,
// /services/vector-art.
export default function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  return <ServiceDetail slug={slug} />;
}
