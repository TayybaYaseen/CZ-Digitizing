// AC-5 — "HTML branded template, includes an unsubscribe link where applicable". The internal
// notify() contract (packages/shared-types + notification.service.ts) only carries `title`/
// `message` strings per call — no per-type template variables exist to justify 19 bespoke
// hand-authored templates — so this is one shared branded wrapper reused for every
// NotificationType, not a template-per-type library. Swappable for a real templating engine later
// without touching EmailService or the dispatch pipeline.
export function wrapBrandedHtml(input: { title: string; message: string | null; unsubscribeUrl?: string }): string {
  const { title, message, unsubscribeUrl } = input;
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#111827;padding:20px 24px;">
                <span style="color:#ffffff;font-size:16px;font-weight:bold;">CZ Digitizing</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 12px;font-size:20px;">${escapeHtml(title)}</h1>
                ${message ? `<p style="margin:0;font-size:14px;line-height:1.5;color:#374151;">${escapeHtml(message)}</p>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} CZ Digitizing
                ${unsubscribeUrl ? ` &middot; <a href="${escapeHtml(unsubscribeUrl)}" style="color:#9ca3af;">Unsubscribe</a>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
