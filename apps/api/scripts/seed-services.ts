// One-time/dev seed for the Services Module (docs/specs/2026-08-29-17-services-module.md,
// aspect A-014/A-014a/A-014b) — the 2 main services and their 18 combined sub-categories named
// verbatim in spec AC-2/AC-3, so /services is never empty at launch (spec §4 Migration: "Backfill
// required: yes").
//
// IMPORTANT — content-governance note (mirrors seed-content.ts): visualImageUrl values below are
// local-dev placeholder paths, not real photography. Spec AC-4 ("realistic, service-specific
// visuals... never generic stock imagery") governs what Admin actually publishes through the Admin
// UI — these placeholders exist only so the Services pages render something in local/QA use.
//
// Run once, from a trusted machine with DATABASE_URL access:
//   pnpm --filter @czd/api exec ts-node -T scripts/seed-services.ts
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

interface SubService {
  name: string;
  slug: string;
  description: string;
}

interface MainService {
  name: string;
  slug: string;
  type: 'embroidery_digitizing' | 'vector_art';
  description: string;
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
    applications: 'Apparel branding, corporate uniforms, cap and hat embroidery, patches and badges, monogrammed gifts, and promotional merchandise.',
    process: 'Submit your artwork, we digitize it with the right stitch types and underlay for the fabric, you review a stitch-out proof, then receive your final files in every format you need.',
    subServices: [
      { name: 'Logo Digitizing', slug: 'logo-digitizing', description: 'Clean, accurate digitizing of your logo for consistent embroidery across any fabric.' },
      { name: 'Cap & Hat Digitizing', slug: 'cap-hat-digitizing', description: 'Digitizing optimized for the curved surface and tight hoop of caps and hats.' },
      { name: '3D Puff Digitizing', slug: '3d-puff-digitizing', description: 'Raised, foam-backed puff embroidery for bold, dimensional lettering and logos.' },
      { name: 'Left Chest Digitizing', slug: 'left-chest-digitizing', description: 'Compact, small-format digitizing sized for the standard left-chest placement on shirts and jackets.' },
      { name: 'Jacket Back Digitizing', slug: 'jacket-back-digitizing', description: 'Large-format digitizing for full jacket-back designs and bold statement embroidery.' },
      { name: 'Patch & Badge Digitizing', slug: 'patch-badge-digitizing', description: 'Digitizing tailored for standalone embroidered patches and badges.' },
      { name: 'Appliqué Digitizing', slug: 'applique-digitizing', description: 'Fabric-appliqué embroidery combining tackdown stitching with a fabric layer for a textured finish.' },
      { name: 'Image-to-Embroidery', slug: 'image-to-embroidery', description: 'Converting a photo or detailed image into a stitchable embroidery design.' },
      { name: 'Monogram & Lettering', slug: 'monogram-lettering', description: 'Precise digitizing for monograms, initials, and small-scale text embroidery.' },
    ],
  },
  {
    name: 'Vector Art',
    slug: 'vector-art',
    type: 'vector_art',
    description:
      'Clean, scalable vector artwork for branding, printing, and production — from raster-to-vector conversion to print-ready logo files.',
    applications: 'Print and signage, embroidery-ready outlines, packaging artwork, rebranding, and any use case that needs infinitely scalable, editable line art.',
    process: 'Send your source image or logo, we redraw or convert it into clean vector paths, you review a proof, then receive your final files in the formats you need (AI, EPS, SVG, PDF).',
    subServices: [
      { name: 'Raster-to-Vector Conversion', slug: 'raster-to-vector-conversion', description: 'Converting a raster image (JPG, PNG) into clean, scalable vector paths.' },
      { name: 'Logo Redrawing', slug: 'logo-redrawing', description: 'Recreating a low-quality or damaged logo as crisp, scalable vector artwork.' },
      { name: 'Logo Cleanup', slug: 'logo-cleanup', description: 'Tidying up an existing vector logo — fixing paths, colors, and stray points.' },
      { name: 'Hand-Drawn Artwork', slug: 'hand-drawn-artwork', description: 'Converting a hand-drawn sketch into finished, production-ready vector art.' },
      { name: 'Image Redraw', slug: 'image-redraw', description: 'Redrawing a complex image as vector art while preserving its original detail.' },
      { name: 'Color Separation', slug: 'color-separation', description: 'Separating vector artwork into individual color layers for screen printing.' },
      { name: 'Print-Ready Artwork', slug: 'print-ready-artwork', description: 'Finalizing vector artwork to print-production specifications.' },
      { name: 'Vector Logo Conversion', slug: 'vector-logo-conversion', description: 'Converting any logo format into a fully editable vector file.' },
      { name: 'Artwork Editing', slug: 'artwork-editing', description: 'Editing existing vector artwork — color changes, resizing, text updates, and layout tweaks.' },
    ],
  },
];

async function main() {
  for (const [mainIndex, main] of SERVICES.entries()) {
    const mainRow = await prisma.service.upsert({
      where: { slug: main.slug },
      update: {},
      create: {
        name: main.name,
        slug: main.slug,
        type: main.type,
        description: main.description,
        visualImageUrl: `/images/services/${main.slug}.jpg`,
        applications: main.applications,
        process: main.process,
        sortOrder: mainIndex,
        isPublished: true,
      },
    });

    for (const [subIndex, sub] of main.subServices.entries()) {
      await prisma.service.upsert({
        where: { slug: sub.slug },
        update: {},
        create: {
          name: sub.name,
          slug: sub.slug,
          type: main.type,
          parentServiceId: mainRow.id,
          description: sub.description,
          visualImageUrl: `/images/services/${sub.slug}.jpg`,
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
