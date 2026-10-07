'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { REVIEW_LIMITS, type AdminTestimonialDto, type ApiError, type TestimonialSource, type TestimonialStatus } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { API_URL } from '@/lib/api-url';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const schema = z.object({
  customerName: z.string().min(1, 'required').max(255),
  country: z.string().min(1, 'required'),
  business: z.string().optional(),
  photoUrl: z.string().url('must be a valid URL').optional().or(z.literal('')),
  rating: z.coerce.number().min(1).max(5),
  feedback: z.string().min(1, 'required'),
  serviceUsed: z.string().min(1, 'required'),
  isPublished: z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

type Tab = 'all' | TestimonialStatus;
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'published', label: 'Published' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'rejected', label: 'Rejected' },
];
const STATUS_BADGE: Record<TestimonialStatus, { tone: 'warning' | 'success' | 'neutral' | 'danger'; label: string }> = {
  pending: { tone: 'warning', label: 'Pending' },
  published: { tone: 'success', label: 'Published' },
  hidden: { tone: 'neutral', label: 'Hidden' },
  rejected: { tone: 'danger', label: 'Rejected' },
};

const errorOf = (err: unknown, fallback: string): ApiError =>
  err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: fallback, traceId: '' };

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-4/AC-5/AC-6/AC-7 (aspect A-012c), extended by
// docs/specs/2026-10-06-22-customer-review-submission.md §11–§13/§16 (aspect A-026): one moderation
// queue for both sources with status tabs, source filter and search; per-review approve / reject /
// hide / unhide / edit / delete and image management. Filtering is client-side over the full admin list.
export default function TestimonialsAdminPage() {
  return (
    <Suspense>
      <TestimonialsAdmin />
    </Suspense>
  );
}

function TestimonialsAdmin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, accessToken, isReady } = useAuth();
  const [testimonials, setTestimonials] = useState<AdminTestimonialDto[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.key === searchParams.get('status')) ? (searchParams.get('status') as Tab) : 'all'));
  const [source, setSource] = useState<'all' | TestimonialSource>('all');
  const [query, setQuery] = useState('');
  const defaultedTab = useRef(searchParams.has('status'));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { rating: 5, isPublished: true } });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      const list = await apiFetch<AdminTestimonialDto[]>('/api/testimonials/admin', { headers: { Authorization: `Bearer ${accessToken}` } });
      setTestimonials(list);
      // §13 — open on Pending when there is something to moderate (unless the URL chose a tab).
      if (!defaultedTab.current) {
        defaultedTab.current = true;
        if (list.some((t) => t.status === 'pending')) setTab('pending');
      }
    } catch (err) {
      setListError(errorOf(err, 'Failed to load testimonials.'));
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
  }, [isReady, user, load, router]);

  function selectTab(next: Tab) {
    setTab(next);
    router.replace(next === 'all' ? '/testimonials' : `/testimonials?status=${next}`, { scroll: false });
  }

  // Replaces one row in place after an action, so the list doesn't jump.
  const applyRow = useCallback((row: AdminTestimonialDto) => setTestimonials((list) => list?.map((t) => (t.id === row.id ? row : t)) ?? null), []);
  const dropRow = useCallback((id: string) => setTestimonials((list) => list?.filter((t) => t.id !== id) ?? null), []);

  async function onSubmit(values: FormValues) {
    setApiError(null);
    setSuccessMessage(null);
    try {
      await apiFetch('/api/testimonials', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ ...values, business: values.business || undefined, photoUrl: values.photoUrl || undefined }),
      });
      setSuccessMessage('Testimonial created.');
      reset({ customerName: '', country: '', business: '', photoUrl: '', rating: 5, feedback: '', serviceUsed: '', isPublished: true });
      load();
    } catch (err) {
      setApiError(errorOf(err, 'Failed to save testimonial.'));
    }
  }

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: 0, pending: 0, published: 0, hidden: 0, rejected: 0 };
    for (const t of testimonials ?? []) {
      if (source !== 'all' && t.source !== source) continue;
      c.all++;
      c[t.status]++;
    }
    return c;
  }, [testimonials, source]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (testimonials ?? []).filter(
      (t) =>
        (tab === 'all' || t.status === tab) &&
        (source === 'all' || t.source === source) &&
        (!q || [t.customerName, t.customerEmail ?? '', t.feedback, t.serviceUsed].some((v) => v.toLowerCase().includes(q))),
    );
  }, [testimonials, tab, source, query]);

  if (!isReady || !user) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Testimonials</h1>
        <p className="mt-1 text-sm text-gray-500">
          {testimonials?.length ?? 0} total · {counts.pending} pending moderation
        </p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}

      <Card padding="p-4">
        <div className="space-y-3">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Review status">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => selectTab(t.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${tab === t.key ? 'bg-navy-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                data-testid={`tab-${t.key}`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 text-xs ${t.key === 'pending' && counts.pending > 0 ? 'bg-gold-500 text-navy-800' : tab === t.key ? 'bg-white/20' : 'bg-white text-gray-600'}`}>{counts[t.key]}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, text or service" aria-label="Search reviews" className={`${inputClass} sm:flex-1`} />
            <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} aria-label="Source" className={`${inputClass} sm:w-48`}>
              <option value="all">All sources</option>
              <option value="customer_submitted">Customer reviews</option>
              <option value="admin_curated">Admin-curated</option>
            </select>
          </div>
        </div>
      </Card>

      {testimonials === null && !listError ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-card border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">No reviews match this view.</p>
      ) : (
        <ul className="space-y-3" data-testid="review-list">
          {visible.map((t) => (
            <ReviewItem key={t.id} review={t} accessToken={accessToken} onChanged={applyRow} onDeleted={dropRow} onError={setListError} onNotice={setSuccessMessage} />
          ))}
        </ul>
      )}

      <Card title="Create testimonial">
        {/* AC-5 — content-governance rule, process-enforced, must be visible here. */}
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          ⚠ Only enter real customer testimonials. Never fabricate a customer name, country, or review — this is a
          content-governance rule, and every entry must reflect an actual customer.
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div className="grid gap-2 sm:grid-cols-2">
            <FormField label="Customer name" htmlFor="customerName" error={errors.customerName}>
              <input id="customerName" className={inputClass} {...register('customerName')} />
            </FormField>
            <FormField label="Country" htmlFor="country" error={errors.country}>
              <input id="country" className={inputClass} {...register('country')} />
            </FormField>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <FormField label="Business (optional)" htmlFor="business" error={errors.business}>
              <input id="business" className={inputClass} {...register('business')} />
            </FormField>
            <FormField label="Photo URL (optional)" htmlFor="photoUrl" error={errors.photoUrl}>
              <input id="photoUrl" className={inputClass} {...register('photoUrl')} />
            </FormField>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <FormField label="Rating (1-5)" htmlFor="rating" error={errors.rating}>
              <input id="rating" type="number" min={1} max={5} className={inputClass} {...register('rating')} />
            </FormField>
            <FormField label="Service used" htmlFor="serviceUsed" error={errors.serviceUsed}>
              <input id="serviceUsed" className={inputClass} {...register('serviceUsed')} />
            </FormField>
          </div>
          <FormField label="Feedback" htmlFor="feedback" error={errors.feedback}>
            <textarea id="feedback" rows={3} className={inputClass} {...register('feedback')} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('isPublished')} />
            Published
          </label>
          <ErrorBanner error={apiError} />
          <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
            Create testimonial
          </button>
        </form>
      </Card>
    </div>
  );
}

interface ItemProps {
  review: AdminTestimonialDto;
  accessToken: string | null;
  onChanged: (row: AdminTestimonialDto) => void;
  onDeleted: (id: string) => void;
  onError: (error: ApiError | null) => void;
  onNotice: (message: string | null) => void;
}

function ReviewItem({ review: t, accessToken, onChanged, onDeleted, onError, onNotice }: ItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const imageUrl = useAuthedImage(t.hasImage ? `/api/testimonials/admin/${t.id}/image` : null, accessToken, t.updatedAt);
  const fileInput = useRef<HTMLInputElement>(null);
  const auth = { Authorization: `Bearer ${accessToken}` };
  const badge = STATUS_BADGE[t.status];
  const edited = t.originalFeedback !== null && t.originalFeedback !== t.feedback;

  async function run(label: string, action: () => Promise<AdminTestimonialDto | void>) {
    setBusy(true);
    onError(null);
    onNotice(null);
    try {
      const row = await action();
      if (row) onChanged(row);
      onNotice(label);
    } catch (err) {
      onError(errorOf(err, `Could not complete: ${label.toLowerCase()}`));
    } finally {
      setBusy(false);
    }
  }

  const moderate = (decision: 'approved' | 'rejected') =>
    run(decision === 'approved' ? 'Review approved and published.' : 'Review rejected.', () =>
      apiFetch<AdminTestimonialDto>(`/api/testimonials/${t.id}/moderate`, { method: 'PUT', headers: auth, body: JSON.stringify({ decision }) }),
    );
  const setVisible = (isPublished: boolean) =>
    run(isPublished ? 'Review is visible again.' : 'Review hidden from the website.', () =>
      apiFetch<AdminTestimonialDto>(`/api/testimonials/${t.id}/visibility`, { method: 'PUT', headers: auth, body: JSON.stringify({ isPublished }) }),
    );

  async function remove() {
    if (!window.confirm('Permanently delete this review and its photo? This cannot be undone.\n\nTo take it down temporarily, use Hide instead.')) return;
    setBusy(true);
    onError(null);
    try {
      await apiFetch(`/api/testimonials/${t.id}`, { method: 'DELETE', headers: auth });
      onDeleted(t.id);
      onNotice('Review deleted.');
    } catch (err) {
      onError(errorOf(err, 'Could not delete the review.'));
    } finally {
      setBusy(false);
    }
  }

  function replaceImage(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    if (!REVIEW_LIMITS.imageMimeTypes.includes(file.type) || file.size > REVIEW_LIMITS.imageMaxBytes) {
      onError({ code: 'UNSUPPORTED_FILE_TYPE', message: 'Choose a JPEG, PNG or WebP image up to 5 MB.', traceId: '' });
      return;
    }
    const form = new FormData();
    form.append('image', file);
    run('Image updated.', () => apiFetch<AdminTestimonialDto>(`/api/testimonials/${t.id}/image`, { method: 'PUT', headers: auth, body: form }));
  }

  const removeImage = () => {
    if (!window.confirm('Remove this image from the review?')) return;
    run('Image removed.', () => apiFetch<AdminTestimonialDto>(`/api/testimonials/${t.id}/image`, { method: 'DELETE', headers: auth }));
  };

  return (
    <li className={`rounded-card border bg-white p-3 shadow-sm sm:p-4 ${t.status === 'pending' ? 'border-gold-500' : 'border-gray-200'}`} data-testid="review-item" data-status={t.status}>
      <div className="flex flex-wrap items-start gap-3">
        {imageUrl ? (
          <button type="button" onClick={() => setExpanded(true)} className="shrink-0" aria-label="View image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="h-16 w-16 rounded-md border border-gray-200 object-cover" />
          </button>
        ) : null}
        {/* basis-40: wraps under the thumbnail in narrow columns instead of shrinking to nothing. */}
        <div className="min-w-0 flex-1 basis-40">
          <div className="flex flex-wrap items-center gap-2">
            <p dir="auto" className="break-words font-semibold text-navy-800">{t.customerName}</p>
            <Badge tone={t.source === 'customer_submitted' ? 'info' : 'gold'}>{t.source === 'customer_submitted' ? 'Customer' : 'Admin'}</Badge>
            <Badge tone={badge.tone} dot>
              {t.source === 'admin_curated' && t.status === 'hidden' ? 'Hidden (draft)' : badge.label}
            </Badge>
          </div>
          <p className="mt-0.5 break-words text-xs text-gray-500">
            {t.customerEmail && (
              <>
                {t.customerId ? (
                  <Link href={`/customers/${t.customerId}`} className="underline">
                    {t.customerEmail}
                  </Link>
                ) : (
                  t.customerEmail
                )}
                {' · '}
              </>
            )}
            {t.orderNumber && <>Order #{t.orderNumber} · </>}
            {t.customRequestNumber && <>Request {t.customRequestNumber} · </>}
            Submitted {new Date(t.createdAt).toLocaleDateString()}
            {t.updatedAt !== t.createdAt && <> · Updated {new Date(t.updatedAt).toLocaleDateString()}</>}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm text-gold-600">
            {/* break-all: lets the star row wrap in the very narrow column the (non-responsive) admin shell leaves on phones. */}
            <span className="break-all" aria-label={`${t.rating} out of 5`}>
              {'★'.repeat(t.rating)}
              {'☆'.repeat(5 - t.rating)}
            </span>
            <span className="break-words text-xs text-gray-500">
              {t.serviceUsed}
              {t.country ? ` · ${t.country}` : ''}
              {t.business ? ` · ${t.business}` : ''}
            </span>
          </p>
          <p dir="auto" className={`mt-1 whitespace-pre-line break-words text-sm text-gray-700 ${expanded ? '' : 'line-clamp-3'}`}>
            {t.feedback}
          </p>
          {edited && <p className="mt-1 text-xs font-medium text-amber-700">Edited by Admin</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(t.status === 'pending' || t.status === 'rejected') && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => moderate('approved')} data-testid="action-approve">
            Approve &amp; publish
          </Button>
        )}
        {t.status === 'pending' && (
          <Button size="sm" variant="outlineNavy" disabled={busy} onClick={() => moderate('rejected')} data-testid="action-reject">
            Reject
          </Button>
        )}
        {t.status === 'published' && (
          <Button size="sm" variant="outlineNavy" disabled={busy} onClick={() => setVisible(false)} data-testid="action-hide">
            Hide
          </Button>
        )}
        {t.status === 'hidden' && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setVisible(true)} data-testid="action-unhide">
            Unhide
          </Button>
        )}
        <Button size="sm" variant="outlineNavy" disabled={busy} onClick={() => setExpanded((v) => !v)} data-testid="action-view">
          {expanded ? 'Collapse' : 'View'}
        </Button>
        <Button
          size="sm"
          variant="outlineNavy"
          disabled={busy}
          onClick={() => {
            setExpanded(true);
            setEditing(true);
          }}
          data-testid="action-edit"
        >
          Edit
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={remove} className="text-red-700 hover:bg-red-50" data-testid="action-delete">
          Delete
        </Button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
          {edited && (
            <details className="rounded-md bg-gray-50 p-3 text-sm" data-testid="original-text">
              <summary className="cursor-pointer font-medium text-gray-700">Original submission</summary>
              <p dir="auto" className="mt-2 whitespace-pre-line break-words text-gray-600">{t.originalFeedback}</p>
            </details>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Image</p>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={`Review image from ${t.customerName}`} className="max-h-96 max-w-full rounded-md border border-gray-200 object-contain" data-testid="admin-review-image" />
            ) : (
              <p className="text-sm text-gray-400">{t.hasImage ? 'Loading image…' : 'No image.'}</p>
            )}
            {t.imageOriginalFilename && <p className="break-all text-xs text-gray-400">Uploaded as {t.imageOriginalFilename}</p>}
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => replaceImage(e.target.files?.[0])} data-testid="admin-image-input" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outlineNavy" disabled={busy} onClick={() => fileInput.current?.click()}>
                {t.hasImage ? 'Replace image' : 'Add image'}
              </Button>
              {t.hasImage && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={removeImage} className="text-red-700 hover:bg-red-50" data-testid="action-remove-image">
                  Remove image
                </Button>
              )}
            </div>
          </div>

          {editing && (
            <EditForm
              review={t}
              accessToken={accessToken}
              onCancel={() => setEditing(false)}
              onSaved={(row) => {
                onChanged(row);
                setEditing(false);
                onNotice('Review updated.');
              }}
            />
          )}
        </div>
      )}
    </li>
  );
}

const editSchema = z.object({
  customerName: z.string().trim().min(1, 'required').max(255),
  country: z.string().trim().max(REVIEW_LIMITS.countryMax),
  business: z.string().trim().max(255),
  rating: z.coerce.number().int().min(1).max(5),
  serviceUsed: z.string().trim().min(1, 'required').max(REVIEW_LIMITS.serviceUsedMax),
  feedback: z.string().trim().min(1, 'required').max(REVIEW_LIMITS.feedbackMax),
});
type EditValues = z.infer<typeof editSchema>;

// §16 — editing never changes status; the customer's original text is preserved server-side.
function EditForm({ review, accessToken, onCancel, onSaved }: { review: AdminTestimonialDto; accessToken: string | null; onCancel: () => void; onSaved: (row: AdminTestimonialDto) => void }) {
  const [error, setError] = useState<ApiError | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      customerName: review.customerName,
      country: review.country ?? '',
      business: review.business ?? '',
      rating: review.rating,
      serviceUsed: review.serviceUsed,
      feedback: review.feedback,
    },
  });

  async function onSubmit(values: EditValues) {
    setError(null);
    try {
      const row = await apiFetch<AdminTestimonialDto>(`/api/testimonials/${review.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ ...values, country: values.country || null, business: values.business || undefined }),
      });
      onSaved(row);
    } catch (err) {
      setError(errorOf(err, 'Could not save the review.'));
    }
  }

  const id = (name: string) => `edit-${review.id}-${name}`;
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-md border border-gray-200 p-3" noValidate data-testid="edit-form">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Edit review</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <FormField label="Display name" htmlFor={id('name')} error={errors.customerName}>
          <input id={id('name')} className={inputClass} {...register('customerName')} />
        </FormField>
        <FormField label="Country" htmlFor={id('country')} error={errors.country}>
          <input id={id('country')} className={inputClass} {...register('country')} />
        </FormField>
        <FormField label="Business" htmlFor={id('business')} error={errors.business}>
          <input id={id('business')} className={inputClass} {...register('business')} />
        </FormField>
        <FormField label="Rating (1-5)" htmlFor={id('rating')} error={errors.rating}>
          <input id={id('rating')} type="number" min={1} max={5} className={inputClass} {...register('rating')} />
        </FormField>
      </div>
      <FormField label="Service used" htmlFor={id('service')} error={errors.serviceUsed}>
        <input id={id('service')} className={inputClass} {...register('serviceUsed')} />
      </FormField>
      <FormField label="Review text" htmlFor={id('feedback')} error={errors.feedback}>
        <textarea id={id('feedback')} rows={5} dir="auto" className={`${inputClass} h-auto`} {...register('feedback')} />
      </FormField>
      <ErrorBanner error={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant="secondary" disabled={isSubmitting} data-testid="edit-save">
          Save changes
        </Button>
        <Button type="button" size="sm" variant="outlineNavy" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// Review images are private until published, so Admin fetches them with the bearer token and shows
// them from an in-memory object URL — the same pattern as the A-013 receipt preview. `version`
// (the row's updatedAt) refetches after a replace.
function useAuthedImage(path: string | null, accessToken: string | null, version: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!path || !accessToken) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, accessToken, version]);
  return url;
}
