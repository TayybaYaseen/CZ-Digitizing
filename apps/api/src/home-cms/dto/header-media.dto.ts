import type { HeaderMediaDto } from '@czd/shared-types';
import type { HeaderMedia } from '../../generated/prisma';

export function toHeaderMediaDto(row: HeaderMedia): HeaderMediaDto {
  return {
    id: row.id.toString(),
    imageUrl: row.imageUrl,
    videoUrl: row.videoUrl,
    heading: row.heading,
    subheading: row.subheading,
    ctaLink: row.ctaLink,
    priority: row.priority,
    isCarouselItem: row.isCarouselItem,
    autoSlideDurationSeconds: row.autoSlideDurationSeconds,
  };
}
