'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError, CustomRequestDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { clientError } from '@/i18n/api-errors';
import { useLocale } from '@/lib/locale-context';

type FormState = { requestType: string; sizeValue: string; machineFormat: string; fabricType: string; specialInstructions: string };

const DRAFT_KEY = 'czd.customRequest.draft';

// docs/specs/2026-08-28-12-custom-design-requests.md AC-1 — customer_id is NOT NULL in the
// architecture DDL, so submission itself still requires an account. Rather than gate the whole
// page behind a login redirect (the customize form used to be invisible to a guest until they'd
// already logged in — the exact UX gap Admin asked to fix), the form is always shown; login is
// only required at the Submit step, matching a "guest checkout, account needed to pay" pattern.
// Text fields (not the file inputs — browsers refuse to persist File objects across a navigation)
// survive the login/register round trip via sessionStorage, restored on the way back so a guest
// doesn't have to retype everything after authenticating.
export default function CustomRequestPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const { t, rich } = useLocale();

  const [form, setForm] = useState<FormState>({ requestType: 'embroidery_custom', sizeValue: '', machineFormat: '', fabricType: '', specialInstructions: '' });
  const [image, setImage] = useState<File | null>(null);
  const [references, setReferences] = useState<File[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<CustomRequestDto | null>(null);
  const [restoredNotice, setRestoredNotice] = useState(false);

  // Runs once: if a guest was bounced to login/register from here, restore what they'd typed.
  useEffect(() => {
    const saved = window.sessionStorage.getItem(DRAFT_KEY);
    if (!saved) return;
    window.sessionStorage.removeItem(DRAFT_KEY);
    try {
      setForm(JSON.parse(saved) as FormState);
      setRestoredNotice(true);
    } catch {
      // Ignore a corrupted/unexpected draft rather than blocking the page over it.
    }
  }, []);

  async function onSubmit() {
    setError(null);
    if (!form.machineFormat.trim()) {
      // Not VALIDATION_ERROR: ErrorBanner hides that code (reserved for inline field errors), so
      // the required-format message never actually appeared.
      setError(clientError('errors.machineFormatRequired'));
      return;
    }
    if (!isReady) return;
    if (!user) {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      router.push('/login?next=/custom-request');
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('requestType', form.requestType);
      if (form.sizeValue) body.append('sizeValue', form.sizeValue);
      body.append('machineFormat', form.machineFormat);
      if (form.fabricType) body.append('fabricType', form.fabricType);
      if (form.specialInstructions) body.append('specialInstructions', form.specialInstructions);
      if (image) body.append('image', image);
      for (const ref of references) body.append('references', ref);

      const created = await apiFetch<CustomRequestDto>('/api/custom-requests', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body });
      setSubmitted(created);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : clientError('errors.submitCustomRequestFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl space-y-3 text-center">
        <h1 className="text-2xl font-bold">{t('customRequest.receivedTitle')}</h1>
        <p className="text-sm text-gray-600">
          {rich('customRequest.receivedBody', { num: () => <span className="font-medium">#{submitted.requestNumber}</span> })}
        </p>
        <a href="/account/custom-requests" className="inline-block text-brand-navy underline">
          {t('customRequest.trackIt')}
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('customRequest.title')}</h1>
        <p className="mt-1 text-sm text-gray-600">{t('customRequest.subtitle')}</p>
      </div>

      {restoredNotice && <p className="rounded-md bg-brand-lightGray px-3 py-2 text-sm text-gray-700">{t('customRequest.restored')}</p>}
      {!user && isReady && <p className="text-sm text-gray-500">{t('customRequest.guestNotice')}</p>}

      <ErrorBanner error={error} />

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="text-sm font-medium">{t('customRequest.requestType')}</label>
          <select
            value={form.requestType}
            onChange={(e) => setForm({ ...form, requestType: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="embroidery_custom">{t('services.embroideryDigitizing')}</option>
            <option value="vector_custom">Vector Art</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">{t('customRequest.artwork')} *</label>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
        </div>

        <div>
          <label className="text-sm font-medium">{t('customRequest.references')}</label>
          <input type="file" multiple accept="image/*" onChange={(e) => setReferences(Array.from(e.target.files ?? []))} className="mt-1 block w-full text-sm" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input placeholder={t('customRequest.sizePlaceholder')} aria-label={t('quote.size')} value={form.sizeValue} onChange={(e) => setForm({ ...form, sizeValue: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input placeholder={t('customRequest.formatPlaceholder')} aria-label={t('customRequest.machineFormat')} value={form.machineFormat} onChange={(e) => setForm({ ...form, machineFormat: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input placeholder={t('customRequest.fabricPlaceholder')} aria-label={t('quote.fabric')} value={form.fabricType} onChange={(e) => setForm({ ...form, fabricType: e.target.value })} className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <textarea
          placeholder={t('customRequest.instructions')}
          aria-label={t('customRequest.instructions')}
          value={form.specialInstructions}
          onChange={(e) => setForm({ ...form, specialInstructions: e.target.value })}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          rows={4}
        />

        <button onClick={onSubmit} disabled={submitting} className="rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy hover:brightness-110 disabled:opacity-50">
          {submitting ? t('common.submitting') : user ? t('customRequest.submit') : t('customRequest.continueToSignIn')}
        </button>
      </form>
    </div>
  );
}
