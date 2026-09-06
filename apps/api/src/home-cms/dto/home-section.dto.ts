import type { HomeSectionDto } from '@czd/shared-types';
import type { Design, DesignCategoryAssignment, DesignSize, DesignSubcategory, Favorite, HomeSection, HomeSectionDesign } from '../../generated/prisma';
import { toDesignSummaryDto } from '../../designs/dto/design.dto';

type DesignWithRelations = Design & {
  subcategory: DesignSubcategory | null;
  categoryAssignments: DesignCategoryAssignment[];
  sizes?: DesignSize[];
  favorites?: Favorite[];
};

type HomeSectionWithDesigns = HomeSection & {
  designs: (HomeSectionDesign & { design: DesignWithRelations })[];
};

export function toHomeSectionDto(row: HomeSectionWithDesigns): HomeSectionDto {
  return {
    id: row.id.toString(),
    heading: row.heading,
    description: row.description,
    sortOrder: row.sortOrder,
    isPublished: row.isPublished,
    designs: [...row.designs]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((entry) => toDesignSummaryDto(entry.design)),
  };
}
