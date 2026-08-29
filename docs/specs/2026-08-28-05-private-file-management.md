# Spec: Private Embroidery File Management & Protection

**File:** `docs/specs/2026-08-28-05-private-file-management.md`
**Status:** Approved
**Author:** CZ Digitizing Team
**Reviewer:** Muhammad Suleman Yaseen (Primary Admin, czdigitizing@gmail.com) — pending
**Related:** [Master platform spec](2026-08-28-cz-digitizing-platform.md), SRS §9 / §19–20 / Addendum §4–5, architecture §File Management

---

## 1. Problem statement

**Today:** Embroidery source files (DST, PES, JEF, EXP, VP3) and the permanently-private `.EMB`
format have no controlled storage or delivery mechanism. There is no way to guarantee a customer
only receives files they paid for, no download audit trail, and no protection against `.EMB` ever
reaching a customer.

**Who is affected:** Customers, whose purchased files must be reliably and exclusively delivered to
them; Admin, who uploads and manages files per design; the business, whose paid digital product
(the files) has no anti-leak protection today.

**Why it matters now:** This is the single highest-risk feature in the platform — a failure here
(an `.EMB` file served, or a file served pre-payment) is a business-integrity incident, not just a
bug. It is a hard dependency of Orders/Payment (files release on `payment_confirmed`) and of the
Design Catalog (files attach to a design record).

**Success looks like:** Admin uploads 2–5+ files (and an optional ZIP) per design; `.EMB` is
permanently blocked from any non-admin path even if uploaded by mistake or hidden inside a ZIP;
paid customers download exactly their authorized files via short-lived signed URLs; every download
is logged; no storage path, filename, or direct URL is ever exposed to a customer.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** Admin uploads embroidery files for a design **When** a file's extension is `.EMB` **Then** it is stored as `is_private=true` unconditionally and is never returned by any public or customer-authenticated endpoint |
| AC-2 | **Given** a database write attempts to set `file_format='EMB'` with `is_private=false` **When** the write executes **Then** it is rejected by the `emb_never_public` CHECK constraint, not merely by application code |
| AC-3 | **Given** Admin generates a customer-delivery ZIP for an order that includes a design whose files include `.EMB` **When** the ZIP is built **Then** the `.EMB` file is excluded from the ZIP while all other authorized formats are preserved with their original names |
| AC-4 | **Given** a customer whose order is `payment_confirmed` requests an authorized file **When** the download endpoint is called **Then** a signed URL with a 10-minute expiry is generated, the file streams, the temp artifact is cleaned up, and the real storage path is never present in the response |
| AC-5 | **Given** a customer whose order is not `payment_confirmed`, or requesting a file not in their `customer_authorized_files` **When** they call the download endpoint **Then** the API returns `422 PAYMENT_NOT_CONFIRMED` or `403 FORBIDDEN` respectively, with no file data returned |
| AC-6 | **Given** any successful file download **When** it completes **Then** `customer_authorized_files.download_count` increments and `first_download_at`/`last_download_at` are set/updated |
| AC-7 | **Given** Admin uploads a file **When** validation runs **Then** MIME type and file size are checked (≤50MB per file, ≤250MB total per design), and the file is hashed for deduplication before storage |
| AC-8 | **Given** a customer views their purchased-files page **When** rendered **Then** it shows format, size availability, and a download action per file — never a filename that reveals internal storage structure |
| AC-9 | **Given** a customer needs a file format not included in their purchase **When** they submit a "Need Another File Format?" request **Then** it is tracked (see Custom Design Requests spec §File Format Requests) and does not bypass the payment/authorization gate |
| AC-10 | **Given** a design file is delivered to a paying customer **When** it is generated for download **Then** it carries an embedded watermark/DRM marker tying it to that customer's order (for leak traceability), without altering the stitch data |
| AC-11 | **Given** Admin sets a per-design or per-order maximum download-attempt count **When** a customer exceeds it **Then** further download requests return `403 FORBIDDEN` until Admin resets the count |
| AC-12 | **Given** Admin replaces a design file **When** the replacement is saved **Then** the prior version is retained as file-version history (not overwritten), and Admin can view/restore a previous version |
| AC-13 | **Given** Admin manages the allowed embroidery-file-format list from Settings **When** they add and activate a new machine-format extension (e.g. a future format beyond DST/PES/JEF/EXP/VP3, per SRS Addendum §4: "Do not hard-code a five-format ceiling") **Then** design uploads accept that extension without a code deploy, and it becomes selectable in the Admin file-upload UI |
| AC-14 | **Given** the `EMB` row in the allowed-format list **When** Admin views or attempts to edit it **Then** its `is_private` flag is shown as permanently `true` and cannot be toggled off by any Admin action — the format-configuration feature must never be able to weaken the `.EMB` privacy guarantee in AC-1/AC-2, regardless of who is editing it or how |

---

## 3. API contract

See [master spec §3](2026-08-28-cz-digitizing-platform.md#3-api-contract) for shared conventions.

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/designs/:id/files` | `role=admin` | `201` | rejects `.EMB` extension mismatch attempts silently to `is_private=true`, never surfaces a bypass path |
| `DELETE` | `/api/designs/:id/files/:fileId` | `role=admin` | `204` | |
| `GET` | `/api/orders/:id/files` | Authenticated customer, own order only, `payment_confirmed` | `200` `AuthorizedFileDto[]` | AC-5 |
| `POST` | `/api/orders/:id/files/:fileId/download` | Authenticated customer, own order only | `200` signed URL (10 min) | AC-4, AC-6 |
| `GET` | `/api/admin/settings/file-formats` *(new, proposed)* | `role=admin` | `200` `AllowedFileFormatDto[]` | AC-13 |
| `POST` / `PUT` | `/api/admin/settings/file-formats` `/:id` *(new, proposed)* | `role=admin` | `201` / `200` | rejects any attempt to set `is_private=false` on a `is_locked=true` row (AC-14) with `422 FILE_FORMAT_BLOCKED` |

### DTOs

```ts
// Never includes storage_path, upload_hash, or the real filename
export interface AuthorizedFileDto {
  id: string;
  designId: string;
  fileFormat: 'DST' | 'PES' | 'JEF' | 'EXP' | 'VP3'; // EMB is never a valid value here
  fileSizeBytes: number;
  downloadUrl?: string; // present only from the /download endpoint response, 10-min TTL
}
```

### Error codes (feature-specific)

| HTTP | `code` | When |
|---|---|---|
| `422` | `FILE_FORMAT_BLOCKED` | any attempt to serve/list `.EMB` to a non-admin caller |
| `422` | `PAYMENT_NOT_CONFIRMED` | AC-5 |
| `413` | `FILE_TOO_LARGE` | exceeds 50MB/file or 250MB/design |
| `415` | `UNSUPPORTED_FILE_TYPE` | MIME/extension not in the allowed set |

---

## 4. Data model changes

### Entities

| Entity | Change | Notes |
|---|---|---|
| `design_files` | existing | `emb_never_public` CHECK constraint is load-bearing — must ship in the initial migration, not added later |
| `customer_authorized_files` | existing | per architecture DDL |
| `design_files.content_validated` *(new column, proposed)* | proposed | boolean set after magic-byte/content inspection confirms the file's real format matches its extension — closes the gap in master spec §8 risk #4 (a renamed `.emb` saved with a `.dst` extension must still be caught) |
| `allowed_file_formats` *(new, proposed, 2026-08-29 gap-audit)* | proposed | `id`, `extension` (unique, e.g. `DST`, `EMB`), `display_name`, `is_private` (default `false`), `is_locked` (boolean; `true` only for the seeded `EMB` row), `is_active` (default `true`), `max_file_size_mb`, `created_at`, `updated_at` — seeded at migration time with the six formats already named in architecture's `design_files.file_format` ENUM (`DST`,`PES`,`JEF`,`EXP`,`VP3`,`EMB`), with `EMB` seeded `is_private=true, is_locked=true`. Upload validation checks this table instead of a hardcoded list (AC-13); the underlying `design_files.file_format` column remains the architecture-defined Postgres ENUM for now — extending it to a genuinely open-ended format list requires a follow-up migration to widen that column to reference `allowed_file_formats.extension` instead, tracked as an open question below (§8) rather than done silently here |

### Migration

- **Name:** `InitialSchema` (design_files/customer_authorized_files) + `AddFileContentValidation`
  (follow-up for `content_validated`) + `AddAllowedFileFormats` (seeded, per above)
- **Reversible:** yes
- **Backfill required:** no
- **Downtime:** none
- **Reviewed SQL:** `emb_never_public` CHECK constraint SQL is in
  [architecture §Database Schema](../../CZ_DIGITIZING_ARCHITECTURE.md#database-schema) and must be
  reviewed as part of this spec's implementation PR, not assumed

### Retention and privacy

Private files are business IP/paid product, not personal data, but download logs
(`customer_authorized_files`) tie a customer identity to what they bought — covered by the same
retention policy as orders (tracked in master spec §8).

---

## 5. UI states

Admin file-upload panel and customer purchased-files page.

| State | Behaviour |
|---|---|
| **Loading** | upload progress bar per file (admin); download button shows spinner while signed URL is requested (customer) |
| **Empty** | design with no files yet shows "No files uploaded" + upload action (admin only; customers never see this state pre-purchase, they see the design without a download section at all) |
| **Error** | `FILE_TOO_LARGE`/`UNSUPPORTED_FILE_TYPE`/`FILE_FORMAT_BLOCKED` render as explicit inline messages, not generic failures — Admin must understand *why* an `.EMB` upload was rejected |
| **Success** | admin sees file list with format/size/replace/remove actions; customer sees a satisfying download confirmation, never a raw file path |

**Route(s):** `/admin/designs/:id/files`, `/account/purchased-designs`,
`/admin/settings/file-formats`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | ZIP-building excludes `.EMB`; signed-URL generation and expiry; hash-based dedup | `apps/api/files/*.spec.ts` |
| **Integration** | full upload → order → payment_confirmed → download flow; unauthorized/unpaid rejection; DB constraint enforcement | `apps/api/test/integration/private-files.spec.ts` |
| **DB constraint** | `emb_never_public` rejects direct bad inserts even bypassing the application layer | `apps/api/test/integration/db-constraints.spec.ts` |
| **E2E** | admin uploads 3 formats + `.EMB` + ZIP → customer buys → downloads → `.EMB` never appears anywhere in network responses | `e2e/private-files.e2e.spec.ts` |
| **Security scan** | malware/antivirus scanning of uploaded embroidery files and reference images against the selected provider | `apps/api/test/integration/malware-scan.spec.ts` |
| **DB constraint** | `allowed_file_formats` rejects any update that sets `is_private=false` on the `EMB` row (AC-14), even via a direct DB write bypassing the API layer | `apps/api/test/integration/db-constraints.spec.ts` |

**Traceability:** AC-1…AC-14 → named tests in `private-files.spec.ts`/`db-constraints.spec.ts`.

**Coverage:** ≥90% on this feature specifically (higher than the platform default 80%, given the
security-criticality of AC-1/AC-2/AC-3/AC-5).

**Not covered, deliberately:** None — malware/antivirus scanning is covered by the Security scan
row above.

---

## 7. Out of scope

None — every item previously listed here (watermarking/DRM, download-count hard caps, file
versioning history) has been folded into AC-10–AC-12 above.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Extension-only `.EMB` detection can be bypassed by renaming; `content_validated` (magic-byte check) closes this but needs a concrete per-format signature table | Engineering | Open |
| 2 | ZIP password-protection ("Apply optional password" per architecture) — password source/delivery to customer not specified | Admin | Open |
| 3 | Temp ZIP cleanup is specified as "after 1 hour" — needs a scheduled job/TTL mechanism confirmed for the chosen storage provider | Engineering | Open |
| 4 | `design_files.file_format` is currently a fixed Postgres ENUM per architecture's DDL; `allowed_file_formats` makes the *validation and UI* extensible without a deploy, but truly unbounded new formats still require a follow-up migration to widen the column type — full "no deploy, ever" extensibility is not yet achieved, only meaningfully improved | Engineering | Open |

---

## 9. Rollout

- **Feature flag:** none — this is a hard dependency of Orders/Payment; ships together.
- **Migration order:** `design_files`/`customer_authorized_files` with the CHECK constraint ship
  before any file-upload UI is enabled for Admin; `allowed_file_formats` (seeded, `EMB` locked)
  ships before the Admin file-format-settings UI is enabled.
- **Rollback:** if a rollback is ever needed after files exist in storage, the storage bucket
  contents are untouched (rollback affects app/DB code only) — the CHECK constraint must never be
  rolled back independently of the code that relies on it.
- **Observability:** hard alert (security-severity) on any `.EMB` file appearing in a non-admin
  response body or an unsigned/public URL — this should page, not just log, per master spec §9.
