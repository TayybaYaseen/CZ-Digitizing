# Spec: Customer Review Submission & Admin Moderation

**File:** `docs/specs/2026-10-06-22-customer-review-submission.md`
**Aspect ID:** A-026 (see [`SPEC_INDEX.md`](SPEC_INDEX.md) § Aspect Registry)
**Status:** Implemented

> **SPECIFICATION:** CREATED (2026-10-06)
> **IMPLEMENTATION:** COMPLETED (2026-10-06). See §32 for implementation notes and verification
> **APPROVAL:** APPROVED by the Primary Admin, 2026-10-06, with every recommended option in Appendix B (D1–D10)
>
> Approved before any code was written.

**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Extends:** [Content & Knowledge Base spec](2026-08-28-10-content-knowledge-base.md) — A-012c Testimonials, AC-4 to AC-7
**Related:** [Auth spec](2026-08-28-01-auth-account-security.md), [Notifications spec](2026-08-28-02-notifications-system.md),
[Private file management spec](2026-08-28-05-private-file-management.md), [Orders & payment spec](2026-08-28-08-orders-payment-processing.md),
[Custom design requests spec](2026-08-28-12-custom-design-requests.md), [Customer account spec](2026-08-28-14-customer-account-history.md),
[i18n spec](2026-08-28-16-internationalization.md), [`docs/i18n.md`](../i18n.md)

---

## Contents

1. Feature name and ID · 2. Objective · 3. What exists today (inspection findings) · 4. Scope ·
5. Out of scope · 6. Who can submit (authentication and eligibility) · 7. Customer review form ·
8. Optional image upload · 9. Image preview · 10. Review statuses · 11. Admin review management ·
12. Hide vs delete · 13. Admin moderation queue · 14. Public display · 15. Existing admin-created
testimonials · 16. Admin editing · 17. Customer confirmation · 18. Duplicate and spam protection ·
19. Validation · 20. Notifications · 21. My Reviews · 22. Internationalization · 23. Mobile and
responsive behavior · 24. Security · 25. Database changes · 26. API · 27. Error codes · 28. Testing ·
29. Acceptance criteria · 30. Dependencies · 31. Risks · 32. Implementation notes · Appendix A: files inspected · Appendix B:
decisions requiring approval

---

## 1. Feature name and ID

- **Name:** Customer Review Submission & Admin Moderation. Customer-facing CTA: **"Write a Review"**
  (page heading: **"Share Your Experience"**). Admin location: **Admin → Testimonials** (existing page,
  extended).
- **Aspect:** `A-026`, the next free ID (A-001 to A-025 are taken; IDs are never renumbered).
- **Spec file number:** `22`, the next number after `2026-10-06-21-customer-admin-live-chat.md`.
- **Parent aspect:** A-012c (Testimonials). This spec extends A-012c's AC-7; it does not replace it.

## 2. Objective

Let signed-in customers write a review from the website, with an optional photo, and give Admin a
real moderation queue to approve, hide, reject, edit, or delete those reviews. Only reviews that Admin
has approved and published appear on the public website. Admin-created testimonials keep working
exactly as they do today.

## 3. What exists today (inspection findings)

The codebase was inspected before this spec was written (file list in Appendix A). **The system is
not admin-only.** A basic customer submission path already exists.

| # | Question | Finding |
|---|---|---|
| 1 | How are reviews created? | Two paths, one table (`testimonials`). Admin: `POST /api/testimonials` from `apps/admin/app/testimonials/page.tsx`, saved as `source=admin_curated`, `moderationStatus=approved`. Customer: `POST /api/testimonials/submit` (A-012c AC-7), saved as `source=customer_submitted`, `moderationStatus=pending`, `isPublished=false`. |
| 2 | Can customers submit? | **Yes, in a limited way.** The only entry point is a small "Leave a review" form on `/account/orders` (`ReviewButton` in `apps/web/app/account/orders/page.tsx`). It appears only on orders with `status=completed`, and the form has rating, service used and feedback fields. There is no "Write a Review" CTA on the testimonials page or home page. |
| 3 | Admin-only creation? | No. See rows 1 and 2. |
| 4 | Storage | Prisma model `Testimonial` → table `testimonials` (`apps/api/prisma/schema.prisma`). Fields: `customerName`, `country` (required), `business?`, `photoUrl?`, `rating` (1–5, required), `feedback`, `serviceUsed`, `isPublished`, `source`, `moderationStatus`, `customerId?`, `orderId?`, `createdByAdminId?`, `createdAt`, `updatedAt`. |
| 5 | Public display | `GET /api/testimonials?scope=home\|all` (public) returns rows that are `isPublished && moderationStatus=approved`, newest first. Home shows at most 6 (`HomeTestimonials.tsx`, hidden when there are none). `/testimonials` shows all. Both render `TestimonialCard.tsx`. |
| 6 | Images | Only `photoUrl`, a **URL text field** that Admin types in. It shows as a round avatar. Customers cannot upload images. |
| 7 | Admin edit, delete, hide | `PUT /api/testimonials/:id` (edit, including `isPublished`) and `DELETE /api/testimonials/:id` (**hard delete**) exist in the API. The admin UI shows only a **Delete** button for admin-curated rows. It has no edit form and no hide/unhide control. Pending customer reviews have only **Approve** and **Reject**. Approved or rejected customer reviews **disappear from the admin UI completely**: the page lists only "pending" and "admin_curated" rows, so Admin cannot hide, delete or even see a published customer review. |
| 8 | Approval / publishing | `PUT /api/testimonials/:id/moderate {decision: approved\|rejected}`. Approving also publishes it; rejecting also unpublishes it. |
| 9 | Linked to customers? | Yes. `customerId` is a foreign key to `User` (`onDelete: SetNull`), and `orderId` is a foreign key to `Order`. |
| 10 | Anonymous reviews? | No. Submitting requires `@Roles('customer')`. Guests cannot submit. |
| 11 | Ratings | Yes. A 1–5 integer is required on both paths, and public cards show stars. |
| 12 | Notifications | **None.** Admin is not notified when a customer submits a review. |
| 13 | Reusable parts | `TestimonialsService` and its controller, `AuditLogService`, `RateLimit` decorator/guard, `StorageService` (private, content-addressed disk storage), `receipt-file-type.util.ts` (magic-byte sniffing and filename sanitising), the admin `ReceiptPreview` pattern (fetches the file with the bearer token and shows it from a blob URL), `NotificationService` with the admin fan-out pattern (`ContactService`/`QuotesService`), `apps/admin/lib/notification-link.ts`, the web i18n catalogs (15 locales, `i18n:check`), `apps/web/i18n/api-errors.ts`, and `safeNextPath` for the login `?next=` redirect. |

**Gaps and defects found along the way** (fixed as part of this aspect, see §15 and §24):

- **D-a (privacy bug):** `TestimonialsService.submit` sets
  `customerName = displayName ?? username ?? email`. A customer with no display name or username
  would have their **email address published** once Admin approves the review.
- **D-b (data leak):** the public `GET /api/testimonials` returns internal fields: `source`,
  `moderationStatus`, `isPublished` and `orderId`.
- **D-c:** customer submissions store `country = 'Not specified'`, and the public card shows that
  string.
- **D-d:** approved or rejected customer reviews cannot be managed in the admin UI (row 7).
- **D-e:** the customer form only accepts orders with `status=completed`. Orders often remain at
  `payment_confirmed`, `processing` or `ready`, and custom-request customers (the core digitizing
  service) have no `Order` at all, so most real customers can never leave a review (see Appendix B,
  D1).
- **D-f:** `PUT /:id` can set `isPublished=true` on a pending or rejected review. The public filter
  still hides it, so nothing leaks, but the stored state is contradictory.

## 4. Scope

- A "Write a Review" CTA and a dedicated, mobile-friendly review form page.
- An optional customer image with client preview, server validation, private storage, and public
  display only after the review is published.
- An explicit four-state moderation model built on the existing columns (§10).
- An extended admin Testimonials page: status filters, search, all reviews from both sources, view,
  approve, reject, hide, unhide, edit, delete, and image management.
- An admin notification when a customer submits a review.
- A **My Reviews** page in the customer account (Appendix B, D6).
- Fixes for defects D-a to D-f.
- i18n of all new customer-facing strings in all 15 locales, with RTL support.

## 5. Out of scope

- Guest (non-registered) reviews (§6).
- Customers editing a review after submitting it. A customer can withdraw it instead (Appendix B, D4).
- Admin replies to reviews shown publicly, review voting, and review sorting or filtering on the public site.
- Per-design product reviews or star averages on design cards.
- Version history beyond one preserved original text (§16).
- The native mobile app (`apps/mobile`), which does not display testimonials today.
- Translating the admin app, which is English-only throughout today (Appendix B, D8).

## 6. Who can submit (authentication and eligibility)

**Recommendation: registered customers only.** No guest reviews.

Reasons, based on the existing architecture:
- Submitting already requires `@Roles('customer')`. Accepting guests would need a new anti-abuse
  layer (captcha or email verification per review) that this project does not have.
- A registered account ties every review to a real `User` and makes My Reviews, withdrawal and
  ownership checks simple.
- The SRS and A-012c AC-5 forbid fabricated reviews. An account-backed review is the cheapest
  authenticity signal.

The existing auth (JWT access token, `AuthContext`) is reused. No second authentication system is
added.

**Eligibility, recommended (Appendix B, D1):** a signed-in customer may write a review if they have
**at least one real paid engagement**:
- an `Order` they own with `paymentStatus=completed`, status in `payment_confirmed`, `processing`,
  `ready` or `completed`, and no refund (the same "fully paid, not refunded" rule A-013 uses to
  unlock files), **or**
- a `CustomRequest` they own with status `delivered` or `completed`.

The form has an optional **"What is this review about?"** field listing those orders and custom
requests. Each order or custom request can be reviewed once (§18). The customer may also choose
"General experience" and link nothing.

**UI by state:**
| Visitor | What they see on "Write a Review" |
|---|---|
| Guest | A short explanation that a CZ Digitizing account is needed, with **Log in** and **Create account** buttons that return to the form through `?next=/testimonials/write` (`safeNextPath`) |
| Signed in, not eligible | "You can write a review once you have a paid order or a delivered custom request." Includes links to Designs and Custom Request. No form. |
| Signed in, eligible | The form (§7) |
| Admin/staff account | Not offered. The submit endpoint is `@Roles('customer')`. |

## 7. Customer review form

**Route:** `/testimonials/write`, a page of its own instead of a modal so it works on mobile and survives
the login redirect.

**Entry points ("Write a Review" CTA):**
- `/testimonials`: a primary button in the page header, and the empty state ("No reviews yet").
- Home testimonials section: a "Share your experience" link next to View More. The section is still
  hidden when there are no published testimonials, as today.
- `/account/orders`: the existing "Leave a review" link opens `/testimonials/write?order=<id>` with
  that order preselected. It replaces the small inline form and appears on every eligible order, not
  only `completed` ones.
- `/account/reviews` (My Reviews): a "Write a Review" button.

**Fields:**
| Field | Required | Notes |
|---|---|---|
| Display name | Yes | Prefilled from the account's `displayName`, then `username`. Never prefilled from email (fixes D-a). Editable, because this is the name shown publicly. Helper text: "Shown publicly with your review." |
| Country | No | Free text, shown publicly if given. Fixes D-c. |
| What is this review about? | No | A select: the customer's eligible orders and custom requests that have not been reviewed, plus "General experience". The `?order=` query preselects one. |
| Service used | Yes | Prefilled from the selected item (the design or service name), editable. Same column as today. |
| Rating | Yes | 1–5 accessible star radio group. Keyboard and screen reader friendly, mirrored in RTL. The existing system requires a rating, so this stays required. |
| Your review | Yes | Textarea with a live character counter (§19 limits). |
| Photo | No, labelled **(Optional)** | §8 and §9 |

**Submit** shows a busy state, and the button is disabled while sending to prevent double submits.
Server field errors appear inline next to the matching field, and other errors use the existing `ErrorBanner`.

## 8. Optional image upload

| Aspect | Rule |
|---|---|
| Purpose | A photo of the finished embroidered product or the customer's result |
| Optional | Always. A review with text only is valid. |
| Formats | **JPEG, PNG, WebP.** GIF is excluded (animated, not needed). **SVG is excluded** (it can carry script). HEIC is excluded (browsers cannot display it; iOS Safari converts to JPEG when uploading through `<input type=file accept="image/*">`). |
| Max size | **5 MB** before processing (Appendix B, D3), enforced by the client, the multer `limits.fileSize` setting and the service |
| Count | At most **one** image per review |
| Type check | The real type comes from the file's **magic bytes**, never from the extension or the client MIME type. The existing JPEG/PNG/WebP detection in `receipt-file-type.util.ts` moves into a shared `common/files/image-type.util.ts` (receipts keep using it, with PDF added only for receipts) |
| Content check and cleanup | **Recommended (Appendix B, D2): re-encode with `sharp`.** The image is decoded (rejected with `INVALID_IMAGE` if it fails), limited to 40 megapixels (protects against decompression bombs), auto-rotated by its EXIF orientation, resized to at most 2000 px on the longest side, and re-encoded as WebP (quality 82). **All metadata is removed, including GPS location**, which phone photos usually contain and which would otherwise be published. Re-encoding also removes any payload hidden in a file that is valid as two formats at once (a polyglot). |
| Filename | The client filename is **discarded**, except as a sanitised display name for Admin (`sanitizeOriginalFilename`, already used for receipts). The stored name is the SHA-256 of the processed bytes. |
| Storage | The existing private, content-addressed `StorageService` (`STORAGE_PRIVATE_ROOT`, never web-served), under a new **`review-images/` namespace** so a review image can never share a path with a receipt or embroidery file. **Not** `ImageUploadService` / `/uploads`: that root is public, so a pending, hidden, rejected or deleted image would stay publicly reachable. |
| Reference | `testimonials.image_storage_path` + `image_content_type` (§25). The storage path is never returned by any API. |
| Access | Served only through API routes (§26) that check the review state: public only when `approved` + published; otherwise only the owning customer or staff with `testimonials` read permission; everyone else gets `404`. Responses include `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, and `Content-Disposition: inline`, the same headers receipts use. |
| Unauthorized access | Without the right status or ownership, the API answers **404, not 403**, so it does not reveal whether a review exists |

## 9. Image preview

On the customer form:
- The "Add a photo (optional)" control opens the native picker (`accept="image/jpeg,image/png,image/webp"`), so mobile offers both camera and gallery.
- Before upload, the client rejects files of the wrong type or over 5 MB with a translated message,
  without contacting the server.
- A valid file shows a preview immediately from `URL.createObjectURL`, which is revoked on change
  and on unmount. The preview box has a fixed aspect ratio with `object-contain`, so it never
  overflows on narrow screens.
- **Remove photo** clears it. **Change photo** opens the picker again. The form stays valid without a photo.
- The image is sent in the same `multipart/form-data` request as the review. There is no upload
  before submitting, so abandoned forms never leave files behind.

## 10. Review statuses

**No new status column or enum.** The existing `moderationStatus` and `isPublished` columns already
give four clear states. The service derives a single `status` field for the API and UI:

| Status (UI/API) | `moderationStatus` | `isPublished` | Public? | Meaning |
|---|---|---|---|---|
| **Pending** | `pending` | `false` | No | Submitted by a customer, waiting for Admin |
| **Published** | `approved` | `true` | **Yes** | Approved and visible |
| **Hidden** | `approved` | `false` | No | Approved but taken down. Can be unhidden. An admin-curated draft is also in this state and is labelled "Hidden (draft)" in Admin. |
| **Rejected** | `rejected` | `false` | No | Admin declined it. Kept until deleted. Can still be approved later. |

**Invariant:** `isPublished = true` only when `moderationStatus = approved`. The service enforces it
(fixes D-f) and so does a database `CHECK` constraint (§25).

"Approved" and "published" stay one step, as today: **Approve** publishes the review. Approving
without publishing would add a step that has no business need.

**Customer workflow:** Submit → **Pending** → Admin **Approve** (→ Published) or **Reject** (→
Rejected). Later: **Hide** (Published → Hidden), **Unhide** (Hidden → Published), **Delete** (any
state → removed).

**Transitions:**
| From \ Action | Approve | Reject | Hide | Unhide | Edit | Delete |
|---|---|---|---|---|---|---|
| Pending | → Published | → Rejected | — | — | ✓ | ✓ |
| Published | — | — | → Hidden | — | ✓ | ✓ |
| Hidden | — | — | — | → Published | ✓ | ✓ |
| Rejected | → Published | — | — | — | ✓ | ✓ |

An action that does not apply returns `409 INVALID_REVIEW_TRANSITION`.

## 11. Admin review management

Location: **Admin → Testimonials** (`apps/admin/app/testimonials/page.tsx`, existing sidebar entry).
The page is extended, not replaced: the "Create testimonial" form and its AC-5 no-fabrication warning
stay as they are.

**Every review from both sources** is listed (fixes D-d). Each row or card shows:
- the display name, and the customer's account **email** (customer-submitted reviews only, Admin-only) with a link to the customer record
- the source badge, **Customer** or **Admin**
- stars, service used, country and business
- the review text (3 lines in the list, full text in the detail view)
- an image thumbnail if there is one, fetched with the bearer token as a blob URL (`ReceiptPreview` pattern)
- the linked order or custom request number, if any
- submitted date, last updated date, and status badge

**Detail view** (expands inline, the same pattern as `custom-requests/page.tsx`):
- full text, and **Original submission** if Admin edited the text (§16)
- full-size image with **Replace image** and **Remove image**
- action buttons for the current state (§10 table)
- **Edit** form: display name, country, business, rating, service used, review text, and, for admin-curated rows only, the existing `photoUrl`

Every action is permission-gated with `@RequiresPermission('testimonials', …)`: `read_only` for viewing,
`crud` for changes. This is the existing module permission, already in the moderator default set.
Every change writes an `AuditLogService` entry (§16).

## 12. Hide vs delete

| | **Hide** | **Delete** |
|---|---|---|
| Database row | Kept (`isPublished=false`) | **Permanently removed** (hard delete) |
| Public site | Removed immediately | Removed immediately |
| Reversible | Yes: **Unhide** re-publishes it | No |
| Image file | Kept, no longer publicly served | Removed from private storage, unless another testimonial row references the same content-addressed path |
| Customer's My Reviews | Shows "Not currently displayed" | Gone |
| Audit log | `TESTIMONIAL_HIDDEN` | `TESTIMONIAL_DELETED` (already exists) |
| Use for | Temporary takedown, a complaint under investigation, seasonal rotation | Spam, abuse, a customer's request to be erased, fabricated content |

**Why hard delete:** the existing `DELETE /api/testimonials/:id` already hard-deletes, and A-012's
retention note names delete as the removal mechanism for a customer's request. The project has no
soft-delete convention for content tables. The audit log keeps who deleted what and when. Delete asks
for confirmation in the UI ("This permanently removes the review and its photo. To take it down
temporarily, use Hide instead."). See Appendix B, D7.

## 13. Admin moderation queue

- **Status tabs with counts:** All · **Pending** · Published · Hidden · Rejected. Pending is
  highlighted (gold badge) when its count is above 0. The page opens on **Pending** when there are pending reviews, otherwise on All.
- **Source filter:** All / Customer / Admin.
- **Search:** display name, email, review text, or service used, case-insensitive.
- **Sort:** newest first (existing `orderBy createdAt desc`).
- Filtering and search run on the client over the existing `GET /api/testimonials/admin` list. At
  the expected volume (hundreds of rows, not tens of thousands) this avoids new query parameters.
  §31 records the threshold for moving it to the server.
- The tab is reflected in the URL (`?status=pending`), so the notification link (§20) opens the right tab.
- Pending card, as in the brief:

```
Pending Reviews (2)
──────────────────────────────────────────
Jane D. · Customer · jane@… · Order #1042
★★★★★  Embroidery Digitizing · 06 Oct 2026
"Excellent digitizing, stitched perfectly on…"
[thumbnail]
[Approve & publish] [Reject] [Edit] [Delete]
```

Admin controls exist only in `apps/admin` and behind staff-only routes. The customer web app has none (§24).

## 14. Public display

`/testimonials` and the home section show only **Published** reviews (`approved` + `isPublished`,
the existing filter), from both sources together.

**Public card** (`TestimonialCard.tsx`, extended):
- display name, country if present, business if present, stars, review text, service used
- **customer photo** if present: under the text, fixed aspect ratio, `object-cover`, `loading="lazy"`,
  alt text "Photo shared by {name}". Tapping it opens the full image in a simple accessible dialog.
- **month and year** (`Intl.DateTimeFormat` in the active locale), e.g. "October 2026"
- the existing `photoUrl` avatar behaviour for admin-curated rows is unchanged

**Never displayed or returned by the public API:** email, `customerId`, `orderId`, custom request ID,
`source`, `moderationStatus`, `isPublished`, original text, storage path, or anything Admin-only.
A new **`PublicTestimonialDto`** carries only `id` (an opaque key used for list rendering and the
image URL, never shown), `customerName`, `country`, `business`, `photoUrl`, `imageUrl`, `rating`,
`feedback`, `serviceUsed` and `createdAt`. This fixes D-b. The only consumers of the public endpoint
are `HomeTestimonials.tsx` and `testimonials/page.tsx` (`apps/mobile` does not use it), so the
narrower shape is safe.

**Image visibility:** the image is part of the review and becomes public when, and only when, the
review is published. There is no separate image-approval step. Admin can remove or replace the image
at any time, and must look at it before approving (the queue shows it).

The empty state on `/testimonials` (currently blank) becomes "No reviews yet" with the Write a Review
CTA. The home section stays hidden when empty (A-012c §5).

## 15. Existing admin-created testimonials

- `source=admin_curated` rows, the create form, the AC-5 warning, `photoUrl`, publish on create, and
  the home limit of 6 are **unchanged**.
- They now appear in the same list as customer reviews, with an **Admin** badge, and gain Edit, Hide
  and Unhide in the UI. The API already supported these.
- Admin can optionally attach an uploaded image to an admin-curated testimonial through the same
  image endpoints (§26). This is additive. `photoUrl` keeps its avatar role.
- **Data migration:** existing customer-submitted rows with `country = 'Not specified'` become
  `NULL` (D-c). Any row that breaks the §10 invariant (`isPublished = true` but not `approved`) is set to
  `isPublished = false` before the CHECK constraint is added. Such rows are already invisible to the
  public, so nothing visible changes.
- The existing `POST /api/testimonials/submit` keeps accepting its current JSON body (with `orderId`)
  until the old inline form is removed in the same change, so there is no broken intermediate state.

## 16. Admin editing

Admin may edit display name, country, business, rating, service used and review text of any review.

- **Original text is kept:** a new nullable `original_feedback` column is filled once, at customer
  submission, and never changed afterwards. When Admin's edited `feedback` differs, the detail view
  shows "Edited by Admin" and an expandable **Original submission**. This is not a version history,
  only the one original.
- **Audit:** the existing `AuditLogService` records `TESTIMONIAL_UPDATED` (with the changed fields),
  `TESTIMONIAL_MODERATED`, `TESTIMONIAL_HIDDEN`, `TESTIMONIAL_UNHIDDEN`, `TESTIMONIAL_IMAGE_REPLACED`,
  `TESTIMONIAL_IMAGE_REMOVED` and `TESTIMONIAL_DELETED`, each with the admin ID and time.
- Each row records who submitted it (`customerId` or `createdByAdminId`), its current content,
  status, `createdAt` (submitted) and `updatedAt` (last changed).
- Editing does **not** change status. Editing a published review keeps it published.

## 17. Customer confirmation

After a successful submit, the form is replaced by a confirmation panel:

> **Thank you for sharing your experience with CZ Digitizing.**
> Your review has been submitted and is awaiting approval. You can check its status in My Reviews.

The panel has **View My Reviews** and **Back to Testimonials** buttons. It does not promise
publication. The text comes from the i18n catalogs (§22).

## 18. Duplicate and spam protection

| Threat | Control |
|---|---|
| Rapid repeat submissions | The existing `@RateLimit(5, 60)` per IP on `POST /submit` (same as Contact Us), plus the client disabling Submit while sending |
| Same review twice | `409 DUPLICATE_REVIEW` if the same customer submitted identical text (trimmed, lower-cased, whitespace collapsed) in the last 24 hours |
| One order reviewed many times | `409 ALREADY_REVIEWED`: one review per order and one per custom request, whatever its status. Admin deleting it allows a new one. |
| Flooding the queue | At most **3 Pending** reviews per customer at once (`409 TOO_MANY_PENDING_REVIEWS`, with a message saying to wait for approval) |
| Empty, too short or too long text | §19 limits, checked on client and server |
| Bad images | §8: magic bytes, size, decode, pixel limit, re-encode |
| Unauthorized calls | `@Roles('customer')` on customer routes; staff routes need role and permission; ownership checks with 404 (§24) |
| Suspended accounts | Already blocked by the existing auth guard (`UserStatus`) |
| Fields the client should not set | The global `ValidationPipe` whitelist drops `status`, `isPublished`, `source` and `moderationStatus` from the customer DTO. The service sets them itself. |

These limits are deliberately loose: a real customer leaves one or two reviews.

## 19. Validation

The limits are shared constants, used by both the server DTO and the client form.

| Field | Rule |
|---|---|
| Display name | Required, trimmed, 2–80 characters |
| Country | Optional, trimmed, at most 80 characters; empty becomes `NULL` |
| Service used | Required, trimmed, 2–120 characters |
| Rating | Required integer, 1–5 |
| Review text | Required, trimmed, **20–2000 characters**. Control characters other than newline and tab are stripped. Plain text only. |
| Linked item | Optional; must be one of the caller's own **eligible** orders or custom requests (§6), otherwise `404` |
| Image | Optional; JPEG, PNG or WebP by magic bytes; at most 5 MB; must decode; at most 40 megapixels |

Admin edit DTOs get the same length limits. Admin create keeps `country` required, as today.

## 20. Notifications

Reuses `NotificationService` and the admin fan-out pattern of `ContactService` and `QuotesService`.

- New `NotificationType` value **`review_submitted`**, added to `ADMIN_ONLY_TYPES`, with
  `DEFAULT_CHANNELS = ['email', 'in_app']` like every other admin trigger.
- Recipients: every `role=admin` user, the same set as contact and quote notifications.
- Title: "New customer review submitted". Message: "{displayName} left a {rating}★ review. It is
  waiting for moderation." The **review text is not included**, so customer-written content never
  lands in an email body.
- `apps/admin/lib/notification-link.ts`: `review_submitted` → `/testimonials?status=pending`. No new
  `related_*` foreign key on `notifications` is needed.
- The notification is sent after the row is saved. If it fails, the error is logged and the submit
  still succeeds (existing posture).
- **Customer:** no email and no notification (Appendix B, D5). The on-screen confirmation and My
  Reviews status are enough. A "your review was published" notification can be added later as a new
  customer-facing type.

## 21. My Reviews

**Recommendation: include it (Appendix B, D6).** The account area already has a page per area
(orders, quotes, custom requests, support), so one more is cheap and gives the customer somewhere to
check status and withdraw a review.

- Route `/account/reviews`, linked from the account menu next to Orders.
- A list, newest first: stars, service, linked item, a short excerpt, a thumbnail fetched with the
  bearer token (owner-only image route), submitted date and a status badge:
  - Pending → **Awaiting approval**
  - Published → **Published**
  - Hidden → **Not currently displayed**
  - Rejected → **Not approved**
- The customer sees the **current** text (after any Admin edit) plus their original text if it
  differs. No Admin-only fields are shown.
- **Withdraw** (with confirmation) permanently deletes the customer's own review in any status,
  using the same deletion path as §12 (Appendix B, D4). This lets a customer remove their own
  published personal data without asking Admin.
- Empty state: "You haven't written any reviews yet" plus the Write a Review CTA.

## 22. Internationalization

Every new customer-facing string goes in `apps/web/i18n/messages/*.ts` for all **15 locales**, with
English as the source. The web `i18n:check` must pass. No customer-facing text is hard-coded.
API error codes get localized messages in `apps/web/i18n/api-errors.ts`.

New keys (namespace `reviews.*`, plus small additions to `testimonials.*`, `orders.*` and `account.*`)
cover at least: Write a Review · Share Your Experience · Your review · Rating · {n} out of 5 stars ·
Display name · Shown publicly with your review · Country (optional) · Service used · What is this
review about? · General experience · Add a photo · Optional · Change photo · Remove photo ·
JPEG/PNG/WebP up to 5 MB · Submit Review · Submitting… · Review submitted · Thank-you text ·
Awaiting approval · Published · Not currently displayed · Not approved · Pending · Hidden ·
Rejected · My Reviews · Withdraw review · Withdraw confirmation text · No reviews yet · You haven't
written any reviews yet · login-required text · not-eligible text · Photo shared by {name} · every
§27 error message · Approve · Hide · Unhide · Delete · Edit (for the customer-visible equivalents).

**RTL (Urdu, Arabic):** layout uses logical properties (`ms-`/`me-`, `text-start`), as the existing
pages do. The star input order mirrors. Customer-written text renders with `dir="auto"` (already used by
`TestimonialCard`) so mixed-language reviews display correctly. The character counter and image preview
controls stay inside the viewport in RTL.

**Admin app:** English only, matching every existing admin page. The admin app has no i18n layer
(Appendix B, D8).

Review text is stored and shown exactly as written and is not translated (the A-012c rule:
`testimonials` has no `language_code`).

## 23. Mobile and responsive behavior

Customer (360 px to desktop):
- The form is one column on phones and two columns for short fields on `sm:` and up. Inputs are full
  width with at least 44 px touch targets. The star control is large enough to tap.
- Image preview: `max-w-full`, fixed aspect ratio, `object-contain`; the Remove and Change buttons wrap below the image on narrow screens.
- Public cards: one column on phones, 2 on `sm`, 3 on `lg` (home), as today. Long unbroken text
  wraps with `break-words`. Images never exceed the card width.
- My Reviews: stacked cards on phones.
- Checked with no `scrollWidth > clientWidth` at 360, 390, 414, 768, 1366 and 1440 px.

Admin:
- The moderation list uses **stacked cards** instead of a wide table, so it works on tablets and
  narrow windows. The action buttons wrap. The tabs scroll horizontally inside their own container,
  never the page.
- Known pre-existing limit: the admin **shell** (sidebar and layout) is not responsive on phones
  (recorded in A-025 spec §38). This aspect makes the Testimonials page content responsive. It does
  not fix the shell.

## 24. Security

| Area | Measure |
|---|---|
| Customer authentication | The existing JWT and `@Roles('customer')` on every customer route. Guests receive 401. |
| Ownership and IDOR | `mine/*` routes always filter by `customerId = token.sub`. Another customer's review ID returns **404**. A linked order or custom request must belong to the caller and be eligible. The client never sends a customer ID. |
| Status changes | The customer DTO has no status fields. The service always sets `pending` and `isPublished=false` and ignores anything else. Customers cannot publish, approve, hide or edit. |
| Admin authorization | Staff routes require `@Roles('admin','freelancer','moderator')` and `@RequiresPermission('testimonials', read_only\|crud)`, like the existing routes. |
| Admin UI exposure | Moderation controls exist only in `apps/admin`. Customer DTOs contain no admin fields. |
| Image access | Private storage only. The public image route works only for published reviews. Owner and staff routes need a bearer token. Other requests get 404. The storage path is never sent. |
| Upload safety | Magic-byte allow-list, 5 MB multer limit (memory storage, so nothing touches disk before validation), decode and pixel limit, metadata strip and re-encode (D2), server-chosen filename, `nosniff` + sandbox CSP response headers. No SVG, HTML, PDF or executables. |
| XSS / HTML injection | Text is stored as plain text and rendered through React escaping. No `dangerouslySetInnerHTML` and no Markdown. `dir="auto"`. Control characters are stripped. Notification emails do not include review text. |
| Privacy | The display name is never filled from email (D-a). The public DTO is trimmed (D-b). GPS and EXIF data are removed (D2). Customers can withdraw their own reviews (D4). |
| Rate limiting and abuse | §18 |
| Auditing | Every admin action is in the audit log (§16) |

## 25. Database changes

Minimal changes, all on the **existing** `testimonials` table. **No new review table.**
(Proposed only; no migration exists yet.)

| Change | Why |
|---|---|
| `image_storage_path TEXT NULL` | Private storage reference for the customer image (§8) |
| `image_content_type TEXT NULL` | Content type for the response header. CHECK: both image columns are NULL or both are set. |
| `image_original_filename TEXT NULL` | Sanitised name, shown to Admin only |
| `original_feedback TEXT NULL` | The preserved first customer text (§16) |
| `custom_request_id BIGINT NULL` → FK `custom_requests(id) ON DELETE SET NULL` + index | Lets a review link to a custom request (§6, only needed if D1 is approved as recommended) |
| `country` → **nullable** | Customer country is optional (D-c). Backfill `'Not specified'` → `NULL` for `customer_submitted` rows. |
| CHECK `NOT is_published OR moderation_status = 'approved'` | The §10 invariant. Backfill violating rows to `is_published = false` first. |
| CHECK `order_id IS NULL OR custom_request_id IS NULL` | A review links to at most one item |
| `NotificationType` += `review_submitted` | §20 |

Not added, on purpose: a status enum (the existing columns are enough), `publishedAt`/`hiddenAt`
(the audit log has the times), `deletedAt` (hard delete, D7), and a unique index on `order_id` (the
"one review per item" rule is checked in the service). A unique index could fail on existing dev data and
would also stop Admin from adding a second curated row for the same order.

Migration name (proposed): `2026XXXXXXXXXX_customer_review_submission`. It needs to be applied to the
dev DB after merge, as with earlier migrations.

## 26. API

All under the existing `TestimonialsController` (`api/testimonials`), using the project's
`ApiResponse` envelope and `ApiException` error codes. Literal segments (`admin`, `mine`, `submit`)
are declared before `:id` routes.

**Public**
| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/testimonials?scope=home\|all` | *Existing.* Now returns `PublicTestimonialDto[]` (§14) |
| `GET` | `/api/testimonials/:id/image` | **New.** Streams the image only if the review is published and has one; otherwise 404. `Cache-Control: public, max-age=300` (a hidden image can stay in browser caches for up to 5 minutes) |

**Customer** (`@Roles('customer')`)
| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/testimonials/mine/eligibility` | **New.** `{ eligible, items: [{ kind: 'order'\|'custom_request', id, label, alreadyReviewed }], pendingCount, pendingLimit }`. Drives the form and the not-eligible state. |
| `POST` | `/api/testimonials/submit` | *Existing, extended.* `multipart/form-data` (JSON still accepted): `customerName`, `country?`, `serviceUsed`, `rating`, `feedback`, `orderId?`, `customRequestId?`, `image?`. Rate-limited. Returns `MyTestimonialDto`. `201`. |
| `GET` | `/api/testimonials/mine` | **New.** Caller's reviews as `MyTestimonialDto[]`: id, customerName, country, rating, feedback, originalFeedback, serviceUsed, linked item label, hasImage, status, createdAt, updatedAt |
| `GET` | `/api/testimonials/mine/:id/image` | **New.** Owner only, any status |
| `DELETE` | `/api/testimonials/mine/:id` | **New.** Withdraw your own review (D4). `204` |

**Admin** (`@Roles('admin','freelancer','moderator')` + `testimonials` permission)
| Method | Path | Perm | Notes |
|---|---|---|---|
| `GET` | `/api/testimonials/admin` | read_only | *Existing.* Returns `AdminTestimonialDto[]`: today's fields plus `status`, `customerEmail`, `customerId`, `customRequestId`, linked item label, `hasImage`, `imageOriginalFilename`, `originalFeedback`, `updatedAt` |
| `GET` | `/api/testimonials/admin/:id/image` | read_only | **New.** Any status |
| `POST` | `/api/testimonials` | crud | *Existing, unchanged.* Admin create |
| `PUT` | `/api/testimonials/:id` | crud | *Existing.* Edit. Now rejects `isPublished=true` unless approved (`409`); limits from §19 |
| `PUT` | `/api/testimonials/:id/moderate` | crud | *Existing.* `{decision: approved\|rejected}` = Approve & publish / Reject; follows the §10 transitions |
| `PUT` | `/api/testimonials/:id/visibility` | crud | **New.** `{isPublished: boolean}` = Hide / Unhide, approved rows only |
| `PUT` | `/api/testimonials/:id/image` | crud | **New.** multipart `image`, replaces it (same pipeline as §8); deletes the old file if no other row uses it |
| `DELETE` | `/api/testimonials/:id/image` | crud | **New.** Removes the image |
| `DELETE` | `/api/testimonials/:id` | crud | *Existing.* Hard delete, now also cleans up the image file |

Shared types (`packages/shared-types/src/content.ts`): `TestimonialStatus`, `PublicTestimonialDto`,
`MyTestimonialDto`, `AdminTestimonialDto` (an extension of today's `TestimonialDto`, which is kept as
an alias so existing imports compile), `ReviewEligibilityDto`.

## 27. Error codes

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Field limits (existing code) |
| `NOT_ELIGIBLE_TO_REVIEW` | 403 | No paid order or delivered custom request (§6) |
| `ORDER_NOT_ELIGIBLE_FOR_REVIEW` | 409 | *Existing.* The linked order is not paid or was refunded |
| `ALREADY_REVIEWED` | 409 | The linked item already has a review |
| `DUPLICATE_REVIEW` | 409 | Same text within 24 hours |
| `TOO_MANY_PENDING_REVIEWS` | 409 | 3 pending already |
| `UNSUPPORTED_FILE_TYPE` | 415 | *Existing.* Not JPEG, PNG or WebP by magic bytes |
| `FILE_TOO_LARGE` | 413 | *Existing.* Over 5 MB |
| `INVALID_IMAGE` | 422 | Fails to decode or exceeds the pixel limit |
| `INVALID_REVIEW_TRANSITION` | 409 | The action does not apply in this status (§10) |
| `RESOURCE_NOT_FOUND` | 404 | *Existing.* Includes "not yours" and "not published" |
| `RATE_LIMITED` | 429 | *Existing* rate-limit guard |

## 28. Testing

- **API unit tests** (`testimonials.service.spec.ts`, extended): eligibility (paid order, refunded
  order, delivered custom request, none), one review per item, duplicate text, pending cap, display
  name never from email, status derivation, every §10 transition (valid and invalid), the publish
  invariant, ownership 404s, image type sniffing (JPEG/PNG/WebP accepted; GIF, SVG, PDF, `.exe`
  renamed to `.jpg`, and a truncated JPEG rejected), and image cleanup on delete only when nothing
  else references the file.
- **API integration** (`test/integration/testimonials.spec.ts`, new), **on a throwaway database
  and alternate ports, never `czdigitizing`**: full submit → pending → approve → public list → hide →
  unhide → reject → delete; a text-only review and one with an image; public, owner and admin image
  routes for each status; public DTO contains no private fields; customer A cannot read, withdraw or
  link customer B's data; customer cannot call admin routes (403); guest receives 401; rate limit
  returns 429; `review_submitted` notification created for admins; migration CHECK constraints hold.
- **Typecheck and lint** for api, web, admin, and `shared-types`; web `i18n:check` for all 15 locales.
- **Live Playwright pass** on an isolated stack:
  - customer: guest CTA leads to login and back to the form; text-only submit; submit with an image;
    preview, remove and change the photo; invalid type; over 5 MB; empty, short and long text; the
    confirmation panel; My Reviews statuses; withdraw
  - admin: the notification and its link; pending tab; image view; approve, hide, unhide, reject,
    edit (original text kept), image replace and remove, delete with confirmation; filters and search
  - public: published review visible with image; pending, hidden, rejected and deleted reviews
    absent; no email or ID in the page or API response
  - i18n: English, Urdu and Arabic, with RTL layout checks
  - mobile: iPhone 13 and Pixel 7 profiles, plus a 360 px width, for the form, preview, public
    cards, My Reviews, and the admin page content

## 29. Acceptance criteria

**Customer**
| ID | Criterion |
|---|---|
| AC-1 | **Given** any visitor on `/testimonials` **When** the page loads **Then** a "Write a Review" CTA is visible; a guest who clicks it sees a login/register prompt that returns them to the form after signing in |
| AC-2 | **Given** a signed-in customer with no paid order or delivered custom request **When** they open the form **Then** they see the not-eligible explanation, not the form, and the API rejects a forced submit with `NOT_ELIGIBLE_TO_REVIEW` |
| AC-3 | **Given** an eligible customer **When** they open the form **Then** the display name is prefilled from their profile (never from email), and they can choose an eligible order or custom request or "General experience" |
| AC-4 | **Given** a valid form with no image **When** submitted **Then** the review is stored as Pending (`moderationStatus=pending`, `isPublished=false`) |
| AC-5 | **Given** a valid form with a JPEG, PNG or WebP of at most 5 MB **When** submitted **Then** the review is stored as Pending with the processed image in private storage, with metadata removed |
| AC-6 | **Given** a selected image **Then** a preview is shown before submit, and the customer can remove it or choose another; the form remains submittable without one |
| AC-7 | **Given** a file that is not a real JPEG, PNG or WebP (including a renamed executable, SVG or GIF), or is over 5 MB **When** chosen or submitted **Then** it is rejected with a translated message and nothing is stored |
| AC-8 | **Given** text that is empty, under 20 or over 2000 characters, or a missing rating **When** submitted **Then** it is rejected inline (client) and by the API (server) |
| AC-9 | **Given** a successful submit **Then** the customer sees the translated "awaiting approval" confirmation, which does not promise publication |
| AC-10 | **Given** any customer request **Then** it cannot set status or publish; injected status fields are ignored and the review is always Pending |
| AC-11 | **Given** the same order already reviewed, identical text within 24 hours, or 3 pending reviews **When** submitting **Then** the API returns `ALREADY_REVIEWED`, `DUPLICATE_REVIEW` or `TOO_MANY_PENDING_REVIEWS` respectively |
| AC-12 | **Given** a customer on My Reviews **Then** they see only their own reviews with status, date and image, and can withdraw (permanently delete) one after confirming |

**Admin**
| ID | Criterion |
|---|---|
| AC-13 | **Given** a customer submits a review **Then** every admin gets a `review_submitted` notification (in-app and email, with no review text) that opens Testimonials on the Pending tab |
| AC-14 | **Given** Admin opens Testimonials **Then** reviews from both sources are listed newest first with status tabs and counts (All, Pending, Published, Hidden, Rejected), a source filter and search; pending reviews are clearly highlighted |
| AC-15 | **Given** a review with an image **Then** Admin can view it (thumbnail and full size) through an authenticated request, whatever its status |
| AC-16 | **Given** a Pending or Rejected review **When** Admin approves it **Then** it becomes Published and appears publicly at once |
| AC-17 | **Given** a Pending review **When** Admin rejects it **Then** it becomes Rejected, stays in the database and is not public |
| AC-18 | **Given** a Published review **When** Admin hides it **Then** it becomes Hidden and disappears publicly, including its image; **When** unhidden **Then** it is Published again with no data lost |
| AC-19 | **Given** any review **When** Admin deletes it after confirming **Then** the row and its image file (if no other row uses it) are permanently removed, an audit entry is written, and it is gone from public pages and My Reviews |
| AC-20 | **Given** any review **When** Admin edits its name, country, business, rating, service or text **Then** the changes are saved without changing status; the customer's original text stays available as "Original submission" |
| AC-21 | **Given** any review **When** Admin replaces or removes its image **Then** the change applies immediately and the old file is cleaned up if nothing else uses it |
| AC-22 | **Given** an action that does not apply to the current status, or `isPublished=true` on an unapproved row **Then** the API returns `409` and nothing changes |
| AC-23 | **Given** existing admin-curated testimonials **Then** create, publish, delete and the home limit of 6 work exactly as before, and they also appear in the unified list with Edit, Hide and Unhide |

**Public**
| ID | Criterion |
|---|---|
| AC-24 | **Given** Published reviews **Then** they appear on `/testimonials` and (up to 6) on Home with name, optional country, stars, text, service, month/year and the image if present |
| AC-25 | **Given** Pending, Hidden, Rejected or deleted reviews **Then** neither they nor their images appear on any public page, and their image URL returns 404 |
| AC-26 | **Given** the public API and pages **Then** no email, customer, order or custom request ID, moderation status, source, original text or storage path is ever exposed |

**Cross-cutting**
| ID | Criterion |
|---|---|
| AC-27 | **Given** customer A **Then** A cannot read, withdraw, or view the image of customer B's review, or link B's order (404), and cannot call any admin route (403) |
| AC-28 | **Given** any new customer-facing text **Then** it comes from the i18n catalogs in all 15 locales, `i18n:check` passes, and Urdu and Arabic render correctly in RTL |
| AC-29 | **Given** 360 px to desktop widths **Then** the form, image preview, public cards, My Reviews and the admin Testimonials content have no horizontal overflow and no off-screen buttons |

## 30. Dependencies

Parent: **A-012c** (Testimonials). Dependencies: A-002 (auth), A-004 (notifications), A-005f (admin
roles and permissions), A-007 (private storage service), A-012c, A-013c (the `Order` record and payment
state), A-017 (custom requests), A-019 (customer account area), A-021 (i18n). All are `Completed`.
It depends on A-013c, not the A-013 parent (which is `In Progress` only for its unrelated AC-8), the
same reasoning used for A-025. **Level 10** = `1 + max(A-019 = 9, A-013c = 8, A-017 = 8, …)`.

**New package:** `sharp` in `apps/api`, only if D2 is approved.

## 31. Risks

1. **Disk use:** images live on local disk like all other files. Re-encoding to at most 2000 px WebP
   keeps them to roughly 100–400 KB each.
2. **Client-side filtering** in Admin stops scaling at a few thousand testimonials. Above about 1,000
   rows, move filters and search to query parameters on `/admin`.
3. **Cached public image after Hide:** up to 5 minutes in browsers (`max-age=300`). The review card itself disappears immediately.
4. **`sharp` native binary** must install on the deployment target (Render, Linux x64). It ships prebuilt binaries for this, so this is low risk, but it is checked during implementation.
5. **Aspect File:** the SRS states customer reviews (A-012c AC-7) but not this extended workflow.
   Flagged in `SPEC_INDEX.md` § Dependency Issues, as with A-025.

## 32. Implementation notes (2026-10-06)

Implemented as approved, with every recommended option in Appendix B (D1–D10). No material change to
the approved architecture. These small refinements were made during implementation:

1. **Injected status fields are rejected, not ignored (AC-10).** The global `ValidationPipe` runs with
   `forbidNonWhitelisted`, so a submit carrying `isPublished` or `moderationStatus` returns `400`. The
   outcome AC-10 requires (a customer can never set status) holds.
2. **Admin edit minimum lengths stay at 1** (maximums match §19), so older, shorter admin-curated
   testimonials remain editable. The 20-character minimum applies to customer submissions.
3. **Generic 413 mapping.** multer's `limits.fileSize` raised a bare 413, which the global filter reported
   as `INTERNAL_ERROR`. `AllExceptionsFilter` now maps 413 to `FILE_TOO_LARGE`. This also corrects the
   same case for A-013 receipt uploads.
4. **Order "Leave a review" link** shows on every order whose files are unlocked (`filesUnlocked`, the
   same fully-paid rule as D1) and links to `/testimonials/write?order=<id>`. The old inline form and its
   five i18n keys were removed. `apiErrors.orderNotReviewable` now reads "Only fully paid orders can be
   reviewed" in all 15 locales.
5. **Two older A-012 integration tests were updated** to the approved D1 rules
   (`content-knowledge-base.spec.ts`): a paid order is now required, the customer response carries the
   derived `status`, and the text minimum is 20. Their intent is unchanged.
6. **Shared image sniffing.** `detectRasterImageType` (`apps/api/src/common/files/image-type.util.ts`)
   is used by both review images and A-013 receipts.
7. **`StorageService.saveInNamespace`** stores review images under `<private root>/review-images/`.
8. **Admin card layout** wraps the text under the thumbnail in narrow columns (`basis-40`), and the star
   row can wrap.

**Migration:** `20261006180000_customer_review_submission`. It was applied to the local dev DB
`czdigitizing` on 2026-10-06. Both backfills touched 0 of its 12 rows. Apply it with
`prisma migrate deploy` on every other environment before deploying. New dependency: `sharp@^0.35.5`
(`apps/api`).

**Verification:**
- API typecheck and lint clean. Web, admin, mobile and `shared-types` typecheck clean. Web and admin
  lint clean (2 existing warnings in `TaeboPanda.tsx`).
- API unit suite 539/539, including the new `testimonials.service.spec.ts` and
  `review-image.service.spec.ts` (the real sharp pipeline: GPS/EXIF stripped, 2000 px cap, renamed EXE,
  SVG, GIF, truncated JPEG and over-5 MB files all rejected).
- New integration spec `test/integration/testimonials.spec.ts` 13/13, and
  `content-knowledge-base.spec.ts` 8/8, each on a freshly created throwaway DB.
- Web `i18n:check` passes for all 15 locales.
- Live Playwright pass on an isolated stack (API :4100, web :3100, admin :3102, Redis db 5, throwaway
  DB), every AC exercised end to end: guest login prompt with `?next`, the not-eligible state, profile
  prefill, inline validation, client and server image rejection, preview/remove/change, text-only and
  photo submissions, confirmation, My Reviews and withdraw, the admin notification, the pending tab,
  authenticated admin image, approve, hide/unhide (the image URL returns 404 while hidden), reject, edit
  with the original kept, image replace/remove, filters and search, delete, IDOR/403 checks, the public
  page with no email, Arabic and Urdu RTL, and iPhone 13, Pixel 7, 360 px and 768 px layouts. No page or
  console errors.

**Open items:**
- **Admin moderation at ≤ 360 px.** The page's own content fits at iPhone 13, Pixel 7 and tablet widths.
  At 360 px the existing non-responsive admin **shell** (A-025 §38) leaves under ~100 px of content
  width, so a status badge overflows by about 11 px. Fixing the shell is out of this aspect's scope (§23).
- **Native-speaker review** of the 14 non-English translations.
- **Aspect File:** Dependency Issue #8 (the Aspect File does not name the extended workflow) still stands.

---

## Appendix A: files inspected

`apps/api/prisma/schema.prisma` (Testimonial, enums, User, Order, CustomRequestStatus, Notification),
`apps/api/src/testimonials/*` (controller, service, module, DTOs, spec),
`apps/api/src/designs/image-upload.{service,controller}.ts`, `apps/api/src/files/storage.service.ts`,
`apps/api/src/files/magic-bytes.ts`, `apps/api/src/orders/receipt-file-type.util.ts`,
`apps/api/src/orders/orders.controller.ts` (receipt upload/preview), `apps/api/src/orders/order-state-machine.ts`,
`apps/api/src/common/rate-limit/*`, `apps/api/src/notifications/notifications.constants.ts`,
`apps/api/src/contact/contact.service.ts`, `apps/api/src/quotes/quotes.service.ts`,
`apps/api/src/admin/freelancer-accounts.service.ts`, `apps/api/src/main.ts`, `apps/api/src/config/env.validation.ts`,
`apps/admin/app/testimonials/page.tsx`, `apps/admin/app/orders/[id]/page.tsx` (ReceiptPreview),
`apps/admin/components/Sidebar.tsx`, `apps/admin/lib/notification-link.ts`,
`apps/web/app/testimonials/page.tsx`, `apps/web/components/TestimonialCard.tsx`,
`apps/web/components/HomeTestimonials.tsx`, `apps/web/app/account/orders/page.tsx` (ReviewButton),
`apps/web/app/account/page.tsx`, `apps/web/i18n/messages/en.ts`, `packages/shared-types/src/content.ts`,
`docs/specs/2026-08-28-10-content-knowledge-base.md`, `docs/specs/SPEC_INDEX.md`, `docs/CLAUDE.md`,
`docs/features/README.md`. Searched repo-wide for review, testimonial, rating and moderation (apps/mobile has no testimonial usage).

## Appendix B: decisions requiring approval

| # | Decision | Recommended | Alternative(s) |
|---|---|---|---|
| D1 | Who may review | **Registered customers with ≥1 fully paid, non-refunded order or ≥1 delivered/completed custom request**; linking a specific item is optional | (a) Keep today's rule: completed orders only, item required (excludes most real customers, D-e); (b) any registered customer (moderation is the only gate) |
| D2 | Image processing | **Add `sharp`**: decode check, metadata/GPS strip, resize to 2000 px, re-encode to WebP | No new package: magic bytes plus size only. GPS/EXIF would then be published with photos, and full-size phone images would be served. |
| D3 | Max image size | **5 MB** | 10 MB (matches receipts) |
| D4 | Customer can withdraw (delete) own review | **Yes**, any status; no customer editing | No customer delete; removal only through Admin |
| D5 | Notify customer when published | **No** (My Reviews shows status) | In-app notification on publish (new customer-facing type) |
| D6 | My Reviews page | **Yes** (`/account/reviews`) | Leave it out; only the confirmation panel |
| D7 | Delete policy | **Hard delete** (existing behaviour) with audit log; Hide is the reversible option | Soft delete (`deleted_at`): no current convention for content tables |
| D8 | Admin UI language | **English**, like every existing admin page | Add i18n to the admin app (a separate, larger aspect) |
| D9 | Narrow the public testimonials API response (D-b) | **Yes**, `PublicTestimonialDto` | Keep the current fields public |
| D10 | Registration | **New aspect A-026** (child of A-012c), spec #22 | Add it as an addendum to the A-012 spec instead |
