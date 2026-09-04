// One-time/dev seed for detailed "Tips for Embroiderers" articles (docs/specs/2026-08-28-10-
// content-knowledge-base.md, aspect A-012b), covering every subtopic named in the Master SRS
// Addendum §8: "beginner embroidery, fabric/stabilizer/needle/thread, hooping, sizing, stitch
// density/direction, underlay, pull compensation, satin/fill, small lettering, fabric-specific
// advice, machine problems, tension, registration, puckering, stitch-out tests, quality control
// and professional client-management." Tips can be linked to FAQ (SRS Addendum §8) — the
// stabilizer tip below links to the matching FAQ entry created by seed-content.ts.
//
// Run once, from a trusted machine with DATABASE_URL access:
//   pnpm --filter @czd/api exec ts-node -T scripts/seed-tips.ts
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

const TIPS: { title: string; category: string; content: string; linkedFaqQuestionContains?: string }[] = [
  {
    title: 'Getting started with machine embroidery: a beginner\'s guide',
    category: 'Beginner Basics',
    content: `
<p>Machine embroidery rewards patience and preparation far more than expensive equipment. Before you run your first design, take time to understand the four things that decide whether a stitch-out looks professional or amateurish: the fabric, the stabilizer, the hoop tension, and the digitized file itself.</p>
<p>Start with simple, low-stitch-count designs on stable, woven fabric like cotton twill. Avoid stretchy knits, slippery satins, or terry cloth until you're comfortable with hooping and tension — those fabrics demand extra stabilizing techniques covered in our fabric-specific tips below.</p>
<ul>
<li>Always run a test stitch-out on a scrap of the same fabric before committing to the final garment.</li>
<li>Keep a log of which needle, thread weight, and stabilizer combination worked for each fabric type — you'll reuse this constantly.</li>
<li>Clean and oil your machine regularly; lint buildup in the bobbin case is the single most common cause of unexplained thread breaks for beginners.</li>
</ul>
<p>Most importantly: a beautifully digitized design (like the ones in our catalog) can still look poor if hooped loosely or stitched on the wrong stabilizer — digitizing quality and stitching technique are equally important.</p>`,
  },
  {
    title: 'Choosing the right stabilizer for every fabric',
    category: 'Fabric & Stabilizer',
    linkedFaqQuestionContains: 'stabilizer',
    content: `
<p>Stabilizer is the unsung hero of clean embroidery — it prevents the fabric from stretching, puckering, or shifting under the stress of thousands of stitches. Choosing the wrong type is the most common cause of distorted designs.</p>
<ul>
<li><strong>Cut-away stabilizer</strong> — use for knits, stretchy fabrics, and anything that will be worn/washed repeatedly (polos, t-shirts, activewear). It stays permanently behind the stitches for lasting support.</li>
<li><strong>Tear-away stabilizer</strong> — use for stable wovens (quilting cotton, canvas, twill) where the stabilizer can be torn away cleanly after stitching without disturbing the design.</li>
<li><strong>Water-soluble stabilizer</strong> — use on top of fabrics with pile or texture (terry cloth, fleece, corduroy) to keep stitches from sinking into the nap, and for freestanding lace where the fabric itself dissolves away.</li>
<li><strong>Self-adhesive/sticky stabilizer</strong> — useful for delicate items or pieces too small/awkward to hoop directly (collars, cuffs, pocket flaps).</li>
</ul>
<p>As a rule of thumb: heavier stitch density and larger designs need heavier stabilizer weight. When in doubt, it's safer to over-stabilize a test piece than to under-stabilize your final garment.</p>`,
  },
  {
    title: 'Needle and thread selection for consistent results',
    category: 'Needle & Thread',
    content: `
<p>Needle type and size should match both your thread weight and your fabric — mismatches cause skipped stitches, thread shredding, and visible needle holes.</p>
<ul>
<li>Use a <strong>sharp/embroidery needle</strong> (sizes 75/11 to 90/14) for most woven fabrics.</li>
<li>Use a <strong>ballpoint needle</strong> for knits — it pushes fibers aside instead of piercing them, reducing runs and holes.</li>
<li>Match thread weight to design detail: 40wt rayon or polyester is the standard for most commercial designs; 60wt is better for fine lettering and delicate detail where thread bulk would obscure small letterforms.</li>
<li>Replace needles every 6–8 hours of stitching time (or sooner on abrasive fabrics like denim) — a dull needle is a common, overlooked cause of poor stitch quality.</li>
</ul>
<p>Bobbin thread matters too: a lightweight, consistent bobbin thread (60–90wt) reduces bulk on the underside and helps the top thread lay flatter.</p>`,
  },
  {
    title: 'Hooping technique: the foundation of clean embroidery',
    category: 'Hooping',
    content: `
<p>Even a perfectly digitized design will distort if hooped poorly. The goal is drum-tight fabric with no fabric or stabilizer shifting during stitching, but without stretching the fabric out of shape.</p>
<ul>
<li>Hoop the stabilizer together with the fabric whenever possible — hooping fabric alone and "floating" a separate stabilizer underneath should be reserved for items too thick or textured to hoop directly (and requires extra care to keep the stabilizer from shifting).</li>
<li>Check that the fabric grain runs straight in the hoop — a slightly twisted hoop job shows up clearly on straight-line designs like text.</li>
<li>Tighten the hoop screw fully, then gently smooth the fabric from the center outward to remove slack without stretching knits.</li>
<li>Re-hoop between multiple placements on the same garment rather than trying to stretch one hooping to cover two spots — accuracy always beats convenience.</li>
</ul>`,
  },
  {
    title: 'Sizing your design correctly for the garment and placement',
    category: 'Sizing',
    content: `
<p>A design digitized at one size doesn't always scale cleanly to another — stitch density, underlay, and pull compensation are all calculated for a specific size range. Scaling a design down more than about 20% from its digitized size, for example, can cause satin columns to become too dense and fabric to pucker.</p>
<ul>
<li>Left-chest logos are typically 3.5–4 inches wide; jacket backs are typically 10–12 inches; cap fronts are usually under 2.5 inches tall due to the curved surface.</li>
<li>If you need a significantly different size than what was digitized, request a re-digitize at that size rather than scaling in software — this is exactly what our size options on each design listing are for.</li>
<li>Always account for the hoop size available on your machine when choosing a design size, especially for large jacket-back or blanket designs.</li>
</ul>`,
  },
  {
    title: 'Stitch density and direction — why they matter',
    category: 'Stitch Density & Direction',
    content: `
<p>Stitch density (how close together the stitch lines are) and stitch direction both affect how a design looks and feels on fabric. Too dense, and the fabric stiffens and can pucker; too sparse, and fabric shows through the stitches.</p>
<ul>
<li>Typical fill density is around 4–4.5 points between stitch lines for standard apparel; delicate fabrics need lower density, and toweling/terry needs higher density to fully cover the pile.</li>
<li>Stitch direction should generally follow the shape being filled — angled or radial fills catch the light differently and are used deliberately by digitizers for visual texture, not left to chance.</li>
<li>Changing stitch direction between adjacent color blocks helps define edges and prevents blending between similar thread colors.</li>
</ul>`,
  },
  {
    title: 'Understanding underlay stitching',
    category: 'Underlay',
    content: `
<p>Underlay is a foundation layer of stitches placed before the visible top stitching. It stabilizes the fabric, provides a base for the top stitches to sit on, and helps prevent the fabric from showing through low-density fills.</p>
<ul>
<li>Edge-walk underlay (stitching along the shape's border) is common for satin columns, giving the edge a cleaner, more defined look.</li>
<li>Zig-zag or fill underlay is used under larger fill areas, especially on stretchy or pile fabrics, to lock the fibers down before the top stitching begins.</li>
<li>Skipping underlay to "save stitches" on stretch fabrics is one of the most common causes of a design that looks fine on the machine but distorts once the garment is worn and stretched.</li>
</ul>`,
  },
  {
    title: 'Pull compensation: keeping shapes accurate after stitching',
    category: 'Pull Compensation',
    content: `
<p>As stitches are formed, the thread pulls the fabric slightly inward — without correction, circles become ovals and squares shrink along their stitch direction. Pull compensation is a digitizing technique that widens shapes slightly in the direction of the pull, so the finished result matches the intended size and shape.</p>
<p>This is one of the reasons professional digitizing matters more than free/auto-digitizing tools — pull compensation has to be judged per-fabric and per-shape, and it's something our digitizing process accounts for on every design.</p>`,
  },
  {
    title: 'Satin stitch vs. fill stitch: when to use each',
    category: 'Satin & Fill',
    content: `
<p>Satin stitches are tight, parallel zig-zag stitches best suited to narrow shapes like letters, borders, and outlines — they give a smooth, glossy, ribbon-like finish. Fill stitches (also called tatami) are used for larger open areas, made of many short stitches in a repeating pattern.</p>
<ul>
<li>Satin columns wider than about 12mm become loose and prone to snagging — wide areas should use fill stitch instead, or be split with a fill underlay beneath a satin border.</li>
<li>Fill stitches handle large areas efficiently and produce fewer long thread "floats" that can catch or fray.</li>
<li>Good digitizing chooses the right stitch type per shape automatically — this is one of the visible signs of design quality when you flip a design card and review the stitch/thread details.</li>
</ul>`,
  },
  {
    title: 'Small lettering and monograms without losing legibility',
    category: 'Small Lettering',
    content: `
<p>Small text is one of the hardest things to embroider cleanly — below a certain height, satin-stitched letters start to fill in and lose their shape entirely.</p>
<ul>
<li>Keep lettering above roughly 4–5mm cap height for satin-stitched fonts; below that, switch to a simplified, single-run "small text" font style designed specifically for tiny lettering.</li>
<li>Avoid script/cursive fonts below about 6mm — thin connecting strokes tend to disappear or bridge together.</li>
<li>Use lighter-weight thread (60wt) and reduce underlay for very small letters to avoid excess bulk that swallows fine detail.</li>
<li>Our Monogram & Lettering service specifically accounts for these limits — if your intended text is very small, we'll flag legibility concerns before digitizing rather than after.</li>
</ul>`,
  },
  {
    title: 'Fabric-specific advice: knits, denim, leather and terry cloth',
    category: 'Fabric-Specific Advice',
    content: `
<p>Different fabrics need different handling beyond just stabilizer choice:</p>
<ul>
<li><strong>Knits (t-shirts, polos):</strong> use cut-away stabilizer, a ballpoint needle, and moderate hooping tension — over-stretching in the hoop causes the design to pucker once released.</li>
<li><strong>Denim:</strong> use a sharp/denim needle (size 90/14 or larger), reduce speed to avoid needle heat buildup, and expect to replace needles more frequently due to the abrasive weave.</li>
<li><strong>Leather/vinyl:</strong> never hoop directly — use adhesive stabilizer or basting tape, a leather-point needle, and test on scrap first since needle holes in leather are permanent.</li>
<li><strong>Terry cloth (towels):</strong> use water-soluble topping to keep stitches from sinking into the pile, along with heavier fill density and a medium-weight cut-away stabilizer underneath.</li>
</ul>`,
  },
  {
    title: 'Diagnosing common embroidery machine problems',
    category: 'Machine Problems',
    content: `
<p>Most stitching problems trace back to one of a handful of root causes:</p>
<ul>
<li><strong>Thread breaks:</strong> check for a burred needle, incorrect needle size for the thread weight, thread path snagging on a spool cap, or too-high tension.</li>
<li><strong>Skipped stitches:</strong> usually a needle/fabric mismatch (use ballpoint on knits), a dull or bent needle, or timing drift needing machine service.</li>
<li><strong>Bird-nesting on the underside:</strong> almost always a bobbin threading error or incorrect bobbin tension.</li>
<li><strong>Machine stopping mid-design:</strong> often a corrupted or incompatible file format — this is exactly why we validate every file before delivery and provide the specific machine format you request.</li>
</ul>`,
  },
  {
    title: 'Getting thread tension right',
    category: 'Tension',
    content: `
<p>Correctly balanced tension shows top thread on the front and bobbin thread barely visible on the back, meeting exactly at the fabric surface. Signs of imbalance:</p>
<ul>
<li>Bobbin thread visible on the top of the design → top tension too loose, or bobbin tension too tight.</li>
<li>Top thread visible looping on the underside → top tension too tight, or bobbin tension too loose.</li>
<li>Always re-check tension after switching thread weight, fabric type, or after any major machine maintenance — tension settings that worked yesterday can drift.</li>
</ul>`,
  },
  {
    title: 'Fixing registration and alignment issues',
    category: 'Registration',
    content: `
<p>Registration problems (colors or shapes not lining up as intended) usually come from one of these: fabric shifting mid-stitch due to insufficient hooping tension, an under-stabilized hoop allowing movement between color changes, or a machine that needs a hoop-alignment/timing check.</p>
<p>If registration issues appear only on one specific design, it's worth confirming the file itself stitches correctly on a different machine before assuming a hardware fault — a corrupted or poorly converted file is a common, overlooked cause.</p>`,
  },
  {
    title: 'Preventing puckering on finished embroidery',
    category: 'Puckering',
    content: `
<p>Puckering (fabric bunching around the stitched design) is almost always one of: insufficient stabilizer for the fabric weight, too-high stitch density for a lightweight fabric, hoop tension too loose, or missing/insufficient underlay.</p>
<ul>
<li>Match stabilizer weight to both fabric weight and design density — when unsure, size up.</li>
<li>For lightweight wovens, request digitizing with reduced density and proper underlay rather than trying to compensate with stabilizer alone.</li>
<li>Steam-pressing (never directly ironing over embroidery) can relax minor puckering after stitching, but it's not a substitute for getting stabilizer and density right up front.</li>
</ul>`,
  },
  {
    title: 'Why stitch-out tests matter every time',
    category: 'Stitch-Out Tests',
    content: `
<p>A stitch-out test — running the design once on a scrap of the actual production fabric and stabilizer before committing to the real garment — is the single best habit for avoiding costly mistakes, especially on new fabric types or large production runs.</p>
<ul>
<li>Confirms thread colors match expectations under real lighting, not just on-screen.</li>
<li>Confirms hooping tension and stabilizer choice for that specific fabric batch (fabric can vary between rolls/suppliers).</li>
<li>Catches file/format issues before they interrupt a production run.</li>
</ul>
<p>We recommend a stitch-out test especially before any bulk/production order, even when reusing a design you've stitched successfully before on a different fabric.</p>`,
  },
  {
    title: 'A practical quality-control checklist',
    category: 'Quality Control',
    content: `
<p>Before calling any embroidered piece finished, check:</p>
<ul>
<li>No visible bobbin thread on the top, no visible top thread loops on the back.</li>
<li>No puckering or fabric distortion around the design edges.</li>
<li>All thread trims clean — no loose "jump stitch" threads left uncut.</li>
<li>Colors and placement match the approved design/proof exactly.</li>
<li>Stabilizer fully removed (tear-away) or trimmed neatly close to the stitching (cut-away).</li>
<li>Design centered and aligned correctly relative to seams, buttons, or garment edges.</li>
</ul>`,
  },
  {
    title: 'Managing embroidery clients professionally',
    category: 'Professional Client Management',
    content: `
<p>Clear expectations up front prevent most client disputes later:</p>
<ul>
<li>Always confirm exact placement, size, and thread colors in writing (a quick photo mockup helps enormously) before production.</li>
<li>Set realistic turnaround expectations, especially for bulk orders or unfamiliar fabrics that may need a stitch-out test first.</li>
<li>Keep samples/photos of past work organized by client and design — this is exactly why a persistent order/design history (like the one in your CZ Digitizing account) is valuable for repeat business.</li>
<li>When a design needs revision, be specific about what changed and why (e.g. "reduced density to prevent puckering on this fabric") so clients understand the craftsmanship involved, not just the price.</li>
</ul>`,
  },
];

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!admin) {
    console.error('No admin user found — run scripts/seed-admin.ts first.');
    process.exitCode = 1;
    return;
  }

  let count = 0;
  for (const tip of TIPS) {
    const exists = await prisma.embroidererTip.findFirst({ where: { title: tip.title } });
    if (exists) continue;

    let linkedFaqId: bigint | undefined;
    if (tip.linkedFaqQuestionContains) {
      const faq = await prisma.faq.findFirst({ where: { question: { contains: tip.linkedFaqQuestionContains } } });
      linkedFaqId = faq?.id;
    }

    await prisma.embroidererTip.create({
      data: {
        title: tip.title,
        content: tip.content.trim(),
        category: tip.category,
        isPublished: true,
        createdByAdminId: admin.id,
        faqLinks: linkedFaqId ? { create: [{ faqId: linkedFaqId }] } : undefined,
      },
    });
    count++;
  }

  console.log(`Seeded ${count} new Tips for Embroiderers articles (${TIPS.length} defined, rest already existed) across ${new Set(TIPS.map((t) => t.category)).size} categories.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
