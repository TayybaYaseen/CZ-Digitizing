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

interface CategoryDto {
  id: string;
  name: string;
}

// Mirrors apps/api/src/designs/dto/design.dto.ts's DesignSummaryDto.
interface DesignSummaryDto {
  id: string;
  name: string;
  previewImageUrl: string;
  categoryIds: string[];
  pricePkr: number;
  salePricePkr: number | null;
  isPublished?: boolean;
}

const schema = z.object({
  name: z.string().min(1, 'required').max(255),
  previewImageUrl: z.string().url('must be a valid URL'),
  categoryId: z.string().min(1, 'required'),
  pricePkr: z.coerce.number().min(0),
  sizeLabel: z.string().min(1, 'required'),
  sizeWidthMm: z.coerce.number().min(0),
  sizeHeightMm: z.coerce.number().min(0),
  isPublished: z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

// docs/specs/2026-08-28-04-design-catalog-browsing.md AC-1/AC-2/AC-3/AC-4 — admin design CRUD.
// Table layout ported from docs/CZ Digitizing Admin Panel.html's decoded DesignsView. One
// category + one size accepted here for a fast create path; multi-category/multi-size editing is
// available via the API (PUT /api/designs/:id) once this table view grows an edit screen.
export default function DesignsAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [designs, setDesigns] = useState<DesignSummaryDto[] | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
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
      const [designList, categoryList] = await Promise.all([
        apiFetch<DesignSummaryDto[]>('/api/designs?pageSize=50', { headers: { Authorization: `Bearer ${accessToken}` } }),
        apiFetch<CategoryDto[]>('/api/categories', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      setDesigns(designList);
      setCategories(categoryList);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load designs.', traceId: '' });
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
      await apiFetch('/api/designs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          name: values.name,
          previewImageUrl: values.previewImageUrl,
          categoryIds: [values.categoryId],
          pricePkr: values.pricePkr,
          sizes: [{ label: values.sizeLabel, widthMm: values.sizeWidthMm, heightMm: values.sizeHeightMm }],
          isPublished: values.isPublished,
        }),
      });
      setSuccessMessage(`Design "${values.name}" created.`);
      reset({ name: '', previewImageUrl: '', categoryId: '', pricePkr: 0, sizeLabel: '', sizeWidthMm: 0, sizeHeightMm: 0, isPublished: true });
      if (imageInputRef.current) imageInputRef.current.value = '';
      load();
    } catch (err) {
      if (err instanceof ApiClientError && err.error.code === 'VALIDATION_ERROR' && err.error.errors) {
        setApiError(err.error);
      } else {
        setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to create design.', traceId: '' });
      }
    }
  }

  async function onDelete(id: string) {
    try {
      await apiFetch(`/api/designs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
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
          <h1 className="font-display text-3xl font-bold text-navy-800">Designs</h1>
          <p className="mt-1 text-sm text-gray-500">{designs?.length ?? 0} designs (AC-1–AC-4)</p>
        </div>
        <Link href="/designs/categories">
          <Button variant="outlineNavy" size="sm">
            Manage categories
          </Button>
        </Link>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}
      <ErrorBanner error={apiError} />

      <Card padding="p-0">
        {designs === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : designs.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No designs yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Image</th>
                <th className="px-4 py-3 font-medium">Design Name</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {designs.map((design) => (
                <tr key={design.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin preview thumb, arbitrary external URL */}
                    <img src={design.previewImageUrl} alt="" className="h-11 w-11 rounded-field object-cover" />
                  </td>
                  <td className="px-4 py-3 font-semibold text-navy-800">{design.name}</td>
                  <td className="px-4 py-3">
                    Rs {design.salePricePkr ?? design.pricePkr}
                    {design.salePricePkr && <span className="ml-1 text-xs text-gray-400 line-through">Rs {design.pricePkr}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={design.isPublished === false ? 'warning' : 'success'}>{design.isPublished === false ? 'Draft' : 'Published'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Link href={`/designs/${design.id}/files`}>
                      <Button variant="outlineNavy" size="sm">
                        Files
                      </Button>
                    </Link>
                    <Button variant="outlineNavy" size="sm" onClick={() => onDelete(design.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Create design">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <FormField label="Name" htmlFor="name" error={errors.name}>
            <input id="name" className={inputClass} {...register('name')} />
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
                <input
                  placeholder="…or paste an image URL"
                  className={`${inputClass} text-xs`}
                  {...register('previewImageUrl')}
                />
              </div>
            </div>
          </FormField>
          <FormField label="Category" htmlFor="categoryId" error={errors.categoryId}>
            <select id="categoryId" className={inputClass} {...register('categoryId')}>
              <option value="">Select a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Price (PKR)" htmlFor="pricePkr" error={errors.pricePkr}>
            <input id="pricePkr" type="number" step="0.01" className={inputClass} {...register('pricePkr')} />
          </FormField>
          <div className="grid grid-cols-3 gap-2">
            <FormField label="Size label" htmlFor="sizeLabel" error={errors.sizeLabel}>
              <input id="sizeLabel" placeholder="Size 1" className={inputClass} {...register('sizeLabel')} />
            </FormField>
            <FormField label="Width (mm)" htmlFor="sizeWidthMm" error={errors.sizeWidthMm}>
              <input id="sizeWidthMm" type="number" step="0.01" className={inputClass} {...register('sizeWidthMm')} />
            </FormField>
            <FormField label="Height (mm)" htmlFor="sizeHeightMm" error={errors.sizeHeightMm}>
              <input id="sizeHeightMm" type="number" step="0.01" className={inputClass} {...register('sizeHeightMm')} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('isPublished')} />
            Published
          </label>
          <button type="submit" disabled={isSubmitting || categories.length === 0} className={submitButtonClass}>
            {categories.length === 0 ? 'Create a category first' : 'Create design'}
          </button>
        </form>
      </Card>
    </div>
  );
}
