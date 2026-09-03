'use client';

import Link from 'next/link';
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
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface CategoryDto {
  id: string;
  name: string;
}

// Mirrors apps/api/src/bundles/dto/dynamic-bundle-rule.dto.ts's DynamicBundleRuleDto.
interface DynamicBundleRuleDto {
  id: string;
  name: string;
  categoryId: string;
  requiredDesignCount: number;
  bundlePricePkr: number;
  isPublished: boolean;
}

const schema = z.object({
  name: z.string().min(1, 'required').max(255),
  categoryId: z.string().min(1, 'required'),
  requiredDesignCount: z.coerce.number().int().min(1),
  bundlePricePkr: z.coerce.number().min(0),
  isPublished: z.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

// docs/specs/2026-08-28-06-design-bundles.md AC-6 — "any N designs from Category X for Y PKR".
// CRUD only: automatic application at checkout is TODO(A-011), see
// apps/api/src/bundles/dynamic-bundle-rules.service.ts.
export default function DynamicBundleRulesAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [rules, setRules] = useState<DynamicBundleRuleDto[] | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      const [ruleList, categoryList] = await Promise.all([
        apiFetch<DynamicBundleRuleDto[]>('/api/bundles/dynamic-rules', { headers: { Authorization: `Bearer ${accessToken}` } }),
        apiFetch<CategoryDto[]>('/api/categories', { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      setRules(ruleList);
      setCategories(categoryList);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load dynamic bundle rules.', traceId: '' });
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

  async function onSubmit(values: FormValues) {
    setApiError(null);
    setSuccessMessage(null);
    try {
      await apiFetch('/api/bundles/dynamic-rules', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(values),
      });
      setSuccessMessage(`Rule "${values.name}" created.`);
      reset({ name: '', categoryId: '', requiredDesignCount: 1, bundlePricePkr: 0, isPublished: true });
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to create rule.', traceId: '' });
    }
  }

  async function onDelete(id: string) {
    try {
      await apiFetch(`/api/bundles/dynamic-rules/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/bundles" className="text-sm text-gray-500 hover:underline">
          ← Bundles
        </Link>
        <h1 className="font-display text-3xl font-bold text-navy-800">Dynamic Bundle Rules</h1>
        <p className="mt-1 text-sm text-gray-500">
          &quot;Any N designs from Category X for Y PKR&quot; (AC-6). Applying a rule automatically at checkout is not yet implemented — Shopping Cart &amp;
          Checkout (A-011) is still Blocked.
        </p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}
      <ErrorBanner error={apiError} />

      <Card padding="p-0">
        {rules === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No dynamic bundle rules yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Rule</th>
                <th className="px-4 py-3 font-medium">Requires</th>
                <th className="px-4 py-3 font-medium">Bundle Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy-800">{rule.name}</td>
                  <td className="px-4 py-3">{rule.requiredDesignCount} designs</td>
                  <td className="px-4 py-3">Rs {rule.bundlePricePkr}</td>
                  <td className="px-4 py-3">
                    <Badge tone={rule.isPublished ? 'success' : 'warning'}>{rule.isPublished ? 'Published' : 'Draft'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outlineNavy" size="sm" onClick={() => onDelete(rule.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Create dynamic rule">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <FormField label="Name" htmlFor="name" error={errors.name}>
            <input id="name" placeholder="Any 5 Cap Logos" className={inputClass} {...register('name')} />
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
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Required design count" htmlFor="requiredDesignCount" error={errors.requiredDesignCount}>
              <input id="requiredDesignCount" type="number" min={1} className={inputClass} {...register('requiredDesignCount')} />
            </FormField>
            <FormField label="Bundle price (PKR)" htmlFor="bundlePricePkr" error={errors.bundlePricePkr}>
              <input id="bundlePricePkr" type="number" step="0.01" className={inputClass} {...register('bundlePricePkr')} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" {...register('isPublished')} />
            Published
          </label>
          <button type="submit" disabled={isSubmitting || categories.length === 0} className={submitButtonClass}>
            {categories.length === 0 ? 'Create a category first' : 'Create rule'}
          </button>
        </form>
      </Card>
    </div>
  );
}
