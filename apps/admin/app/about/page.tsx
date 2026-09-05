'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { AboutContentDto, ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Card } from '@/components/ui/Card';

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-11 (aspect A-012e). No publish step by
// design — saved content becomes active immediately.
export default function AboutAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [languageCode, setLanguageCode] = useState('en');
  const [heading, setHeading] = useState('');
  const [body, setBody] = useState('');
  const [imageUrlsText, setImageUrlsText] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(
    async (lang: string) => {
      if (!accessToken) return;
      setError(null);
      setLoaded(false);
      try {
        const content = await apiFetch<AboutContentDto>(`/api/about?language_code=${lang}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        setHeading(content.languageCode === lang ? content.heading : '');
        setBody(content.languageCode === lang ? content.body : '');
        setImageUrlsText(content.languageCode === lang ? content.imageUrls.join('\n') : '');
      } catch {
        setHeading('');
        setBody('');
        setImageUrlsText('');
      } finally {
        setLoaded(true);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    load(languageCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, user, router]);

  async function onSave() {
    setError(null);
    setSuccessMessage(null);
    setBusy(true);
    try {
      await apiFetch('/api/admin/about', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ languageCode, heading, body, imageUrls: imageUrlsText.split('\n').map((s) => s.trim()).filter(Boolean) }),
      });
      setSuccessMessage('Saved — live on the public site immediately.');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save.', traceId: '' });
    } finally {
      setBusy(false);
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">About Us</h1>
        <p className="mt-1 text-sm text-gray-500">Saves become live immediately — no publish step.</p>
      </div>

      <Card>
        <div className="space-y-3">
          <FormField label="Language code" htmlFor="languageCode">
            <input
              id="languageCode"
              className={`${inputClass} max-w-[8rem]`}
              value={languageCode}
              onChange={(e) => {
                setLanguageCode(e.target.value);
                load(e.target.value);
              }}
            />
          </FormField>
          {loaded && (
            <>
              <FormField label="Heading" htmlFor="heading">
                <input id="heading" className={inputClass} value={heading} onChange={(e) => setHeading(e.target.value)} />
              </FormField>
              <FormField label="Body" htmlFor="body">
                <RichTextEditor value={body} onChange={setBody} accessToken={accessToken} />
              </FormField>
              <FormField label="Image URLs (one per line)" htmlFor="imageUrls">
                <textarea id="imageUrls" rows={3} className={inputClass} value={imageUrlsText} onChange={(e) => setImageUrlsText(e.target.value)} />
              </FormField>
            </>
          )}
          {successMessage && <SuccessBanner message={successMessage} />}
          <ErrorBanner error={error} />
          <button type="button" disabled={busy || !loaded} onClick={onSave} className={submitButtonClass}>
            Save
          </button>
        </div>
      </Card>
    </div>
  );
}
