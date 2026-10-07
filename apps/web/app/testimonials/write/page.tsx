'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { REVIEW_LIMITS, type ApiError, type ReviewEligibilityDto, type ReviewableItemDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { inputClass } from '@/components/FormField';
import { clientError } from '@/i18n/api-errors';

const NEXT_PATH = '/testimonials/write';

// docs/specs/2026-10-06-22-customer-review-submission.md §6–§9/§17 (aspect A-026) — Write a Review.
// Guests get a login/register prompt that returns here; signed-in customers without a paid order or
// delivered custom request get an explanation; eligible customers get the form. The review is always
// stored Pending — this page never offers anything that could publish it.
export default function WriteReviewPage() {
  return (
    <Suspense>
      <WriteReview />
    </Suspense>
  );
}

function WriteReview() {
  const { user, isReady, accessToken } = useAuth();
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const [eligibility, setEligibility] = useState<ReviewEligibilityDto | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const isCustomer = user?.role === 'customer';

  useEffect(() => {
    if (!accessToken || !isCustomer) return;
    apiFetch<ReviewEligibilityDto>('/api/testimonials/mine/eligibility', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(setEligibility)
      .catch((err) => setLoadError(err instanceof ApiClientError ? err.error : clientError('reviews.loadFailed')));
  }, [accessToken, isCustomer]);

  if (!isReady) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('reviews.shareExperience')}</h1>
        <p className="mt-1 text-sm text-gray-600">{t('reviews.formIntro')}</p>
      </div>

      {!user ? (
        <Notice title={t('reviews.loginRequiredTitle')} body={t('reviews.loginRequiredBody')}>
          <Link href={`/login?next=${encodeURIComponent(NEXT_PATH)}`} className="rounded-md bg-brand-navy px-4 py-2 text-sm font-semibold text-white">
            {t('reviews.logIn')}
          </Link>
          <Link href={`/register?next=${encodeURIComponent(NEXT_PATH)}`} className="rounded-md border border-brand-navy px-4 py-2 text-sm font-semibold text-brand-navy">
            {t('reviews.createAccount')}
          </Link>
        </Notice>
      ) : !isCustomer ? (
        <Notice title={t('reviews.notEligibleTitle')} body={t('reviews.customersOnly')} />
      ) : submitted ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5" role="status" data-testid="review-submitted">
          <p className="font-semibold text-emerald-900">{t('reviews.submittedTitle')}</p>
          <p className="mt-1 text-sm text-emerald-800">{t('reviews.submittedBody')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/account/reviews" className="rounded-md bg-brand-navy px-4 py-2 text-sm font-semibold text-white">
              {t('reviews.viewMyReviews')}
            </Link>
            <Link href="/testimonials" className="rounded-md border border-brand-navy px-4 py-2 text-sm font-semibold text-brand-navy">
              {t('reviews.backToTestimonials')}
            </Link>
          </div>
        </div>
      ) : loadError ? (
        <ErrorBanner error={loadError} />
      ) : !eligibility ? (
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      ) : !eligibility.eligible ? (
        <Notice title={t('reviews.notEligibleTitle')} body={t('reviews.notEligibleBody')}>
          <Link href="/designs" className="rounded-md bg-brand-navy px-4 py-2 text-sm font-semibold text-white">
            {t('reviews.browseDesigns')}
          </Link>
          <Link href="/custom-request" className="rounded-md border border-brand-navy px-4 py-2 text-sm font-semibold text-brand-navy">
            {t('reviews.requestCustomDesign')}
          </Link>
        </Notice>
      ) : eligibility.pendingCount >= eligibility.pendingLimit ? (
        <Notice title={t('reviews.pendingLimitTitle')} body={t('reviews.pendingLimitBody', { count: eligibility.pendingCount })}>
          <Link href="/account/reviews" className="rounded-md bg-brand-navy px-4 py-2 text-sm font-semibold text-white">
            {t('reviews.viewMyReviews')}
          </Link>
        </Notice>
      ) : (
        <ReviewForm eligibility={eligibility} accessToken={accessToken} preselect={searchParams.get('order') ? `order:${searchParams.get('order')}` : searchParams.get('request') ? `custom_request:${searchParams.get('request')}` : ''} onSubmitted={() => setSubmitted(true)} />
      )}
    </div>
  );
}

function Notice({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5" data-testid="review-notice">
      <p className="font-semibold text-brand-navy">{title}</p>
      <p className="mt-1 text-sm text-gray-600">{body}</p>
      {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

type FieldKey = 'customerName' | 'serviceUsed' | 'feedback' | 'country' | 'image';

function ReviewForm({ eligibility, accessToken, preselect, onSubmitted }: { eligibility: ReviewEligibilityDto; accessToken: string | null; preselect: string; onSubmitted: () => void }) {
  const { t, fieldError } = useLocale();
  const router = useRouter();
  const openItems = useMemo(() => eligibility.items.filter((i) => !i.alreadyReviewed), [eligibility.items]);
  const initialLink = openItems.some((i) => `${i.kind}:${i.id}` === preselect) ? preselect : '';

  const [customerName, setCustomerName] = useState(eligibility.suggestedDisplayName ?? '');
  const [country, setCountry] = useState('');
  const [link, setLink] = useState(initialLink);
  const [serviceUsed, setServiceUsed] = useState(() => openItems.find((i) => `${i.kind}:${i.id}` === initialLink)?.serviceHint ?? '');
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey | 'rating', string>>>({});
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // The object URL is revoked whenever the photo changes and when the form unmounts (§9).
  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function itemLabel(item: ReviewableItemDto) {
    return item.kind === 'order' ? t('reviews.aboutOrder', { reference: item.reference }) : t('reviews.aboutCustomRequest', { reference: item.reference });
  }

  function onLinkChange(value: string) {
    setLink(value);
    const hint = openItems.find((i) => `${i.kind}:${i.id}` === value)?.serviceHint;
    if (hint && !serviceUsed.trim()) setServiceUsed(hint);
  }

  function onPickFile(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    if (!REVIEW_LIMITS.imageMimeTypes.includes(file.type)) {
      setErrors((e) => ({ ...e, image: t('reviews.photoTypeError') }));
      return;
    }
    if (file.size > REVIEW_LIMITS.imageMaxBytes) {
      setErrors((e) => ({ ...e, image: t('reviews.photoSizeError') }));
      return;
    }
    setErrors((e) => ({ ...e, image: undefined }));
    setImage(file);
  }

  function validate() {
    const next: typeof errors = {};
    const name = customerName.trim();
    if (name.length < REVIEW_LIMITS.displayNameMin || name.length > REVIEW_LIMITS.displayNameMax) next.customerName = t('reviews.displayNameError', { min: REVIEW_LIMITS.displayNameMin, max: REVIEW_LIMITS.displayNameMax });
    const service = serviceUsed.trim();
    if (service.length < REVIEW_LIMITS.serviceUsedMin || service.length > REVIEW_LIMITS.serviceUsedMax) next.serviceUsed = t('reviews.serviceUsedError');
    if (country.trim().length > REVIEW_LIMITS.countryMax) next.country = t('reviews.countryError', { max: REVIEW_LIMITS.countryMax });
    if (rating < 1 || rating > 5) next.rating = t('reviews.ratingError');
    const text = feedback.trim();
    if (text.length < REVIEW_LIMITS.feedbackMin) next.feedback = t('reviews.reviewTooShort', { min: REVIEW_LIMITS.feedbackMin });
    else if (text.length > REVIEW_LIMITS.feedbackMax) next.feedback = t('reviews.reviewTooLong', { max: REVIEW_LIMITS.feedbackMax });
    setErrors(next);
    return Object.values(next).every((v) => !v);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !accessToken || !validate()) return;
    setBusy(true);
    setApiError(null);
    try {
      const form = new FormData();
      form.append('customerName', customerName.trim());
      if (country.trim()) form.append('country', country.trim());
      form.append('serviceUsed', serviceUsed.trim());
      form.append('rating', String(rating));
      form.append('feedback', feedback.trim());
      const [kind, id] = link.split(':');
      if (kind === 'order' && id) form.append('orderId', id);
      if (kind === 'custom_request' && id) form.append('customRequestId', id);
      if (image) form.append('image', image);
      await apiFetch('/api/testimonials/submit', { method: 'POST', body: form, headers: { Authorization: `Bearer ${accessToken}` } });
      onSubmitted();
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err instanceof ApiClientError && err.error.code === 'UNAUTHENTICATED') router.replace(`/login?next=${encodeURIComponent(NEXT_PATH)}`);
      // ErrorBanner deliberately skips VALIDATION_ERROR, so server field errors are shown inline.
      if (err instanceof ApiClientError && err.error.code === 'VALIDATION_ERROR') {
        const inline: typeof errors = {};
        for (const e of err.error.errors ?? []) {
          if (['customerName', 'serviceUsed', 'feedback', 'country', 'rating', 'image'].includes(e.field)) inline[e.field as FieldKey | 'rating'] = fieldError(e.message);
        }
        if (Object.keys(inline).length > 0) {
          setErrors(inline);
          return;
        }
        setApiError(clientError('reviews.submitFailed'));
        return;
      }
      setApiError(err instanceof ApiClientError ? err.error : clientError('reviews.submitFailed'));
    } finally {
      setBusy(false);
    }
  }

  const textLength = feedback.trim().length;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-lg border border-gray-200 bg-white p-4 sm:p-6" data-testid="review-form">
      <ErrorBanner error={apiError} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="review-name" label={t('reviews.displayName')} help={t('reviews.displayNameHelp')} error={errors.customerName}>
          <input id="review-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={REVIEW_LIMITS.displayNameMax} autoComplete="name" className={inputClass} />
        </Field>
        <Field id="review-country" label={`${t('reviews.country')} (${t('reviews.optional')})`} error={errors.country}>
          <input id="review-country" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={REVIEW_LIMITS.countryMax} autoComplete="country-name" className={inputClass} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="review-about" label={`${t('reviews.about')} (${t('reviews.optional')})`}>
          <select id="review-about" value={link} onChange={(e) => onLinkChange(e.target.value)} className={inputClass}>
            <option value="">{t('reviews.aboutGeneral')}</option>
            {openItems.map((item) => (
              <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>
                {itemLabel(item)}
                {item.serviceHint ? ` — ${item.serviceHint}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field id="review-service" label={t('reviews.serviceUsed')} error={errors.serviceUsed}>
          <input id="review-service" value={serviceUsed} onChange={(e) => setServiceUsed(e.target.value)} maxLength={REVIEW_LIMITS.serviceUsedMax} placeholder={t('reviews.serviceUsedPlaceholder')} className={inputClass} />
        </Field>
      </div>

      <fieldset>
        <legend className="block text-[13px] font-medium text-slate-700">{t('reviews.rating')}</legend>
        <StarInput value={rating} onChange={setRating} />
        {errors.rating && <p className="mt-1 text-sm text-red-600">{errors.rating}</p>}
      </fieldset>

      <Field id="review-text" label={t('reviews.yourReview')} error={errors.feedback}>
        <textarea
          id="review-text"
          dir="auto"
          rows={6}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          maxLength={REVIEW_LIMITS.feedbackMax}
          placeholder={t('reviews.reviewPlaceholder')}
          className={`${inputClass} h-auto py-2.5`}
        />
        <p className={`text-end text-xs ${textLength > 0 && textLength < REVIEW_LIMITS.feedbackMin ? 'text-amber-700' : 'text-gray-400'}`} aria-live="polite">
          {t('reviews.characterCount', { count: textLength, max: REVIEW_LIMITS.feedbackMax })}
        </p>
      </Field>

      <div className="space-y-2">
        <p className="text-[13px] font-medium text-slate-700">
          {t('reviews.photo')} <span className="font-normal text-gray-500">({t('reviews.optional')})</span>
        </p>
        <input ref={fileInput} id="review-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onPickFile(e.target.files?.[0])} data-testid="review-photo-input" />
        {preview ? (
          <div className="space-y-2">
            <div className="flex aspect-[4/3] w-full max-w-sm items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt={t('reviews.photoPreviewAlt')} className="max-h-full max-w-full object-contain" data-testid="review-photo-preview" />
            </div>
            <div className="flex flex-wrap gap-2">
              <label htmlFor="review-photo" className="cursor-pointer rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-brand-navy hover:bg-gray-50">
                {t('reviews.changePhoto')}
              </label>
              <button type="button" onClick={() => setImage(null)} className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50" data-testid="review-photo-remove">
                {t('reviews.removePhoto')}
              </button>
            </div>
          </div>
        ) : (
          <label htmlFor="review-photo" className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-gray-300 px-4 py-6 text-center hover:border-brand-navy">
            <span className="text-sm font-semibold text-brand-navy">{t('reviews.addPhoto')}</span>
            <span className="text-xs text-gray-500">{t('reviews.photoHelp')}</span>
          </label>
        )}
        {errors.image && <p className="text-sm text-red-600" role="alert">{errors.image}</p>}
      </div>

      <p className="text-xs text-gray-500">{t('reviews.moderationNote')}</p>

      <button type="submit" disabled={busy} className="h-11 w-full rounded-lg bg-brand-navy px-4 text-[14.5px] font-semibold text-white hover:bg-brand-navyLight disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8">
        {busy ? t('reviews.submitting') : t('reviews.submit')}
      </button>
    </form>
  );
}

function Field({ id, label, help, error, children }: { id: string; label: string; help?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-slate-700">
        {label}
      </label>
      {children}
      {help && <p className="text-xs text-gray-500">{help}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// §7 — accessible 1–5 star radio group. The flex row follows the document direction, so it reads
// right-to-left in Urdu/Arabic automatically.
function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useLocale();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="mt-1 flex gap-1" role="radiogroup" aria-label={t('reviews.rating')} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
          <input type="radio" name="review-rating" value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" aria-label={t('reviews.starsLabel', { count: n })} />
          <span className={`block rounded px-0.5 text-3xl leading-none peer-focus-visible:ring-2 peer-focus-visible:ring-brand-gold ${n <= shown ? 'text-gold-500' : 'text-gray-300'}`} aria-hidden="true">
            ★
          </span>
        </label>
      ))}
    </div>
  );
}
