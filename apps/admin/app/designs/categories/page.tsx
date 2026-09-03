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
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Mirrors apps/api/src/designs/dto/category.dto.ts.
interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isPublished: boolean;
}
interface SubcategoryDto extends CategoryDto {
  parentCategoryId: string;
}

const schema = z.object({
  name: z.string().min(1, 'required').max(255),
  slug: z.string().min(1, 'required').max(255),
  isPublished: z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

// docs/specs/2026-08-28-04-design-catalog-browsing.md AC-1 — admin creates a main category and,
// optionally, subcategories under it.
export default function CategoriesAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [categories, setCategories] = useState<CategoryDto[] | null>(null);
  const [subcategories, setSubcategories] = useState<Record<string, SubcategoryDto[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [subName, setSubName] = useState('');
  const [subSlug, setSubSlug] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { isPublished: true } });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      const list = await apiFetch<CategoryDto[]>('/api/categories', { headers: { Authorization: `Bearer ${accessToken}` } });
      setCategories(list);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load categories.', traceId: '' });
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

  async function loadSubcategories(categoryId: string) {
    if (subcategories[categoryId]) return;
    try {
      const list = await apiFetch<SubcategoryDto[]>(`/api/categories/${categoryId}/subcategories`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setSubcategories((prev) => ({ ...prev, [categoryId]: list }));
    } catch {
      // subcategory list load failure just leaves the section showing nothing to expand into
    }
  }

  async function onSubmit(values: FormValues) {
    setApiError(null);
    setSuccessMessage(null);
    try {
      await apiFetch('/api/categories', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(values),
      });
      setSuccessMessage(`Category "${values.name}" created.`);
      reset({ name: '', slug: '', isPublished: true });
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to create category.', traceId: '' });
    }
  }

  async function onDelete(id: string) {
    try {
      await apiFetch(`/api/categories/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete.', traceId: '' });
    }
  }

  async function onCreateSubcategory(categoryId: string) {
    if (!subName.trim() || !subSlug.trim()) return;
    try {
      await apiFetch(`/api/categories/${categoryId}/subcategories`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: subName, slug: subSlug, isPublished: true }),
      });
      setSubName('');
      setSubSlug('');
      setSubcategories((prev) => {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
      loadSubcategories(categoryId);
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to create subcategory.', traceId: '' });
    }
  }

  async function onDeleteSubcategory(categoryId: string, subId: string) {
    try {
      await apiFetch(`/api/subcategories/${subId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      setSubcategories((prev) => ({ ...prev, [categoryId]: (prev[categoryId] ?? []).filter((s) => s.id !== subId) }));
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete subcategory.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Design categories</h1>
        <p className="mt-1 text-sm text-gray-500">
          Unlimited categories and subcategories (AC-1). Designs assigned here appear in customer browsing.
        </p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}
      <ErrorBanner error={apiError} />

      <Card padding="p-0">
        {categories === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : categories.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No categories yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {categories.map((category) => (
              <li key={category.id} className="p-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      const next = expanded === category.id ? null : category.id;
                      setExpanded(next);
                      if (next) loadSubcategories(category.id);
                    }}
                    className="text-left text-sm font-medium text-navy-800 hover:text-gold-600"
                  >
                    {category.name} <span className="text-gray-400">/{category.slug}</span>
                  </button>
                  <Button variant="outlineNavy" size="sm" onClick={() => onDelete(category.id)}>
                    Delete
                  </Button>
                </div>

                {expanded === category.id && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    {(subcategories[category.id] ?? []).map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between text-xs text-gray-600">
                        <span>{sub.name}</span>
                        <button onClick={() => onDeleteSubcategory(category.id, sub.id)} className="text-status-redFg hover:underline">
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        value={subName}
                        onChange={(e) => setSubName(e.target.value)}
                        placeholder="Subcategory name"
                        className={`${inputClass} text-xs`}
                      />
                      <input
                        value={subSlug}
                        onChange={(e) => setSubSlug(e.target.value)}
                        placeholder="slug"
                        className={`${inputClass} text-xs`}
                      />
                      <Button size="sm" onClick={() => onCreateSubcategory(category.id)} className="whitespace-nowrap">
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Create category">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <FormField label="Name" htmlFor="name" error={errors.name}>
            <input id="name" className={inputClass} {...register('name')} />
          </FormField>
          <FormField label="Slug" htmlFor="slug" error={errors.slug}>
            <input id="slug" className={inputClass} {...register('slug')} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('isPublished')} />
            Published
          </label>
          <button type="submit" disabled={isSubmitting} className={submitButtonClass}>
            Create category
          </button>
        </form>
      </Card>
    </div>
  );
}
