# Spec: Professional Portfolio (Enhancement of A-012f)

**File:** `docs/portfolio-spec.md`
**Status:** Draft v4 — specification phase only. No code in this pass.
**Source of truth for professional content:** `M.Suleman_CV.md` (repo root) — the **single** CV
source file. It contains the combined information from both original CV documents, organized as
two internal, clearly labeled sections within this one file ("CV 1" and "CV 2"). These are **not**
separate active source files — they are two portions of the one combined file, and this document
refers to them only that way from here on ("the CV 1 section of `M.Suleman_CV.md`" / "the CV 2
section of `M.Suleman_CV.md`"). No other CV/resume file is used as a source.
**Related:** [Content & Knowledge Base spec](specs/2026-08-28-10-content-knowledge-base.md) (owns
the existing `portfolio_items` table and `/portfolio` routes as aspect **A-012f**),
[Services Module spec](specs/2026-08-29-17-services-module.md), [Brand & Visual Identity
spec](specs/2026-09-02-01-brand-visual-identity.md), `.claude/skills/cz-digitizing-design/`,
[SPEC_INDEX.md](specs/SPEC_INDEX.md)

> **Revision note (Draft v4 — final business-owner corrections applied 2026-09-16.)** This revision
> makes six corrections to Draft v3: (1) confirms `M.Suleman_CV.md` as the single source filename
> throughout; (2) explicitly separates *source preservation* (everything in the CV stays
> documented/traceable in this spec) from *public website content* (only what's approved for
> display, §2.5); (3) removes the personal CV email/phone/address entirely and routes any public
> contact need through the site's **existing** settings, not a hardcoded value; (4) makes the
> Portfolio WhatsApp reference **dynamic**, sourced from the same existing platform setting the
> Footer already reads, never a second hardcoded number; (5) presents the Leads University
> MBA (Marketing) as **completed**, dropping the "ongoing/last semester/pending" framing on the
> public page while still preserving the source's literal, slightly ambiguous wording internally
> (§2.5's distinction, applied); (6) **reverses** Draft v3's "un-attributed, suppressed" treatment
> of the ZDigitizing/Vogue Vesture bullet overlap — both employers now retain their full documented
> responsibilities exactly where `M.Suleman_CV.md` documents them, with no merging, moving, or
> suppression, even where wording is near-identical across the two. **No CV-content item in this
> revision is marked `[REQUIRES BUSINESS OWNER CONFIRMATION]` any longer** — see §2.4 and §23.

> **This is not a greenfield feature.** A-012f "Portfolio" already exists, end‑to‑end, and is
> recorded `Completed` in `SPEC_INDEX.md`. Everything below is written as an **enhancement/
> extension** of A-012f, not a parallel or replacement system. See §20 for the governance boundary
> this document deliberately does not cross.

---

## 1. Purpose

Define, without writing any implementation code, exactly what a professional, CV-grounded
Portfolio experience should contain for CZ Digitizing — public page, admin management, data model,
and design treatment. This revision finalizes every remaining open content decision: the single
source file is `M.Suleman_CV.md`; the public page shows a curated, privacy-safe subset of that
source (§2.5); contact information is never hardcoded, always drawn live from the site's existing
settings; the Leads University credential publishes as completed; and every documented
responsibility — including ones that read similarly under two different employers — stays
attributed to the employer the source actually lists it under.

## 2. Current-project analysis

### 2.1 Existing Portfolio architecture (A-012f) — unchanged

| Layer | File(s) | State |
|---|---|---|
| DB model | `apps/api/prisma/schema.prisma` → `model PortfolioItem` (`portfolio_items` table) | `id`, `title`, `description?`, `mediaUrls: Json`, `category?: String` (free text), `sortOrder`, `isPublished`, `createdByAdminId?`, `createdAt`, `updatedAt`. No language column (AC-17: intentionally language-neutral). |
| API | `apps/api/src/portfolio/{portfolio.controller.ts,portfolio.service.ts,dto/*}` | `GET /api/portfolio` (public, published-only unless staff), `GET /api/portfolio/:id`, `POST/PUT/DELETE /api/portfolio[/:id]`, `PUT /api/portfolio/reorder` — gated `@Roles('admin','freelancer','moderator')` + `@RequiresPermission('portfolio','crud')`. |
| Shared types | `packages/shared-types/src/content.ts` → `PortfolioItemDto` | Mirrors the DB row 1:1. |
| Public web | `apps/web/app/portfolio/page.tsx`, `apps/web/app/portfolio/[id]/page.tsx` | Plain 3-column grid, plain Tailwind gray styling, no brand tokens beyond one `text-brand-navy`. |
| Admin web | `apps/admin/app/portfolio/page.tsx` | Single page: table + inline create/edit form. Already uses the real design system (`Card`/`Button`/`Badge`, `navy-800`/`gold-500`/`font-display`). |
| Navigation | `apps/web/components/Header.tsx` (`MORE_LINKS`), `apps/admin/components/Sidebar.tsx` (`NAV`, `Content` section) | Both already link to `/portfolio` — **no new nav entry needed anywhere; this stays unchanged.** |
| Registry | `docs/specs/SPEC_INDEX.md` row `A-012f` | `Status: Completed`, parent `A-012`. |
| **Existing contact settings (new to this revision's analysis)** | `apps/api/src/settings/platform-settings.service.ts` (A-005a `PlatformSettings`), exposed publicly via `GET /api/settings/public` → `{ whatsappNumber: string \| null; contactEmail: string \| null }`. Already consumed by `apps/web/components/Footer.tsx` (`settings.contactEmail` → `mailto:`, `settings.whatsappNumber` → `https://wa.me/...`). Admin edits these under `/admin/settings/platform`. | This is the **single existing mechanism** the Portfolio's contact CTA must reuse — see §10.4, §15. |

Design tokens (unchanged, verified against real usage): Deep Navy `#0B132B`, Slate Blue `#4A5568`,
Light Gray `#E5E7EB`, Gold `#D4AF37`, White `#FAFAFA`; Playfair Display (`font-display`) for
headings, Montserrat for body/UI; `rounded-card` (10px) cards, `rounded-field` (8px) fields;
navy-tinted `shadow-cz-sm/md/navy/gold`; gold reserved for one primary CTA per view. `Hero.tsx` and
`DesignCard.tsx` remain the literal templates (§7).

### 2.2 What "Completed" does not mean

Unchanged finding from prior drafts: the shipped A-012f is a generic, minimally-styled photo-gallery
content type (plain-Tailwind public pages, free-text category, no featured flag, no image-role
distinction, no CV content anywhere), while the admin side is already properly on-brand and is the
right foundation to extend.

### 2.3 Single combined-CV source

`M.Suleman_CV.md` is **one file**. It contains two originally separate CV write-ups, preserved in
full inside that one file as two labeled sections:

- **The CV 1 section** — embroidery-digitizing-focused: profile, 6 key skills, 3 activities/
  interests, 4 experience entries (Internal Audit Officer at Cross Stitch; Quality Checker at
  ZDigitizing; Digitizer/Embroidery Designer at Vogue Vesture; Freelancer), education (BBA, FSc,
  Matriculation).
- **The CV 2 section** — textile/sourcing-focused: a different profile paragraph, 7 key skills
  (adds Oracle ERP), 2 activities/interests, 5 experience entries (Merchandiser Fabric Sourcing at
  Us Apparel; Internal Audit Officer at Cross Stitch — much more detailed; Embroidery Digitizer at
  Vogue Vesture — its own, shorter bullet list; Internship Student at Nagina Group of Industries),
  education (adds the Leads University entry on top of the same BBA/FSc/Matriculation).

Every fact from both sections is preserved and traceable in §2.4. Nothing is deleted, invented, or
silently rewritten.

### 2.4 Conflict and traceability log (source record — see §2.5 for what actually publishes)

| # | Topic | CV 1 section says | CV 2 section says | Disposition |
|---|---|---|---|---|
| 1 | Professional profile paragraph | Embroidery-digitizing-focused | Textile/sourcing-focused | **Resolved** — merged into one profile, embroidery-primary/textile-secondary, built only from phrases present in both sections (§10.2). |
| 2 | Key Skills | 6 items (no Oracle ERP) | 7 items (adds Oracle ERP) | Union of both (7 items) — additive, no conflict. |
| 3 | Activities & Interests | 3 items: Reading books, Taekwondo, Travel | 2 items: Reading books, Taekwondo | Union of both (3 items) — CV 2 omits Travel, doesn't contradict it. |
| 4 | Cross Stitch — Internal Audit Officer: dates | "June 2024 — Present" | No dates given | Use the CV 1 section's dates. |
| 5 | Cross Stitch — Internal Audit Officer: responsibilities | 5 general audit-process bullets | 15 more specific/operational bullets | Union of both bullet sets — elaboration, not contradiction. |
| 6 | ZDigitizing — Quality Checker | Full entry: "April 2021 — Present," 8 bullets, incl. "improving output accuracy by 20%" | **Not mentioned at all** | Keep the CV 1 section's entry in full, attributed to ZDigitizing exactly as documented (§5.5). |
| 7 | Vogue Vesture — job title | "Digitizer (Embroidery Designer)" | "Embroidery Digitizer" | Same role, phrasing variant — public-facing title: "Embroidery Digitizer" (§5.5). |
| 8 | Vogue Vesture — dates | "March 2019 — February 2022" | No dates given | Use the CV 1 section's dates. |
| 9 | Vogue Vesture — responsibilities, and their overlap with ZDigitizing | 7 bullets specific to Vogue Vesture | 6 bullets, documented under "Embroidery Digitizer • Vogue Vesture," textually near-identical to 6 of the CV 1 section's 8 ZDigitizing bullets (same phrasing, one typo variant: "Pluse tajima" vs "Pulse Tajima") | **Resolved (revised 2026-09-16, reversing Draft v3):** both employers retain their full, independently documented responsibilities exactly as the source lists them under each employer name. ZDigitizing keeps its own 8 bullets (CV 1 section). Vogue Vesture keeps its own 7 bullets (CV 1 section) **plus** its own 6 bullets (CV 2 section) — 13 total — because the CV 2 section documents those 6 specifically under Vogue Vesture, not under ZDigitizing. Nothing is merged, moved, or suppressed; the wording overlap between the two employers' bullet lists is preserved as-is and is not treated as an error to fix (§5.5, §10.2, §23 notes the resulting visual repetition as a flagged editorial consideration, not a content decision left open). |
| 10 | Us Apparel — Merchandiser Fabric Sourcing | **Not mentioned at all** | Full entry, marked "Continue" (ongoing), 15 bullets | Include in full from the CV 2 section (§5.6); the CV 1 section's silence is noted, not treated as contradictory. |
| 11 | Nagina Group of Industries — Internship Student | **Not mentioned at all** | Full entry, no dates, yarn-sales/marketing internship bullets | **Resolved** — included as an actual earlier-experience entry (§5.10), visually secondary, no invented dates — displays as undated by design. |
| 12 | Freelancer — Freelancing (embroidery) | Full entry: "April 2021 — Present," 5 bullets | **Not mentioned at all** | Include from the CV 1 section (§5.5); the CV 2 section's silence is noted. |
| 13 | Education — Leads University entry | BBA (Arid University, CGPA 3.52, Marketing), FSc (Superior Group of Colleges, 60%), Matriculation (Universal Public High School, 80%) — no Leads University entry | Same three, **plus**: "Bachelor of Business Administrations(MBA Marketing Continue) • Leads University • Lahore — Last semester" | **Resolved 2026-09-16:** business owner directs this credential be published as **completed** — "MBA, Marketing — Leads University, Lahore" (the degree name used is the source's own parenthetical "MBA Marketing"; the source's literal leading label "Bachelor of Business Administrations" and its "Continue"/"Last semester" status wording are not reused on the public page, per §2.5's preservation-vs-publication split). The full literal source text is preserved here and in §10.2's `sourceTrace` for audit purposes. |
| 14 | Contact details | Address, phone, email present | Same address, same phone, same email | Identical across both — **none of it is published**; the site's existing `contactEmail`/`whatsappNumber` settings are used instead (§10.4, §15). |

**Disposition summary:** every row now has a settled disposition. Rows 2–5, 8, 12 are safe unions/
date-fills; rows 6, 10 are one-source-only employer entries (included in full, source-silence
noted); rows 1, 9, 11, 13 were the four items open at the end of Draft v3, and **all four are now
resolved** by explicit business-owner decision, applied throughout this revision. No row carries a
`[REQUIRES BUSINESS OWNER CONFIRMATION]` tag in this version of the spec.

### 2.5 Source preservation vs. public website — the governing distinction for this revision

Two different things must never be conflated, and every content decision in this document follows
this split:

- **Source preservation** (§2.4, §10.2's `sourceTrace` fields): *every* fact in `M.Suleman_CV.md` —
  including the residential address, personal phone/email, the literal ambiguous Leads University
  title text, and the raw wording overlap between ZDigitizing's and Vogue Vesture's bullets —
  remains fully documented and traceable in this specification. Nothing from the source is deleted
  from the record.
- **Public website content** (§5, and the `published`/public-facing fields in §10.2): only the
  subset of that preserved information that is appropriate for a public professional Portfolio page
  is actually rendered to customers. "Preserve all CV information" governs what this document
  records, not what the live page displays — home address, personal phone, personal email, and any
  "ongoing/unconfirmed" status wording are preserved in the record (§2.4) but **never** rendered on
  `/portfolio`.

## 3. Portfolio goals

1. Present M. Suleman Yaseen's real, documented professional background — embroidery digitizing
   and quality control as the dominant identity, textile sourcing/merchandising/internal audit as
   substantiated secondary expertise — as a premium, professionally designed page, not a CV pasted
   into HTML.
2. Ship that content pre-populated, so Admin's ongoing job is managing real portfolio media, not
   re-authoring biography/experience/education text.
3. Showcase real embroidery digitizing and vector-art capability through actual work samples,
   connected to the commercial funnel (Get a Quote / Custom Request).
4. Preserve every relevant fact from `M.Suleman_CV.md` in this specification (§2.4), while
   publishing only the subset appropriate for a public page (§2.5) — invent nothing either way.
5. Keep the page visually and structurally consistent with the rest of czdigitizing.com's design
   system — premium, clean, on-brand, not a generic resume template.
6. Protect personal privacy — no residential address, no personal phone/email published; any public
   contact point comes from the site's existing settings, never a hardcoded or CV-derived value.
7. Attribute every documented responsibility to the employer the source actually lists it under —
   never merge two employers into one, move a responsibility between them, or suppress one because
   it resembles another.

## 4. User experience

**Customer, desktop, first visit:** lands on `/portfolio` via the header "More" menu (unchanged
route) → **Hero / Professional Identity** (name, descriptor) → **Professional Profile** (the merged
narrative) → **Core Embroidery & Digitizing Expertise** (a synthesized capability summary, not a
bullet dump — see §5.3) → **Software Expertise** (Wilcom, Pulse Tajima front and center) →
**Professional Experience** (the full, per-employer attributed embroidery job timeline — ZDigitizing
and Vogue Vesture each shown with their own complete documented bullets, §5.5) → **Textile &
Sourcing Expertise** → **Internal Audit / Operational Expertise** → **Key Skills** → **Education**
(now including the completed MBA) → **Earlier / Additional Experience** (Nagina Group, visually
secondary) → **Real Portfolio Work Samples** (the actual admin-managed gallery) → **Professional
CTA** band, whose contact links resolve live from the site's existing WhatsApp/email settings.

**Customer, mobile:** same section order, responsive per §8.

**Admin:** logs into `/admin/portfolio` (unchanged URL) → sees the same existing table + inline
form, scoped explicitly to **real work-sample fields only**. No field anywhere in this admin screen
asks for CV/biography/experience/education/skills content, and no field asks for a Portfolio-
specific WhatsApp number or email — those already come from `/admin/settings/platform`, unchanged.

## 5. Page structure

**`/portfolio` (public, single page, existing route, redesigned) — final section order:**

1. **Hero / Professional Identity** — "M. Suleman Yaseen" as the published name, with a supporting
   descriptor grounded strictly in source wording: **"Embroidery Digitizer & Quality Control
   Specialist — Textile Sourcing Professional"** (drawn from the CV 1 section's "Digitizer
   (Embroidery Designer)"/"Quality Checker" titles and the CV 2 section's own self-description,
   "textile and sourcing professional"). Playfair headline, embroidery-machine visual. The page's
   primary sales CTA lives at the bottom (§5.12), not here.
2. **Professional Profile** — the merged profile paragraph (§10.2), embroidery-led with textile/
   sourcing background named as real, substantiated secondary experience.
3. **Core Embroidery & Digitizing Expertise** — a short, synthesized capability summary (a few
   sentences plus highlight chips — e.g. "Logo digitizing," "Complex pattern digitizing,"
   "Large-scale export production," "Embroidery quality inspection," "Customer-specification
   compliance") drawn from across the embroidery-related roles. This section deliberately does
   **not** repeat the full bullet lists — those live in full, per employer, in §5.5 — so the same
   content isn't shown twice on the page.
4. **Software Expertise** — Wilcom Embroidery Software and Pulse Tajima Embroidery Software given
   top, large-format billing (primary); Oracle ERP and Microsoft Excel/Word/PowerPoint listed as a
   smaller "also proficient in" line beneath (secondary) — one section, internally hierarchical.
5. **Professional Experience** — the full embroidery-related job timeline, each employer showing
   its complete, independently-documented responsibilities with no cross-employer suppression:
   - **Vogue Vesture — Embroidery Digitizer** (Mar 2019–Feb 2022, §2.4 row 7/8): all 7 bullets from
     the CV 1 section's Vogue Vesture entry **plus** all 6 bullets from the CV 2 section's Vogue
     Vesture entry (13 total, §2.4 row 9).
   - **ZDigitizing — Quality Checker** (Apr 2021–Present, §2.4 row 6, CV 1 section only): all 8
     documented bullets, including the "improving output accuracy by 20%" stat.
   - **Freelance — Freelance Embroidery Digitizer** (Apr 2021–Present, §2.4 row 12, CV 1 section
     only): all 5 documented bullets.

   Per §2.4 row 9's resolution, several bullets read very similarly between the Vogue Vesture and
   ZDigitizing entries — this is shown as-is, not hidden or reconciled, because the source documents
   them separately under each employer.
6. **Textile & Sourcing Expertise** — the Us Apparel role in full (§2.4 row 10): fabric sourcing,
   purchase-order/vendor/LC coordination, ERP-based documentation, sample development — secondary
   but real, substantiated, presented in full.
7. **Internal Audit / Operational Expertise** — the Cross Stitch role (§2.4 rows 4–5, combined
   bullet set, dates from the CV 1 section), presented as secondary expertise reinforcing the same
   quality-control discipline the embroidery QC content already demonstrates.
8. **Key Skills** — the 7-item union list (§2.4 row 2).
9. **Education** — BBA (Arid University), FSc, Matriculation, **and** MBA, Marketing (Leads
   University, Lahore) presented as a completed credential — no "ongoing"/"continue"/"last
   semester" language anywhere on the public page (§2.4 row 13, §2.5).
10. **Earlier Experience / Additional Experience** — the Nagina Group of Industries internship
    (§2.4 row 11), rendered with visibly smaller/lighter typographic treatment than §5.5's
    Professional Experience timeline, explicitly marked **undated** rather than assigned invented
    dates.
11. **Real Portfolio Work Samples** — the actual admin-managed gallery: category filter + grid of
    real, published `PortfolioItem` rows (unchanged concept/data source from prior drafts). This is
    the **only** admin-authored section on the page. If no work samples are published yet, the
    existing "No portfolio items yet." empty state is shown — never a stock/fake substitute (§9).
12. **Professional CTA** — Get a Quote / Custom Request / WhatsApp/email, with the WhatsApp and
    email links built live from `GET /api/settings/public`'s `whatsappNumber`/`contactEmail`
    (§10.4) — the same source `Footer.tsx` already reads, never a hardcoded or CV-derived value.

**`/portfolio/:id` (public, existing route, unchanged):** one real work sample's detail view —
title, category, description, image roles, technical metadata. Carries no CV/biography content.

**`/admin/portfolio` (existing route, extended per §11):** unchanged shape — table + inline form
for real work samples only.

No new top-level routes. `/about` and `/testimonials` remain untouched (§20).

## 6. Component structure

Unchanged in shape from prior drafts for the work-sample side
(`apps/web/components/portfolio/{PortfolioHero,PortfolioCategoryFilter,PortfolioCard,
PortfolioLightbox,PortfolioDetail}.tsx`, reusing `Hero.tsx`/`DesignCard.tsx` patterns). CV-content
components, matching §5's structure:

| Component | Renders | Data source | Notes |
|---|---|---|---|
| `PortfolioIdentityHero.tsx` | §5.1 | Static (§10.2) | — |
| `PortfolioProfile.tsx` | §5.2 | Static (§10.2) | — |
| `PortfolioCoreExpertise.tsx` | §5.3 | Static (§10.2) | Synthesized summary, not full bullets |
| `PortfolioSoftwareExpertise.tsx` | §5.4 | Static (§10.2) | Primary/secondary tools, one section |
| `PortfolioExperience.tsx` | §5.5 | Static (§10.2) | Renders each employer's full, independently-attributed bullet list — no cross-employer dedup logic |
| `PortfolioTextileExpertise.tsx` | §5.6 | Static (§10.2) | Secondary weight |
| `PortfolioAuditExpertise.tsx` | §5.7 | Static (§10.2) | Secondary weight |
| `PortfolioSkills.tsx` | §5.8 | Static (§10.2) | — |
| `PortfolioEducation.tsx` | §5.9 | Static (§10.2) | Leads University shown as completed |
| `PortfolioAdditionalExperience.tsx` | §5.10 | Static (§10.2) | Secondary, visually condensed |
| `PortfolioCard.tsx` / `PortfolioLightbox.tsx` / `PortfolioDetail.tsx` | §5.11 | `GET /api/portfolio` — existing admin-managed API | Unchanged |
| `PortfolioCta.tsx` | §5.12 | `GET /api/settings/public` (existing endpoint, §10.4) | **Not** static — the one CV-content-adjacent component that must fetch, because contact info must stay live |

CV-content components (all except `PortfolioCta.tsx`) read only from static content; no admin form
anywhere accepts CV text. `PortfolioCta.tsx` is the sole exception to "static," and it reads from an
**existing** endpoint already used elsewhere in the app, not a new one.

## 7. Design requirements

Unchanged design-token base from prior drafts (`font-display`/Montserrat, navy/gold-only saturation
with gold reserved for one primary CTA, `rounded-card`/`rounded-field`/`shadow-cz-*`,
`DesignCard.tsx`/`Hero.tsx` treatments, logo never redrawn).

Unchanged hierarchy requirement: embroidery/digitizing content (§5.3–§5.5) must be **visually
dominant** — larger type scale, first position, more generous spacing — while textile/sourcing and
internal-audit content (§5.6–§5.7, §5.10) is **present in full, never trimmed for space**, but
rendered at a visibly secondary scale.

**New note for this revision:** §5.5's Professional Experience section now carries more raw text
than earlier drafts assumed (13 bullets under Vogue Vesture, 8 under ZDigitizing, several
near-duplicated in wording per §2.4 row 9). This section should use a genuinely premium
timeline/card treatment (generous whitespace, one employer per card, collapsed/expandable detail if
needed on mobile) rather than a dense bullet dump, so the page still reads as edited and
professional rather than as two resumes stapled together — a layout requirement, not a content
change (§23 flags this as worth extra design attention).

## 8. Responsive behavior

Unchanged mechanism from prior drafts. Applies to the reordered CV-content sections: each section
stacks to single-column on mobile in the same §5 order; the primary/secondary visual-weight
distinction (§7) is preserved at every breakpoint; §5.5's now-longer per-employer bullet lists
should collapse/expand on mobile rather than force excessive scrolling (§7's new note).

## 9. Image requirements

Unchanged from prior drafts (formats/limits, aspect-ratio consistency, `object-fit` rules, multiple
image roles per work sample, no stock imagery, required alt text) — applies only to real work-sample
images (§5.11). If no real work-sample images exist yet, the existing empty state is used — never a
stock photo presented as real work (§9 restated per this revision's explicit "no fake work"
instruction).

## 10. Portfolio data model proposal

### 10.1 Work-sample data (extends `PortfolioItem`) — unchanged from prior drafts

Same additive field set: `isFeatured`, `originalArtworkUrl`, `embroideryResultUrl`,
`closeUpImageUrl`, `beforeImageUrl`/`afterImageUrl`, `softwareUsed[]`, `embroideryType`,
`stitchCount`, `sizeLabel`, `machineFormat`, `projectNotes`, `altText`, plus existing
`title`/`description`/`category`/`mediaUrls`/`sortOrder`/`isPublished`. Category values reuse the
real Services taxonomy. This remains the **only** part of the data model an admin form writes to.

### 10.2 CV/professional-profile data — static content, updated for this revision

Proposed as a static, versioned content module (e.g. `apps/web/lib/portfolio-profile-content.ts`):

```
identity: {
  name: "M. Suleman Yaseen",
  descriptor: "Embroidery Digitizer & Quality Control Specialist — Textile Sourcing Professional",
},

profile: {
  text: "M. Suleman Yaseen is an embroidery digitizing and quality-control professional with a
    diverse background in embroidery logo design, specializing in Wilcom Embroidery Software and
    Pulse Tajima Embroidery Software to produce high-quality, intricate embroidery designs that
    meet and exceed client expectations. Alongside this embroidery-focused expertise, he brings
    additional professional experience in textile and fabric sourcing, vendor and mill
    coordination, and supply chain operations in the apparel industry — skilled in purchase order
    management, sample development, inventory control, ERP systems, and documentation management,
    with a proven ability to coordinate across sourcing, merchandising, warehouse, and finance
    teams.",
  sourceTrace: "Sentence 1 merges the CV 1 section's Profile; sentence 2 merges the CV 2 section's
    Profile. No added claims. §2.4 row 1.",
},

coreEmbroideryExpertise: {
  summary: "Short, synthesized capability summary — not a bullet reproduction; full attributed
    detail lives in `experience` below.",
  highlights: ["Logo digitizing", "Complex pattern digitizing", "Large-scale export production",
    "Embroidery quality inspection", "Customer-specification compliance"],
},

softwareExpertise: {
  primary: ["Wilcom Embroidery Software", "Pulse Tajima Embroidery Software"],
  secondary: ["Oracle ERP", "Microsoft Excel", "Microsoft Word", "Microsoft PowerPoint"],
},

experience: [
  {
    employer: "Vogue Vesture", title: "Embroidery Digitizer", dates: "March 2019 – February 2022",
    bullets: [ /* CV 1 section's 7 Vogue Vesture bullets + CV 2 section's 6 Vogue Vesture bullets
                 — 13 total, verbatim, §2.4 row 9 */ ],
    sourceTrace: "Title: CV 1 section says 'Digitizer (Embroidery Designer)', CV 2 section says
      'Embroidery Digitizer' (used here). Dates: CV 1 section only. Bullets: union of both
      sections' own Vogue Vesture entries — retained independently per business-owner decision,
      §2.4 row 9. Some bullets read similarly to ZDigitizing's below; both are shown in full,
      per-source, not merged or suppressed.",
  },
  {
    employer: "ZDigitizing", title: "Quality Checker", dates: "April 2021 – Present",
    bullets: [ /* all 8 CV 1 section bullets, verbatim, incl. the 20%-accuracy stat */ ],
    sourceTrace: "CV 1 section only; the CV 2 section does not mention this employer. §2.4 row 6.",
  },
  {
    employer: "Freelance", title: "Freelance Embroidery Digitizer", dates: "April 2021 – Present",
    bullets: [ /* all 5 CV 1 section bullets */ ],
    sourceTrace: "CV 1 section only; the CV 2 section does not mention this. §2.4 row 12.",
  },
],

textileSourcingExpertise: {
  employer: "Us Apparel", title: "Merchandiser, Fabric Sourcing", dates: "Ongoing (source: \"Continue\")",
  bullets: [ /* full Us Apparel bullet set, §2.4 row 10 */ ],
  sourceTrace: "CV 2 section only; the CV 1 section does not mention this employer.",
},

auditExpertise: {
  employer: "Cross Stitch", title: "Internal Audit Officer", dates: "June 2024 – Present",
  bullets: [ /* union of the CV 1 section's 5 + CV 2 section's 15 bullets, §2.4 rows 4,5 */ ],
},

keySkills: [ /* 7-item union, §2.4 row 2 */ ],

education: {
  published: [
    { credential: "Bachelor of Business Administration (BBA), Marketing", institution: "Arid University of Rawalpindi", detail: "CGPA 3.52" },
    { credential: "FSc, Intermediate in Engineering", institution: "Superior Group of Colleges, Lahore", detail: "60%" },
    { credential: "Matriculation, Science", institution: "Universal Public High School, Lahore", detail: "80%" },
    { credential: "MBA, Marketing", institution: "Leads University, Lahore", detail: "Completed",
      sourceTrace: "Source text (CV 2 section only) reads 'Bachelor of Business
        Administrations(MBA Marketing Continue) • Leads University • Lahore • Last semester' —
        internally ambiguous between BBA-continuation and MBA. Published per business-owner
        decision using the source's own parenthetical degree name ('MBA Marketing') and presented
        as completed; the literal 'Continue'/'Last semester' source wording is not reused publicly
        (§2.5). §2.4 row 13." },
  ],
},

additionalExperience: [
  { employer: "Nagina Group of Industries", title: "Internship Student",
    dates: "Dates not available in source — displayed undated, not invented",
    bullets: [ /* yarn-sales/marketing internship bullets, §2.4 row 11 */ ], visualWeight: "secondary" },
],

activities: [ /* 3-item union, §2.4 row 3 */ ],
```

This is a content shape proposal, not final production code. Every `sourceTrace` is what keeps the
eventual implementation auditable against §2.4 without re-reading the raw CV file.

### 10.3 No schema/migration change for CV content

Unchanged: §10.2 is static content — no Prisma migration, no new table, no new API route for the
professional-background sections. Only §10.1's additive `PortfolioItem` migration is required.

### 10.4 Contact information — reuse the existing platform settings, never hardcode (new in this revision)

- **Email:** the Portfolio's CTA (§5.12) uses `GET /api/settings/public`'s `contactEmail` field —
  the same official CZ Digitizing contact email already configured in `PlatformSettings` and
  already rendered by `Footer.tsx`. No CV-derived personal email is ever used, and no second,
  Portfolio-specific email field is introduced.
- **WhatsApp:** the Portfolio's CTA uses the same endpoint's `whatsappNumber` field, built into a
  `https://wa.me/...` link exactly the way `Footer.tsx` already does. This is a **live read**, not
  a copy — if Admin changes the number at `/admin/settings/platform`, the Portfolio's WhatsApp link
  reflects the new number automatically, with no separate Portfolio setting to keep in sync and no
  Portfolio-side hardcoding anywhere.
- **No new settings, no new admin screen, no new API route** are needed for this — `PlatformSettings`
  and `GET /api/settings/public` already exist and already serve exactly this purpose for the rest
  of the site. This is a data-source/integration requirement only, satisfied by reusing what already
  exists; **no implementation happens in this specification pass** (per the governing instruction
  for this task).

## 11. Admin management proposal

**A. Required functionality** — unchanged: add/edit/delete a real work sample (title, description,
category, images-with-roles, technical metadata, featured flag, published state), publish/unpublish,
reorder, upload/manage real portfolio images.

**Explicitly NOT required, and not to be added:** any admin field, screen, or action for entering or
editing the profile paragraph, expertise-section text, software expertise, key skills, education, or
activities/interests — all pre-populated per §10.2. Also explicitly not added: any Portfolio-specific
WhatsApp number or contact-email field — both come from the existing `/admin/settings/platform`
screen, unchanged by this feature (§10.4).

**B. Optional functionality** — unchanged: preview-before-publish, drag-and-drop reorder, FK-linked
category, separate create/edit routes.

**C. Future functionality** — unchanged: bulk import/export, analytics, before/after slider, mobile-
app screen, and (still available if ever wanted) a read-only/editable admin view of the CV-derived
content for future text edits without a code deploy.

## 12. Routing proposal

Unchanged — no new routes, reuse `/portfolio`, `/portfolio/[id]`, `/admin/portfolio`, and the
existing nav entries in `Header.tsx`/`Sidebar.tsx` exactly as they are today.

## 13. SEO requirements

Unchanged mechanism from prior drafts (title, meta description, alt text, heading hierarchy, the
`generateMetadata` dependency gap). The meta description is written from §10.2's merged profile
text.

## 14. Accessibility requirements

Unchanged from prior drafts (alt text, real interactive elements, keyboard support, visible gold
focus ring, single `<h1>`/ordered heading hierarchy per §5's actual section order, reduced-motion
respect, semantic lists for bullet/education content). §5.5's now-longer per-employer bullet lists,
if implemented as expandable/collapsible on mobile (§7, §8), must use a real
`<button aria-expanded>` control, not a bare `<div onClick>`.

## 15. Privacy/security requirements

- **Never publish the residential address** from `M.Suleman_CV.md` ("Firdos Park Mast Iqbal Road,
  House No E-141-27 D-1, Lahore Cant") — identical in both source sections, excluded from every
  section in §5, preserved only in §2.4's traceability record (§2.5).
- **Never publish the CV's personal phone or personal email** (`+923174604508` / `03174604508`,
  `m.sulemanyassen123@gmail.com`) anywhere on the Portfolio page.
- **Contact information is never hardcoded.** Where the Portfolio needs an email or WhatsApp
  contact point (§5.12), it reads live from `GET /api/settings/public` — the site's existing,
  Admin-configured `contactEmail`/`whatsappNumber` — exactly as `Footer.tsx` already does (§10.4).
  This is both a privacy requirement (no personal CV contact info leaks in) and a maintenance
  requirement (one source of truth, no drift between Portfolio and the rest of the site).
- **Full name is published** ("M. Suleman Yaseen," §5.1) per explicit business-owner decision — this
  is professional attribution, not private information.
- **No invented employers, clients, certifications, statistics, dates, or qualifications** —
  everything in §5 traces to a specific §2.4 row. The one concrete CV-stated metric ("improving
  output accuracy by 20%") is used verbatim with its ZDigitizing-entry provenance preserved.
- **The Leads University credential publishes as completed** (§2.4 row 13, §2.5) — the source's own
  "Continue"/"Last semester" wording is preserved in the traceability record but not published, per
  business-owner decision; this is a preservation-vs-publication distinction (§2.5), not an
  invented fact, since the degree name itself ("MBA Marketing") comes directly from the source.
- **Employer attribution is never suppressed or merged for privacy or tidiness reasons** — per §2.4
  row 9, both ZDigitizing and Vogue Vesture publish their own full, independently documented
  responsibilities, even where the wording is very similar.
- **No client PII** anywhere — none of the CV content names a specific client, and the existing
  work-sample `projectNotes` field (§10.1) remains admin-only/internal.
- **Education/employer institution names are not private information** and are published as
  professional background (Arid University of Rawalpindi, Superior Group of Colleges, Universal
  Public High School, Leads University; ZDigitizing, Vogue Vesture, Us Apparel, Cross Stitch,
  Nagina Group of Industries).
- Role/permission model unchanged (`@RequiresPermission('portfolio','crud')`), including the
  pre-existing image-upload permission gap noted in prior drafts, still unfixed by this spec.

## 16. Existing assets that can be reused

Unchanged from prior drafts (`hero-embroidery-machine.png`, brand-kit `photo-*.png` set, service
category illustrations, `Hero.tsx`/`DesignCard.tsx`/`Logo.tsx` components, admin `Card`/`Button`/
`Badge`/`FormField`, the existing `PortfolioItem` model/API/CRUD/nav wiring, the shared image-upload
pipeline), **plus, new to this revision: the existing `PlatformSettings`/`GET /api/settings/public`
mechanism (§2.1, §10.4) — the exact contact-info source to reuse, not rebuild.**

## 17. Assets that are missing

Unchanged from prior drafts (no real completed-project photography exists in the repo; the only
embroidery-machine photo is a low-resolution 354×110 crop; no category icon set; no professional
headshot — optional, business owner may supply one for §5.1's Hero).

## 18. Required vs optional functionality

**Required:** §10.1's work-sample fields (migrated additively); public `/portfolio`/`/portfolio/
[id]` rebuilt to the real design system; the full §5 section order (all 12 sections) rendered from
static content per §10.2; §5.5's per-employer, non-suppressed responsibility lists; §5.9's completed
MBA entry; §5.12's live-sourced (not hardcoded) contact links (§10.4); category filter bound to the
real Services taxonomy; alt text on every work-sample image; the primary/secondary visual-hierarchy
rule (§7) applied consistently; the real-work-only empty state (§9) when no work samples are
published.

**Optional:** preview-before-publish, drag-and-drop admin reorder, FK-linked category, separate
admin routes, slug-based detail URLs, a professional headshot image, expandable/collapsible
per-employer bullet lists on mobile (§7's suggested treatment for §5.5's longer lists).

**Future:** a read-only/editable admin view of the CV-derived content; per-mobile-app portfolio
screen; analytics; interactive before/after slider; bulk import/export.

## 19. Files/components likely to be created later

Unchanged core list from prior drafts (Prisma migration, DTO/shared-type updates, extended admin
form, rewritten public pages, extended integration/e2e coverage), plus the components from §6
(`PortfolioIdentityHero`, `PortfolioProfile`, `PortfolioCoreExpertise`, `PortfolioSoftwareExpertise`,
`PortfolioExperience`, `PortfolioTextileExpertise`, `PortfolioAuditExpertise`, `PortfolioSkills`,
`PortfolioEducation`, `PortfolioAdditionalExperience`, `PortfolioCta`) and the static content module
`apps/web/lib/portfolio-profile-content.ts` (§10.2). `PortfolioCta.tsx` will call the existing
`GET /api/settings/public` client already used by `Footer.tsx` — no new API client code expected.

## 20. Files that MUST NOT be modified

Unchanged in full: payment/checkout/order code, authentication code, Taebo (`TaeboWidget.tsx`,
`TaeboPanda.tsx`, `apps/api/src/taebo/**`), `Logo.tsx`/logo assets, the `about_content`/
`Testimonial` models and pages, `docs/specs/SPEC_INDEX.md` / `CZ_DIGITIZING_ARCHITECTURE.md` / the
SRS file, `apps/web/components/Footer.tsx` and the `PlatformSettings`/`/api/settings/public`
mechanism itself (this spec reuses it as a read-only consumer, same as `Footer.tsx` already is — it
does not propose changing it), navigation (`Header.tsx`/`Sidebar.tsx`'s existing entries, read-only
references), and any other feature module's admin pages/routes/nav. Also unchanged: this document
does not modify or delete `M.Suleman_CV.md` — it remains the read-only source record.

## 21. Implementation phases

Unchanged sequencing (data model → admin extension → public rebuild → CV content sections →
preview/polish → verification), with phase 4 now fully scoped by §5/§10.2 — no open content
decisions remain to block it, and phase 3 (public rebuild) now explicitly includes wiring
`PortfolioCta.tsx` to the existing settings endpoint rather than a placeholder value.

## 22. Acceptance criteria

Unchanged AC-1–AC-11 from prior drafts (work-sample gallery, category filtering, image-role display,
lightbox navigation, accessibility, responsive behavior, admin CRUD scope, immediate
publish-reflect, alt-text enforcement) still apply. Updated/new criteria for this revision:

| # | Criterion |
|---|---|
| AC-12 | Given a customer visits `/portfolio`, the page renders all 12 §5 sections in order, with embroidery/digitizing content (§5.3–§5.5) visually dominant and textile/sourcing/audit content (§5.6–§5.7, §5.10) fully present but visibly secondary in scale. |
| AC-13 | Given the admin Portfolio screen, no field accepts biography, experience, education, skills, software-expertise, or contact-info text — its fields match exactly §10.1's work-sample metadata. |
| AC-14 | Given any fact rendered in the CV-content sections, it traces to a specific §2.4 row — no invented employer, client, statistic, certification, date, or qualification appears anywhere on the page. |
| AC-15 | Given the page publishes, the Hero identifies the person as "M. Suleman Yaseen"; no residential address and no personal phone/email from `M.Suleman_CV.md` appears anywhere in the rendered HTML. |
| AC-16 | Given §5.5's Professional Experience section, ZDigitizing and Vogue Vesture each display their own complete, independently documented responsibilities — none suppressed, merged, or reassigned to the other employer, even where wording is near-identical. |
| AC-17 | Given the public Education section (§5.9), the Leads University MBA (Marketing) entry appears and is presented as completed — no "ongoing," "continue," or "last semester" wording anywhere on the public page. |
| AC-18 | Given the Earlier/Additional Experience section (§5.10), the Nagina Group entry appears with no invented dates and with visibly lighter/smaller treatment than the Professional Experience section (§5.5). |
| AC-19 | Given the Professional CTA (§5.12), its email and WhatsApp links resolve to whatever `GET /api/settings/public` currently returns for `contactEmail`/`whatsappNumber` — changing those values in `/admin/settings/platform` changes the Portfolio's contact links with no code change and no separate Portfolio setting involved. |
| AC-20 | Given no real work samples are published yet, the Real Portfolio Work Samples section (§5.11) shows the existing empty state — never a stock image or invented project presented as real work. |

## 23. Risks and edge cases

**Resolved by business-owner decision — no `[REQUIRES BUSINESS OWNER CONFIRMATION]` items remain
for CV content as of this revision:**

- Merged profile content and embroidery-primary/textile-secondary hierarchy (§2.4 row 1, §10.2).
- Nagina Group internship inclusion, undated, visually secondary (§2.4 row 11, §5.10).
- Public name and descriptor: "M. Suleman Yaseen" (§5.1, §15).
- Overall section structure and 12-item page order (§5).
- Leads University MBA (Marketing) published as completed (§2.4 row 13, §5.9, §10.2).
- ZDigitizing/Vogue Vesture responsibility overlap: both retained in full, independently, under
  their own employer — no suppression, merge, or reassignment (§2.4 row 9, §5.5, §10.2).
- Contact information: always live from existing `PlatformSettings`/`GET /api/settings/public`,
  never hardcoded, never a second Portfolio-specific setting (§10.4, §15).

**Editorial consideration flagged, not a content decision left open:** §5.5's Professional
Experience section now legitimately contains a lot of near-duplicated wording between the Vogue
Vesture and ZDigitizing entries, because the source itself documents overlapping responsibilities
under both employers and the business owner has directed that both be shown in full. This is a
**design/layout challenge** (§7's "premium timeline treatment" note, §8's collapsible-on-mobile
suggestion) to keep the page reading as curated rather than repetitive — it is not a content
decision this spec leaves unresolved.

**Carried over from prior drafts, still open (technical/platform, not content):** the pre-existing
`POST /api/uploads/images` permission-scope gap (`'designs','crud'` instead of `'portfolio','crud'`);
the stale-looking `Completed` registry status for A-012f vs. the real gap this spec addresses;
missing real project photography; the low-resolution hero asset; the `generateMetadata` SEO
dependency (net-new to `apps/web`); category-taxonomy drift risk if `/services`' list changes later;
the numeric-ID (`/portfolio/:id`) route's shareability.

---

**IMPLEMENTATION MUST NOT START UNTIL THIS SPECIFICATION HAS BEEN REVIEWED AND APPROVED.**
