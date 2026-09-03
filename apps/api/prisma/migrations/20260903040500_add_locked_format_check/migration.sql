-- docs/specs/2026-08-28-05-private-file-management.md AC-14 + spec §6 test-plan row:
-- "allowed_file_formats rejects any update that sets is_private=false on the EMB row, even via a
-- direct DB write bypassing the API layer". FileFormatService already refuses this at the
-- application layer; this is the DB-level backstop, matching the same posture as design_files'
-- emb_never_public constraint (AC-2) — the format-configuration feature must never be able to
-- weaken a locked format's privacy guarantee, regardless of who is editing it or how.
ALTER TABLE "allowed_file_formats" ADD CONSTRAINT "locked_format_stays_private" CHECK (NOT ("is_locked" AND NOT "is_private"));
