'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { Card } from '@/components/ui/Card';

// Mirrors apps/api/src/settings/dto/settings.dto.ts's SettingsDto.
interface SettingsDto {
  whatsappNumber: string | null;
  contactEmail: string | null;
  domain: string | null;
  social: { facebook?: string; instagram?: string; linkedIn?: string; xTwitter?: string; youTube?: string };
  experienceStartYear: number;
  paymentMethods: { method: string; isEnabled: boolean; config: Record<string, unknown> | null }[];
}

const urlOrEmpty = z.string().url('must be a valid URL').or(z.literal('')).optional();

const contactSchema = z.object({
  whatsappNumber: z.string().min(1, 'required').max(32),
  contactEmail: z.string().email('must be an email'),
});
const socialSchema = z.object({
  facebookUrl: urlOrEmpty,
  instagramUrl: urlOrEmpty,
  linkedinUrl: urlOrEmpty,
  xTwitterUrl: urlOrEmpty,
  youtubeUrl: urlOrEmpty,
});
const experienceSchema = z.object({
  experienceStartYear: z.coerce.number().int().min(1990).max(2100),
});
const domainSchema = z.object({
  domain: z.string().min(1, 'required').max(255),
});

type ContactValues = z.infer<typeof contactSchema>;
type SocialValues = z.infer<typeof socialSchema>;
type ExperienceValues = z.infer<typeof experienceSchema>;
type DomainValues = z.infer<typeof domainSchema>;

const PAYMENT_METHODS = ['paypal', 'bank_transfer', 'credit_card'] as const;

export default function PlatformSettingsPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [settings, setSettings] = useState<SettingsDto | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<Record<string, boolean>>({});

  const contactForm = useForm<ContactValues>({ resolver: zodResolver(contactSchema) });
  const socialForm = useForm<SocialValues>({ resolver: zodResolver(socialSchema) });
  const experienceForm = useForm<ExperienceValues>({ resolver: zodResolver(experienceSchema) });
  const domainForm = useForm<DomainValues>({ resolver: zodResolver(domainSchema) });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoadError(null);
    try {
      const dto = await apiFetch<SettingsDto>('/api/admin/settings', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setSettings(dto);
      contactForm.reset({ whatsappNumber: dto.whatsappNumber ?? '', contactEmail: dto.contactEmail ?? '' });
      socialForm.reset({
        facebookUrl: dto.social.facebook ?? '',
        instagramUrl: dto.social.instagram ?? '',
        linkedinUrl: dto.social.linkedIn ?? '',
        xTwitterUrl: dto.social.xTwitter ?? '',
        youtubeUrl: dto.social.youTube ?? '',
      });
      experienceForm.reset({ experienceStartYear: dto.experienceStartYear });
      domainForm.reset({ domain: dto.domain ?? '' });
      setPaymentMethods(Object.fromEntries(dto.paymentMethods.map((m) => [m.method, m.isEnabled])));
    } catch (err) {
      setLoadError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load settings.', traceId: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (!isReady) return; // still checking localStorage — don't redirect prematurely
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
  }, [isReady, user, load, router]);

  async function save<T>(path: string, body: T) {
    setSaveError(null);
    setSuccessMessage(null);
    try {
      const dto = await apiFetch<SettingsDto>(path, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      setSettings(dto);
      setSuccessMessage('Saved.');
      return true;
    } catch (err) {
      setSaveError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save.', traceId: '' });
      return false;
    }
  }

  async function onSavePaymentMethods() {
    await save('/api/admin/settings/payment-methods', {
      methods: PAYMENT_METHODS.map((method) => ({ method, isEnabled: !!paymentMethods[method] })),
    });
  }

  if (!isReady || !user) return null; // still checking localStorage, or redirecting to /login

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Platform settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Changes here propagate immediately to every public location (footer, Contact page, WhatsApp links).
        </p>
      </div>

      <ErrorBanner error={loadError} />
      {successMessage && <SuccessBanner message={successMessage} />}
      <ErrorBanner error={saveError} />

      {settings === null && !loadError ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-card bg-white shadow-cz-sm" />
          ))}
        </div>
      ) : settings === null ? null : (
        <>
          <Card title="Contact (AC-1)">
            <form
              onSubmit={contactForm.handleSubmit((v) => save('/api/admin/settings/contact', v))}
              className="space-y-3"
              noValidate
            >
              <FormField label="WhatsApp number" htmlFor="whatsappNumber" error={contactForm.formState.errors.whatsappNumber}>
                <input id="whatsappNumber" className={inputClass} {...contactForm.register('whatsappNumber')} />
              </FormField>
              <FormField label="Contact email" htmlFor="contactEmail" error={contactForm.formState.errors.contactEmail}>
                <input id="contactEmail" type="email" className={inputClass} {...contactForm.register('contactEmail')} />
              </FormField>
              <button type="submit" disabled={contactForm.formState.isSubmitting} className={submitButtonClass}>
                Save contact
              </button>
            </form>
          </Card>

          <Card title="Social links (AC-3)">
            <p className="mb-3 text-xs text-gray-500">Leave a field empty to hide its icon everywhere.</p>
            <form
              onSubmit={socialForm.handleSubmit((v) => save('/api/admin/settings/social', v))}
              className="space-y-3"
              noValidate
            >
              <FormField label="Facebook" htmlFor="facebookUrl" error={socialForm.formState.errors.facebookUrl}>
                <input id="facebookUrl" className={inputClass} {...socialForm.register('facebookUrl')} />
              </FormField>
              <FormField label="Instagram" htmlFor="instagramUrl" error={socialForm.formState.errors.instagramUrl}>
                <input id="instagramUrl" className={inputClass} {...socialForm.register('instagramUrl')} />
              </FormField>
              <FormField label="LinkedIn" htmlFor="linkedinUrl" error={socialForm.formState.errors.linkedinUrl}>
                <input id="linkedinUrl" className={inputClass} {...socialForm.register('linkedinUrl')} />
              </FormField>
              <FormField label="X / Twitter" htmlFor="xTwitterUrl" error={socialForm.formState.errors.xTwitterUrl}>
                <input id="xTwitterUrl" className={inputClass} {...socialForm.register('xTwitterUrl')} />
              </FormField>
              <FormField label="YouTube" htmlFor="youtubeUrl" error={socialForm.formState.errors.youtubeUrl}>
                <input id="youtubeUrl" className={inputClass} {...socialForm.register('youtubeUrl')} />
              </FormField>
              <button type="submit" disabled={socialForm.formState.isSubmitting} className={submitButtonClass}>
                Save social links
              </button>
            </form>
          </Card>

          <Card title="Experience counter (AC-4)">
            <p className="mb-3 text-xs text-gray-500">
              Years of experience is computed automatically each year — set only the start year.
            </p>
            <form
              onSubmit={experienceForm.handleSubmit((v) => save('/api/admin/settings/experience', v))}
              className="space-y-3"
              noValidate
            >
              <FormField
                label="Experience start year"
                htmlFor="experienceStartYear"
                error={experienceForm.formState.errors.experienceStartYear}
              >
                <input id="experienceStartYear" type="number" className={inputClass} {...experienceForm.register('experienceStartYear')} />
              </FormField>
              <button type="submit" disabled={experienceForm.formState.isSubmitting} className={submitButtonClass}>
                Save experience start year
              </button>
            </form>
          </Card>

          <Card title="Domain (AC-11)">
            <form
              onSubmit={domainForm.handleSubmit((v) => save('/api/admin/settings/domain', v))}
              className="space-y-3"
              noValidate
            >
              <FormField label="Domain" htmlFor="domain" error={domainForm.formState.errors.domain}>
                <input id="domain" className={inputClass} placeholder="czdigitizing.com" {...domainForm.register('domain')} />
              </FormField>
              <button type="submit" disabled={domainForm.formState.isSubmitting} className={submitButtonClass}>
                Save domain
              </button>
            </form>
          </Card>

          <Card title="Payment methods (AC-2)">
            <p className="mb-3 text-xs text-gray-500">
              Enabling/disabling a method affects the next checkout only — past orders keep the details active
              at the time of that order.
            </p>
            <div className="space-y-2">
              {PAYMENT_METHODS.map((method) => (
                <label key={method} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!paymentMethods[method]}
                    onChange={(e) => setPaymentMethods((prev) => ({ ...prev, [method]: e.target.checked }))}
                  />
                  {method.replace('_', ' ')}
                </label>
              ))}
            </div>
            <button type="button" onClick={onSavePaymentMethods} className={`${submitButtonClass} mt-3`}>
              Save payment methods
            </button>
          </Card>
        </>
      )}
    </div>
  );
}
