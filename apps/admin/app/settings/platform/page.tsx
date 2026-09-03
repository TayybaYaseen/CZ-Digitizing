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
type PaymentMethodKey = (typeof PAYMENT_METHODS)[number];

// Non-secret display config per method (spec §4/§8 risk #2) — shown to the customer at checkout
// (bank_transfer via GET /api/settings/public's bankTransferConfig) or kept here purely for
// Admin's own reference. Real API credentials (PayPal client id/secret, Stripe secret key) are
// never entered here — those stay in server .env and are never editable from this screen.
const PAYMENT_METHOD_FIELDS: Record<PaymentMethodKey, { key: string; label: string }[]> = {
  paypal: [{ key: 'accountEmail', label: 'PayPal business account email' }],
  bank_transfer: [
    { key: 'bankName', label: 'Bank name' },
    { key: 'accountTitle', label: 'Account title' },
    { key: 'accountNumber', label: 'Account number' },
    { key: 'iban', label: 'IBAN (optional)' },
  ],
  credit_card: [{ key: 'statementDescriptor', label: 'Statement / merchant display name' }],
};

function emptyConfig(method: PaymentMethodKey): Record<string, string> {
  return Object.fromEntries(PAYMENT_METHOD_FIELDS[method].map((f) => [f.key, '']));
}

export default function PlatformSettingsPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [settings, setSettings] = useState<SettingsDto | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<Record<string, boolean>>({});
  const [paymentConfigs, setPaymentConfigs] = useState<Record<PaymentMethodKey, Record<string, string>>>({
    paypal: emptyConfig('paypal'),
    bank_transfer: emptyConfig('bank_transfer'),
    credit_card: emptyConfig('credit_card'),
  });

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
      setPaymentConfigs({
        paypal: { ...emptyConfig('paypal'), ...(dto.paymentMethods.find((m) => m.method === 'paypal')?.config as Record<string, string> | undefined) },
        bank_transfer: {
          ...emptyConfig('bank_transfer'),
          ...(dto.paymentMethods.find((m) => m.method === 'bank_transfer')?.config as Record<string, string> | undefined),
        },
        credit_card: {
          ...emptyConfig('credit_card'),
          ...(dto.paymentMethods.find((m) => m.method === 'credit_card')?.config as Record<string, string> | undefined),
        },
      });
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
      methods: PAYMENT_METHODS.map((method) => ({
        method,
        isEnabled: !!paymentMethods[method],
        config: paymentConfigs[method],
      })),
    });
  }

  // Clears a method's details locally — takes effect once "Save payment methods" is pressed,
  // same as every other edit on this screen, rather than deleting on click (no separate
  // delete endpoint exists; PUT with an emptied config is how "delete" is expressed here).
  function onClearConfig(method: PaymentMethodKey) {
    setPaymentConfigs((prev) => ({ ...prev, [method]: emptyConfig(method) }));
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

            {PAYMENT_METHODS.filter((method) => paymentMethods[method]).map((method) => (
              <div key={method} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">{method.replace('_', ' ')} details</p>
                  <button
                    type="button"
                    onClick={() => onClearConfig(method)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Clear details
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  {method === 'bank_transfer'
                    ? 'Shown to the customer at checkout so they know where to send the transfer — not secret.'
                    : 'For your own reference only. Real API credentials (client id/secret, secret key) are configured separately via server environment variables, never here.'}
                </p>
                {PAYMENT_METHOD_FIELDS[method].map((field) => (
                  <FormField key={field.key} label={field.label} htmlFor={`${method}-${field.key}`}>
                    <input
                      id={`${method}-${field.key}`}
                      className={inputClass}
                      value={paymentConfigs[method][field.key] ?? ''}
                      onChange={(e) =>
                        setPaymentConfigs((prev) => ({ ...prev, [method]: { ...prev[method], [field.key]: e.target.value } }))
                      }
                    />
                  </FormField>
                ))}
              </div>
            ))}

            <button type="button" onClick={onSavePaymentMethods} className={`${submitButtonClass} mt-3`}>
              Save payment methods
            </button>
          </Card>
        </>
      )}
    </div>
  );
}
