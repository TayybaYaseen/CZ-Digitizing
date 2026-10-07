# Customer Review Submission & Admin Moderation (A-026)

> **SPECIFICATION:** CREATED (2026-10-06)
> **APPROVAL:** APPROVED by the Primary Admin (2026-10-06), with every recommended option D1–D10, before any code was written
> **IMPLEMENTATION:** COMPLETED (2026-10-06)

## Trigger

The Primary Admin asked on 2026-10-06 to *"extend the existing CZ Digitizing Reviews/Testimonials
system"* so that customers can submit reviews with an optional image and Admin can moderate, manage,
hide, remove, approve and publish them. They asked for this without replacing the existing system and
under a spec-first, approval-gated workflow. Inspection showed a basic customer path already existed
(A-012c AC-7), so this extends it rather than adding a parallel system. The Admin approved the spec
with "yes".

## Spec used

[`docs/specs/2026-10-06-22-customer-review-submission.md`](../specs/2026-10-06-22-customer-review-submission.md),
aspect **A-026** (AC-1–AC-29), registered in [`SPEC_INDEX.md`](../specs/SPEC_INDEX.md) at Order 54.
Spec §32 lists the non-material implementation notes.

## Files changed

### API (`apps/api`)

| File | Change |
|---|---|
| `prisma/schema.prisma` | `Testimonial`: `country` becomes nullable; adds `customRequestId` (FK), `originalFeedback`, and `imageStoragePath`/`imageContentType`/`imageOriginalFilename`. `CustomRequest.testimonials` back-relation. `NotificationType.review_submitted`. |
| `prisma/migrations/20261006180000_customer_review_submission/migration.sql` | Generated DDL plus backfills (`'Not specified'` → NULL; unpublish any published-but-unapproved row) and CHECKs: published ⇒ approved, image columns set together, at most one link. |
| `package.json`, `pnpm-lock.yaml` | `sharp@^0.35.5` (D2). |
| `src/testimonials/testimonials.service.ts` | Public list narrowed to `PublicTestimonialDto`. Eligibility (paid non-refunded order or delivered custom request). Submit with one-per-item, duplicate-text and 3-pending checks. Display name never falls back to email. §10 transitions (moderate, visibility). Image replace/remove, withdraw, `review_submitted` admin notification. |
| `src/testimonials/testimonials.controller.ts` | New routes: `mine/eligibility`, `mine`, `mine/:id/image`, `DELETE mine/:id`, `admin/:id/image`, public `:id/image`, `PUT :id/visibility`, `PUT/DELETE :id/image`. `submit` accepts multipart with an optional `image` and is rate-limited (5/min/IP). Image responses carry nosniff and sandbox CSP. |
| `src/testimonials/review-image.service.ts` | The §8 pipeline: size cap, magic bytes, sharp decode with pixel cap, auto-rotate, ≤ 2000 px WebP with metadata stripped, private namespaced storage, unreferenced-file cleanup. |
| `src/testimonials/review-text.util.ts`, `testimonials.constants.ts` | Text cleaning, duplicate normalization, status derivation; limits. |
| `src/testimonials/dto/testimonial-write.dto.ts`, `dto/testimonial.dto.ts` | Customer DTO (multipart-aware, cleaned, §19 limits), visibility DTO, edit limits; public, admin and "mine" mappers. |
| `src/testimonials/testimonials.module.ts` | Imports `FilesModule`; provides `ReviewImageService`. |
| `src/common/files/image-type.util.ts` (new), `src/orders/receipt-file-type.util.ts` | Shared JPEG/PNG/WebP magic-byte detection, also used by receipts. |
| `src/files/storage.service.ts` | `saveInNamespace()` (`review-images/` subdirectory). |
| `src/common/filters/all-exceptions.filter.ts` | A bare 413 (multer size limit) now maps to `FILE_TOO_LARGE` instead of `INTERNAL_ERROR`. |
| `src/notifications/notifications.constants.ts` | `review_submitted` channels (email + in-app), admin-only. |
| `src/testimonials/testimonials.service.spec.ts`, `review-image.service.spec.ts` | Unit tests (rewritten/new). |
| `test/integration/testimonials.spec.ts` (new), `test/integration/content-knowledge-base.spec.ts` | 13 new integration tests; two A-012 AC-7 tests updated to the approved D1 rules. |

### Shared types (`packages/shared-types`)

| File | Change |
|---|---|
| `src/content.ts` | `TestimonialStatus`, `PublicTestimonialDto`, `AdminTestimonialDto` (`TestimonialDto` kept as an alias), `MyTestimonialDto`, `ReviewEligibilityDto`, `REVIEW_LIMITS`. |
| `src/api.ts`, `src/notifications.ts` | New error codes; `review_submitted`. |

### Web (`apps/web`)

| File | Change |
|---|---|
| `app/testimonials/write/page.tsx` (new) | Write a Review: guest, not-eligible and pending-limit states; the form with profile prefill, optional link, star input, counter, photo preview/remove/change, inline validation and the confirmation panel. |
| `app/account/reviews/page.tsx` (new) | My Reviews: status, owner-only thumbnail, admin-edit note with the original text, withdraw. |
| `app/testimonials/page.tsx`, `components/HomeTestimonials.tsx` | Write a Review CTA, "No reviews yet" empty state, "Share your experience" link. |
| `components/TestimonialCard.tsx` | Public DTO, customer photo with viewer, month/year, optional country. |
| `app/account/orders/page.tsx` | The inline review form is replaced by a link to the form, shown on every fully paid order. |
| `app/account/page.tsx`, `components/AccountMenu.tsx` | My Reviews links. |
| `i18n/messages/*.ts` (15 locales), `i18n/api-errors.ts` | `reviews.*` namespace, 5 API error strings, updated `orderNotReviewable`, 5 dead keys removed. |

### Admin (`apps/admin`)

| File | Change |
|---|---|
| `app/testimonials/page.tsx` | One moderation list for both sources with tabs and counts, source filter, search, `?status=` in the URL. Per-review approve/reject/hide/unhide/edit (original text shown)/delete with confirmation. Authenticated image view, replace and remove. The create form and AC-5 warning are unchanged. |
| `lib/notification-link.ts` | `review_submitted` → `/testimonials?status=pending`. |

### Docs

`docs/specs/2026-10-06-22-customer-review-submission.md` (new), `docs/specs/SPEC_INDEX.md`,
`docs/specs/USER_FLOW.md`, this file and the `README.md` index.

## Verification

- API unit suite 539/539. Integration: `testimonials.spec.ts` 13/13 and `content-knowledge-base.spec.ts`
  8/8, each on a freshly created throwaway DB (dropped afterwards).
- Typecheck clean for api, web, admin, mobile and shared-types. Lint clean (2 existing web warnings in
  `TaeboPanda.tsx`). Web `i18n:check` passes for 15 locales.
- Live Playwright pass on an isolated stack (API :4100, web :3100, admin :3102, Redis db 5, throwaway DB,
  copies of web/admin so the running dev servers' `.next` was untouched). Every customer, admin, public,
  security, i18n (Arabic and Urdu RTL) and mobile check passed (iPhone 13, Pixel 7, 360 px, 768 px), with
  no page or console errors. One exception: the admin list at 360 px. The existing non-responsive admin
  shell (A-025 §38) leaves under ~100 px, so a status badge overflows by about 11 px.
- The migration was applied to the local dev DB `czdigitizing` so the running dev API keeps working (0 rows
  touched by the backfills). Run `prisma migrate deploy` on every other environment.
- **Not verified here:** native-speaker review of the 14 translations; deployment-target installation of
  `sharp` (prebuilt binaries exist for Linux x64).
