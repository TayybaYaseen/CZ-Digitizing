'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { clientError } from '@/i18n/api-errors';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/locale-context';

interface PublicSettings {
  whatsappNumber: string | null;
  contactEmail: string | null;
  social: { facebook?: string; instagram?: string; linkedIn?: string; xTwitter?: string; youTube?: string };
}

const SOCIAL_LINKS: { key: keyof PublicSettings['social']; label: string }[] = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'linkedIn', label: 'LinkedIn' },
  { key: 'xTwitter', label: 'X / Twitter' },
  { key: 'youTube', label: 'YouTube' },
];

// SRS §15 (Contact Us, aspect A-010). No dedicated spec file — see apps/api/src/contact's
// contact.service.ts doc comment for why. Reuses the same GET /api/settings/public call
// Footer.tsx already makes (A-005a) for WhatsApp/email/social, so both surfaces stay in sync.
export default function ContactPage() {
  const { t, rich, errorMessage } = useLocale();
  const { user } = useAuth();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiFetch<PublicSettings>('/api/settings/public').then(setSettings).catch(() => setSettings(null));
  }, []);

  const whatsappHref = settings?.whatsappNumber ? `https://wa.me/${settings.whatsappNumber.replace(/[^\d]/g, '')}` : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch<void>('/api/contact', { method: 'POST', body: JSON.stringify({ name, email, message }) });
      setSubmitted(true);
      setName('');
      setEmail('');
      setMessage('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : clientError('errors.sendContactFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-brand-navy">{t('nav.contactUs')}</h1>
      <p className="mt-2 text-sm text-gray-600">{t('contact.subtitle')}</p>

      <div className="mt-8 grid gap-10 sm:grid-cols-2">
        <section aria-label={t('contact.directOptions')} className="space-y-3">
          {/* A-025 — signed-in customers can chat with the team instead of the one-way form (spec §8.1). */}
          {user?.role === 'customer' && (
            <p className="text-sm text-brand-navy">
              {rich('supportChat.preferChat', {
                link: (chunk) => (
                  <Link href="/account/support/new" className="font-semibold underline">
                    {chunk}
                  </Link>
                ),
              })}
            </p>
          )}
          {settings?.contactEmail && (
            <a href={`mailto:${settings.contactEmail}`} className="block text-sm text-brand-navy hover:underline">
              {t('contact.emailLabel')} <span dir="ltr">{settings.contactEmail}</span>
            </a>
          )}
          {whatsappHref && (
            <a href={whatsappHref} target="_blank" rel="noreferrer" className="block text-sm text-brand-navy hover:underline">
              WhatsApp: <span dir="ltr">{settings?.whatsappNumber}</span>
            </a>
          )}
          {settings?.social && Object.values(settings.social).some(Boolean) && (
            <ul className="flex flex-wrap gap-4 pt-2 text-sm">
              {SOCIAL_LINKS.filter((s) => settings.social[s.key]).map((s) => (
                <li key={s.key}>
                  <a href={settings.social[s.key]} target="_blank" rel="noreferrer" className="text-brand-navy hover:underline">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label={t('contact.formLabel')}>
          {submitted ? (
            <p className="rounded border border-green-200 bg-green-50 p-4 text-sm text-green-800">{t('contact.success')}</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700">{t('common.name')}</label>
                <input id="contact-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700">{t('common.email')}</label>
                <input id="contact-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700">{t('common.message')}</label>
                <textarea id="contact-message" required maxLength={2000} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              {error && <p className="text-sm text-red-600">{errorMessage(error)}</p>}
              <button type="submit" disabled={submitting} className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {submitting ? t('common.sending') : t('contact.send')}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
