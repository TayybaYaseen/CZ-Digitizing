'use client';

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Mirrors apps/api/src/bundles/dto/bundle.dto.ts's BundleSummaryDto.
interface BundleSummaryDto {
  id: string;
  name: string;
  description: string | null;
  previewImageUrl: string | null;
  pricePkr: number;
  salePricePkr: number | null;
  isPublished: boolean;
}

const schema = z.object({
  name: z.string().min(1, 'required').max(255),
  description: z.string().optional(),
  previewImageUrl: z.string().url('must be a valid URL').optional().or(z.literal('')),
  pricePkr: z.coerce.number().min(0),
  salePricePkr: z.coerce.number().min(0).optional(),
  isPublished: z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

// docs/specs/2026-08-28-06-design-bundles.md AC-1 — admin bundle CRUD. Membership (which designs
// belong to a bundle, AC-1/AC-7) is managed on the nested /bundles/:id/designs page, same split
// as DesignsAdminPage → /designs/:id/files.
export default function BundlesAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [bundles, setBundles] = useState<BundleSummaryDto[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { isPublished: true } });
  const previewImageUrl = watch('previewImageUrl');
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<ApiError | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      const bundleList = await apiFetch<BundleSummaryDto[]>('/api/bundles?pageSize=50', { headers: { Authorization: `Bearer ${accessToken}` } });
      setBundles(bundleList);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load bundles.', traceId: '' });
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

  async function onImageSelected(fileList: FileList | null) {
    const file = fileList?.item(0);
    if (!file) return;
    setImageUploadError(null);
    setImageUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { url } = await apiFetch<{ url: string }>('/api/uploads/images', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      setValue('previewImageUrl', url, { shouldValidate: true });
    } catch (err) {
      setImageUploadError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Image upload failed.', traceId: '' });
    } finally {
      setImageUploading(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setApiError(null);
    setSuccessMessage(null);
    try {
      await apiFetch('/api/bundles', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          name: values.name,
          description: values.description || undefined,
          previewImageUrl: values.previewImageUrl || undefined,
          pricePkr: values.pricePkr,
          salePricePkr: values.salePricePkr,
          isPublished: values.isPublished,
        }),
      });
      setSuccessMessage(`Bundle "${values.name}" created.`);
      reset({ name: '', description: '', previewImageUrl: '', pricePkr: 0, salePricePkr: undefined, isPublished: true });
      if (imageInputRef.current) imageInputRef.current.value = '';
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to create bundle.', traceId: '' });
    }
  }

  async function onDelete(id: string) {
    try {
      await apiFetch(`/api/bundles/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy-800">Bundles</h1>
          <p className="mt-1 text-sm text-gray-500">{bundles?.length ?? 0} bundles (AC-1/AC-5)</p>
        </div>
        <Link href="/bundles/dynamic-rules">
          <Button variant="outlineNavy" size="sm">
            Dynamic rules
          </Button>
        </Link>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}
      <ErrorBanner error={apiError} />

      <Card padding="p-0">
        {bundles === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : bundles.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No bundles yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Image</th>
                <th className="px-4 py-3 font-medium">Bundle Name</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((bundle) => (
                <tr key={bundle.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    {bundle.previewImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- admin preview thumb, arbitrary external URL
                      <img src={bundle.previewImageUrl} alt="" className="h-11 w-11 rounded-field object-cover" />
                    ) : (
                      <div className="h-11 w-11 rounded-field bg-gray-100" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-navy-800">{bundle.name}</td>
                  <td className="px-4 py-3">
                    Rs {bundle.salePricePkr ?? bundle.pricePkr}
                    {bundle.salePricePkr && <span className="ml-1 text-xs text-gray-400 line-through">Rs {bundle.pricePkr}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={bundle.isPublished ? 'success' : 'warning'}>{bundle.isPublished ? 'Published' : 'Draft'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link href={`/bundles/${bundle.id}/designs`}>
                      <Button variant="outlineNavy" size="sm">
                        Designs
                      </Button>
                    </Link>
                    <Button variant="outlineNavy" size="sm" onClick={() => onDelete(bundle.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Create bundle">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <FormField label="Name" htmlFor="name" error={errors.name}>
            <input id="name" className={inputClass} {...register('name')} />
          </FormField>
          <FormField label="Description" htmlFor="description" error={errors.description}>
            <textarea id="description" rows={2} className={inputClass} {...register('description')} />
          </FormField>
          <FormField label="Preview image" htmlFor="previewImageFile" error={errors.previewImageUrl}>
            <div className="flex items-center gap-3">
              {previewImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- admin preview thumb, arbitrary uploaded/pasted URL
                <img src={previewImageUrl} alt="" className="h-14 w-14 flex-shrink-0 rounded-field border border-gray-200 object-cover" />
              )}
              <div className="flex-1 space-y-2">
                <input
                  ref={imageInputRef}
                  id="previewImageFile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={imageUploading}
                  onChange={(e) => onImageSelected(e.target.files)}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-field file:border-0 file:bg-gold-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-navy-800"
                />
                {imageUploading && <p className="text-xs text-gray-400">Uploading…</p>}
                {imageUploadError && <p className="text-xs text-status-redFg">{imageUploadError.message}</p>}
                <input placeholder="…or paste an image URL" className={`${inputClass} text-xs`} {...register('previewImageUrl')} />
              </div>
            </div>
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Price (PKR)" htmlFor="pricePkr" error={errors.pricePkr}>
              <input id="pricePkr" type="number" step="0.01" className={inputClass} {...register('pricePkr')} />
            </FormField>
            <FormField label="Sale price (PKR)" htmlFor="salePricePkr" error={errors.salePricePkr}>
              <input id="salePricePkr" type="number" step="0.01" className={inputClass} {...register('salePricePkr')} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('isPublished')} />
            Published
          </label>
          <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
            Create bundle
          </button>
        </form>
      </Card>
    </div>
  );
}
