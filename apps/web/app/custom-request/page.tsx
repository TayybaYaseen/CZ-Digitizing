'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ApiError, CustomRequestDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';

// docs/specs/2026-08-28-12-custom-design-requests.md AC-1 — customer_id is NOT NULL in the
// architecture DDL (unlike Get a Quote's guest posture), so this route requires a logged-in
// customer, same as /account pages.
export default function CustomRequestPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();

  const [form, setForm] = useState({ requestType: 'embroidery_custom', sizeValue: '', machineFormat: '', fabricType: '', specialInstructions: '' });
  const [image, setImage] = useState<File | null>(null);
  const [references, setReferences] = useState<File[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<CustomRequestDto | null>(null);

  useEffect(() => {
    if (isReady && !user) router.replace('/login?next=/custom-request');
  }, [isReady, user, router]);

  if (!isReady || !user) return null;

  async function onSubmit() {
    setError(null);
    if (!form.machineFormat.trim()) {
      setError({ code: 'VALIDATION_ERROR', message: 'Machine format is required.', traceId: '' });
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
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Could not submit your custom request.', traceId: '' });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl space-y-3 text-center">
        <h1 className="text-2xl font-bold">Custom request received</h1>
        <p className="text-sm text-gray-600">
          Your request <span className="font-medium">#{submitted.requestNumber}</span> is in our review queue. We&apos;ll follow up with a quote soon.
        </p>
        <a href="/account/custom-requests" className="inline-block text-brand-navy underline">
          Track it in My Account
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Custom Design Request</h1>
        <p className="mt-1 text-sm text-gray-600">Upload your logo/artwork and tell us the details — we&apos;ll digitize or vectorize it and send you a quote.</p>
      </div>

      <ErrorBanner error={error} />

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="text-sm font-medium">Request type</label>
          <select
            value={form.requestType}
            onChange={(e) => setForm({ ...form, requestType: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="embroidery_custom">Embroidery digitizing</option>
            <option value="vector_custom">Vector art</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Logo / artwork *</label>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
        </div>

        <div>
          <label className="text-sm font-medium">Additional reference images</label>
          <input type="file" multiple accept="image/*" onChange={(e) => setReferences(Array.from(e.target.files ?? []))} className="mt-1 block w-full text-sm" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input placeholder="Size (e.g. 4x4in)" value={form.sizeValue} onChange={(e) => setForm({ ...form, sizeValue: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input placeholder="Machine format (e.g. DST) *" value={form.machineFormat} onChange={(e) => setForm({ ...form, machineFormat: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input placeholder="Fabric (optional)" value={form.fabricType} onChange={(e) => setForm({ ...form, fabricType: e.target.value })} className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <textarea
          placeholder="Special instructions"
          value={form.specialInstructions}
          onChange={(e) => setForm({ ...form, specialInstructions: e.target.value })}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          rows={4}
        />

        <button onClick={onSubmit} disabled={submitting} className="rounded-md bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy hover:brightness-110 disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
}
