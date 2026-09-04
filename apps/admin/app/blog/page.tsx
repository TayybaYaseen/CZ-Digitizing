'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError, BlogPostSummaryDto } from '@czd/shared-types';
import { ApiClientError, apiFetch, apiFetchWithMeta } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { FormField, inputClass, submitButtonClass } from '@/components/FormField';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const EMPTY_FORM = { title: '', slug: '', coverImageUrl: '', body: '', category: '', languageCode: 'en', isPublished: true };

function slugify(title: string) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// docs/specs/2026-08-28-10-content-knowledge-base.md AC-9/AC-15/AC-16 (aspect A-012d).
export default function BlogAdminPage() {
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [posts, setPosts] = useState<BlogPostSummaryDto[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      const res = await apiFetchWithMeta<BlogPostSummaryDto[]>('/api/blog?pageSize=50', { headers: { Authorization: `Bearer ${accessToken}` } });
      setPosts(res.data);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load blog posts.', traceId: '' });
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

  async function startEdit(id: string) {
    const post = await apiFetch<{ title: string; slug: string; coverImageUrl: string | null; body: string; category: string; languageCode: string; isPublished: boolean }>(
      `/api/blog/${posts?.find((p) => p.id === id)?.slug}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    setEditingId(id);
    setSlugTouched(true);
    setForm({
      title: post.title,
      slug: post.slug,
      coverImageUrl: post.coverImageUrl ?? '',
      body: post.body,
      category: post.category,
      languageCode: post.languageCode,
      isPublished: post.isPublished,
    });
  }

  async function onCoverImageSelected(fileList: FileList | null) {
    const file = fileList?.item(0);
    if (!file) return;
    setImageUploading(true);
    try {
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      const { url } = await apiFetch<{ url: string }>('/api/uploads/images', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: uploadForm });
      setForm((f) => ({ ...f, coverImageUrl: url }));
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Image upload failed.', traceId: '' });
    } finally {
      setImageUploading(false);
    }
  }

  async function onSubmit() {
    setApiError(null);
    setSuccessMessage(null);
    setBusy(true);
    const body = { ...form, coverImageUrl: form.coverImageUrl || undefined };
    try {
      if (editingId) {
        await apiFetch(`/api/blog/${editingId}`, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
        setSuccessMessage('Post updated.');
      } else {
        await apiFetch('/api/blog', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
        setSuccessMessage('Post created.');
      }
      setEditingId(null);
      setForm(EMPTY_FORM);
      setSlugTouched(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
      load();
    } catch (err) {
      setApiError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to save post.', traceId: '' });
    } finally {
      setBusy(false);
    }
  }

  // AC-16 — hard delete, permanently removed from listing/detail.
  async function onDelete(id: string) {
    try {
      await apiFetch(`/api/blog/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to delete.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-navy-800">Blog</h1>
        <p className="mt-1 text-sm text-gray-500">{posts?.length ?? 0} posts</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}

      <Card padding="p-0">
        {posts === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No posts yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy-800">{post.title}</td>
                  <td className="px-4 py-3">{post.category}</td>
                  <td className="px-4 py-3">
                    <Badge tone={post.isPublished ? 'success' : 'warning'}>{post.isPublished ? 'Published' : 'Draft'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button variant="outlineNavy" size="sm" onClick={() => startEdit(post.id)}>
                      Edit
                    </Button>
                    <Button variant="outlineNavy" size="sm" onClick={() => onDelete(post.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={editingId ? 'Edit post' : 'Create post'}>
        <div className="space-y-3">
          <FormField label="Title" htmlFor="title">
            <input
              id="title"
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, slug: slugTouched ? f.slug : slugify(e.target.value) }))}
            />
          </FormField>
          <FormField label="Slug" htmlFor="slug">
            <input
              id="slug"
              className={inputClass}
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm((f) => ({ ...f, slug: e.target.value }));
              }}
            />
          </FormField>
          <FormField label="Cover image" htmlFor="coverImage">
            <div className="flex items-center gap-3">
              {form.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.coverImageUrl} alt="" className="h-14 w-14 rounded-field border border-gray-200 object-cover" />
              )}
              <input
                ref={imageInputRef}
                id="coverImage"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={imageUploading}
                onChange={(e) => onCoverImageSelected(e.target.files)}
                className="block flex-1 text-sm text-gray-600 file:mr-3 file:rounded-field file:border-0 file:bg-gold-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-navy-800"
              />
            </div>
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Category" htmlFor="category">
              <input id="category" className={inputClass} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </FormField>
            <FormField label="Language code" htmlFor="languageCode">
              <input id="languageCode" className={inputClass} value={form.languageCode} onChange={(e) => setForm((f) => ({ ...f, languageCode: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Body" htmlFor="body">
            <RichTextEditor value={form.body} onChange={(html) => setForm((f) => ({ ...f, body: html }))} accessToken={accessToken} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} />
            Published
          </label>
          <ErrorBanner error={apiError} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={onSubmit} className={submitButtonClass}>
              {editingId ? 'Save changes' : 'Create post'}
            </button>
            {editingId && (
              <Button
                type="button"
                variant="outlineNavy"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                  setSlugTouched(false);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
