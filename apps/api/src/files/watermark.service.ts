import { Injectable, Logger } from '@nestjs/common';

// docs/specs/2026-08-28-05-private-file-management.md AC-10 — "embedded watermark/DRM marker
// tying it to that customer's order... without altering the stitch data". Binary-embedding a
// traceability marker into a DST/PES/JEF/EXP/VP3 stitch file requires per-format knowledge of
// where a marker can be placed without corrupting stitch data — no such library is available in
// this repo (per plan, an explicit scope decision). This records the traceability fact the AC asks
// for (who received which file, when) without touching the file's bytes — a real gap, not a
// fabricated success. TODO: replace with actual per-format binary embedding once a library/spec
// for safe marker placement is chosen.
@Injectable()
export class WatermarkService {
  private readonly logger = new Logger(WatermarkService.name);

  recordTraceability(input: { customerId: bigint; orderId: bigint; designFileId: bigint }): void {
    this.logger.warn(
      `AC-10 stub: no binary watermark embedded — recording traceability only for designFileId=${input.designFileId}, ` +
        `orderId=${input.orderId}, customerId=${input.customerId}`,
    );
  }
}
