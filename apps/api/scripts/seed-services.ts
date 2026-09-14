// One-time/dev seed for the Services Module (docs/specs/2026-08-29-17-services-module.md,
// aspect A-014/A-014a/A-014b) — the 2 main services and their 18 combined sub-categories named
// verbatim in spec AC-2/AC-3, so /services is never empty at launch (spec §4 Migration: "Backfill
// required: yes").
//
// IMPORTANT — content-governance note on AC-4 ("realistic, service-specific visuals... never
// generic stock imagery"), 2026-09-14 status (2026-09-14 gap-audit fix, same-day follow-up):
//
// Both main services now have a real, purpose-made hero image (Admin-supplied, saved to
// apps/web/public/images/services/embroidery-digitizing.png and vector-art.png — Next.js only
// serves from its own app's public/ folder, same posture as Logo.tsx's own copied brand assets).
// A prior version of this file pointed at /images/services/<slug>.jpg paths that were never
// actually created at all — every card/detail page was a broken image, not just an "unrealistic"
// one; that's fixed for both main services now.
//
// Embroidery Digitizing's 9 sub-categories use 5 distinct real embroidery photos (no photography
// exists per individual sub-category, so several intentionally share one — every image is still
// real CZ Digitizing product photography, never a generic stock substitute, but "each sub-category
// has its own unique photo" is not yet true). jacket-back-digitizing and left-chest-digitizing DO
// have an exact 1:1 match (a real jacket-back and a real left-chest-placement polo shot).
//
// Vector Art's 9 sub-categories reuse the new Vector Art main-service hero image (still one shared
// image across all 9, not sub-category-unique, but now genuinely vector-art-themed content rather
// than the CZ logo-mark stand-in this file used before today's follow-up) — AC-4's
// "service-specific" requirement remains a real, open gap for these 9 rows specifically until
// per-sub-category vector-art sample imagery is supplied.
//
// Run once, from a trusted machine with DATABASE_URL access:
//   pnpm --filter @czd/api exec ts-node -T scripts/seed-services.ts
import { PrismaClient } from '../src/generated/prisma';

const VECTOR_ART_MAIN = '/images/services/vector-art.png';
// Sub-category stand-in — see this file's own header comment for why.
const VECTOR_ART_SUB_PLACEHOLDER = VECTOR_ART_MAIN;

const prisma = new PrismaClient();

interface SubService {
  name: string;
  slug: string;
  description: string;
  visualImageUrl: string;
}

interface MainService {
  name: string;
  slug: string;
  type: 'embroidery_digitizing' | 'vector_art';
  description: string;
  visualImageUrl: string;
  applications: string;
  process: string;
  subServices: SubService[];
}

// Spec AC-2 — exact sub-category list, "Monogram & Lettering" per the spec's terminology note
// (not "Small Lettering" — see spec §2 "Terminology note").
const SERVICES: MainService[] = [
  {
    name: 'Embroidery Digitizing',
    slug: 'embroidery-digitizing',
    type: 'embroidery_digitizing',
    description:
      'Professional machine embroidery digitizing that turns your artwork or logo into a clean, production-ready stitch file, delivered in the machine format your embroidery machine needs.',
    visualImageUrl: '/images/services/embroidery-digitizing.png',
    applications: 'Apparel branding, corporate uniforms, cap and hat embroidery, patches and badges, monogrammed gifts, and promotional merchandise.',
    process: 'Submit your artwork, we digitize it with the right stitch types and underlay for the fabric, you review a stitch-out proof, then receive your final files in every format you need.',
    subServices: [
      { name: 'Logo Digitizing', slug: 'logo-digitizing', description: 'Clean, accurate digitizing of your logo for consistent embroidery across any fabric.', visualImageUrl: '/images/services/logo-digitizing.png' },
      { name: 'Cap & Hat Digitizing', slug: 'cap-hat-digitizing', description: 'Digitizing optimized for the curved surface and tight hoop of caps and hats.', visualImageUrl: '/images/services/cap-hat-digitizing.png' },
      { name: '3D Puff Digitizing', slug: '3d-puff-digitizing', description: 'Raised, foam-backed puff embroidery for bold, dimensional lettering and logos.', visualImageUrl: '/images/services/3d-puff-digitizing.png' },
      // Exact photo match — a real left-chest-placement embroidered polo.
      { name: 'Left Chest Digitizing', slug: 'left-chest-digitizing', description: 'Compact, small-format digitizing sized for the standard left-chest placement on shirts and jackets.', visualImageUrl: '/images/services/left-chest-digitizing.png' },
      // Exact photo match — a real embroidered jacket back.
      { name: 'Jacket Back Digitizing', slug: 'jacket-back-digitizing', description: 'Large-format digitizing for full jacket-back designs and bold statement embroidery.', visualImageUrl: '/images/services/jacket-back-digitizing.png' },
      { name: 'Patch & Badge Digitizing', slug: 'patch-badge-digitizing', description: 'Digitizing tailored for standalone embroidered patches and badges.', visualImageUrl: '/images/services/patch-badge-digitizing.png' },
      { name: 'Appliqué Digitizing', slug: 'applique-digitizing', description: 'Fabric-appliqué embroidery combining tackdown stitching with a fabric layer for a textured finish.', visualImageUrl: '/images/services/applique-digitizing.png' },
      { name: 'Image-to-Embroidery', slug: 'image-to-embroidery', description: 'Converting a photo or detailed image into a stitchable embroidery design.', visualImageUrl: '/images/services/image-to-embroidery.png' },
      { name: 'Monogram & Lettering', slug: 'monogram-lettering', description: 'Precise digitizing for monograms, initials, and small-scale text embroidery.', visualImageUrl: '/images/services/monogram-lettering.png' },
    ],
  },
  {
    name: 'Vector Art',
    slug: 'vector-art',
    type: 'vector_art',
    description:
      'Clean, scalable vector artwork for branding, printing, and production — from raster-to-vector conversion to print-ready logo files.',
    visualImageUrl: VECTOR_ART_MAIN,
    applications: 'Print and signage, embroidery-ready outlines, packaging artwork, rebranding, and any use case that needs infinitely scalable, editable line art.',
    process: 'Send your source image or logo, we redraw or convert it into clean vector paths, you review a proof, then receive your final files in the formats you need (AI, EPS, SVG, PDF).',
    subServices: [
      { name: 'Raster-to-Vector Conversion', slug: 'raster-to-vector-conversion', description: 'Converting a raster image (JPG, PNG) into clean, scalable vector paths.', visualImageUrl: VECTOR_ART_SUB_PLACEHOLDER },
      { name: 'Logo Redrawing', slug: 'logo-redrawing', description: 'Recreating a low-quality or damaged logo as crisp, scalable vector artwork.', visualImageUrl: VECTOR_ART_SUB_PLACEHOLDER },
      { name: 'Logo Cleanup', slug: 'logo-cleanup', description: 'Tidying up an existing vector logo — fixing paths, colors, and stray points.', visualImageUrl: VECTOR_ART_SUB_PLACEHOLDER },
      { name: 'Hand-Drawn Artwork', slug: 'hand-drawn-artwork', description: 'Converting a hand-drawn sketch into finished, production-ready vector art.', visualImageUrl: VECTOR_ART_SUB_PLACEHOLDER },
      { name: 'Image Redraw', slug: 'image-redraw', description: 'Redrawing a complex image as vector art while preserving its original detail.', visualImageUrl: VECTOR_ART_SUB_PLACEHOLDER },
      { name: 'Color Separation', slug: 'color-separation', description: 'Separating vector artwork into individual color layers for screen printing.', visualImageUrl: VECTOR_ART_SUB_PLACEHOLDER },
      { name: 'Print-Ready Artwork', slug: 'print-ready-artwork', description: 'Finalizing vector artwork to print-production specifications.', visualImageUrl: VECTOR_ART_SUB_PLACEHOLDER },
      { name: 'Vector Logo Conversion', slug: 'vector-logo-conversion', description: 'Converting any logo format into a fully editable vector file.', visualImageUrl: VECTOR_ART_SUB_PLACEHOLDER },
      { name: 'Artwork Editing', slug: 'artwork-editing', description: 'Editing existing vector artwork — color changes, resizing, text updates, and layout tweaks.', visualImageUrl: VECTOR_ART_SUB_PLACEHOLDER },
    ],
  },
];

async function main() {
  for (const [mainIndex, main] of SERVICES.entries()) {
    const mainRow = await prisma.service.upsert({
      where: { slug: main.slug },
      // Only visualImageUrl is refreshed on re-run (this fix's own reason for existing — closing
      // the broken-image-path bug on already-seeded rows) — never description/applications/process,
      // which Admin may have already edited through the Admin UI since the initial seed.
      update: { visualImageUrl: main.visualImageUrl },
      create: {
        name: main.name,
        slug: main.slug,
        type: main.type,
        description: main.description,
        visualImageUrl: main.visualImageUrl,
        applications: main.applications,
        process: main.process,
        sortOrder: mainIndex,
        isPublished: true,
      },
    });

    for (const [subIndex, sub] of main.subServices.entries()) {
      await prisma.service.upsert({
        where: { slug: sub.slug },
        update: { visualImageUrl: sub.visualImageUrl },
        create: {
          name: sub.name,
          slug: sub.slug,
          type: main.type,
          parentServiceId: mainRow.id,
          description: sub.description,
          visualImageUrl: sub.visualImageUrl,
          applications: main.applications,
          process: main.process,
          sortOrder: subIndex,
          isPublished: true,
        },
      });
    }
  }

  console.log(`Seeded ${SERVICES.length} main services and ${SERVICES.reduce((n, s) => n + s.subServices.length, 0)} sub-services.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
