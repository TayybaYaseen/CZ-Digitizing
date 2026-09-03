'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner, SuccessBanner } from '@/components/ErrorBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Mirrors apps/api/src/files/dto/design-file.dto.ts's DesignFileAdminDto.
interface DesignFileAdminDto {
  id: string;
  designId: string;
  fileFormat: string;
  fileSizeBytes: number;
  isPrivate: boolean;
  contentValidated: boolean;
  versionNumber: number;
  supersededByFileId: string | null;
  createdAt: string;
}

interface DesignDto {
  id: string;
  name: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// docs/specs/2026-08-28-05-private-file-management.md §5 — /admin/designs/:id/files. Admin
// uploads/replaces/removes embroidery files per design; EMB always shows is_private=true and
// there is no control anywhere on this page capable of changing that (AC-1/AC-2 are DB/service
// enforced regardless — this UI simply never offers the bypass).
export default function DesignFilesAdminPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, accessToken, isReady } = useAuth();
  const [design, setDesign] = useState<DesignDto | null>(null);
  const [files, setFiles] = useState<DesignFileAdminDto[] | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [uploadError, setUploadError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    if (!accessToken) return;
    setListError(null);
    try {
      const [designDto, fileList] = await Promise.all([
        apiFetch<DesignDto>(`/api/designs/${params.id}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        apiFetch<DesignFileAdminDto[]>(`/api/designs/${params.id}/files`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      setDesign(designDto);
      setFiles(fileList);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Failed to load files.', traceId: '' });
    }
  }, [accessToken, params.id]);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    load();
  }, [isReady, user, load, router]);

  async function onUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);
    setSuccessMessage(null);
    setUploading(true);
    try {
      const form = new FormData();
      for (const file of Array.from(fileList)) form.append('files', file);
      await apiFetch(`/api/designs/${params.id}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      setSuccessMessage(`Uploaded ${fileList.length} file(s).`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (err) {
      // AC-5's UI state: Admin must see *why* an upload was rejected (FILE_TOO_LARGE /
      // UNSUPPORTED_FILE_TYPE / FILE_FORMAT_BLOCKED), not a generic failure.
      setUploadError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Upload failed.', traceId: '' });
    } finally {
      setUploading(false);
    }
  }

  async function onReplace(fileId: string, fileList: FileList | null) {
    const file = fileList?.item(0);
    if (!file) return;
    setUploadError(null);
    setSuccessMessage(null);
    try {
      const form = new FormData();
      form.append('file', file);
      await apiFetch(`/api/designs/${params.id}/files/${fileId}/replace`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      setSuccessMessage('File replaced — previous version retained in history.');
      load();
    } catch (err) {
      setUploadError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Replace failed.', traceId: '' });
    }
  }

  async function onDelete(fileId: string) {
    try {
      await apiFetch(`/api/designs/${params.id}/files/${fileId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.error : { code: 'INTERNAL_ERROR', message: 'Delete failed.', traceId: '' });
    }
  }

  if (!isReady || !user) return null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/designs" className="text-sm text-gray-500 hover:underline">
          ← Designs
        </Link>
        <h1 className="font-display text-3xl font-bold text-navy-800">{design ? `Files — ${design.name}` : 'Files'}</h1>
        <p className="mt-1 text-sm text-gray-500">Embroidery source files (AC-1/AC-2/AC-7/AC-12/AC-13)</p>
      </div>

      <ErrorBanner error={listError} />
      {successMessage && <SuccessBanner message={successMessage} />}

      <Card title="Upload files">
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            disabled={uploading}
            onChange={(e) => onUpload(e.target.files)}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-field file:border-0 file:bg-gold-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy-800"
          />
          {/* AC-5 — Admin must understand *why* a rejection happened, not a generic failure. */}
          {uploadError && (
            <div className="rounded-field border border-red-200 bg-status-redBg px-4 py-3 text-sm text-status-redFg">
              <span className="font-semibold">{uploadError.code}:</span> {uploadError.message}
            </div>
          )}
          <p className="text-xs text-gray-400">
            Allowed formats are managed in{' '}
            <Link href="/settings/file-formats" className="underline">
              Settings → File Formats
            </Link>
            . .EMB is always stored private — it can never be exposed to a customer.
          </p>
        </div>
      </Card>

      <Card padding="p-0">
        {files === null ? (
          <p className="p-4 text-sm text-gray-400">Loading…</p>
        ) : files.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No files uploaded.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Format</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium">Privacy</th>
                <th className="px-4 py-3 font-medium">Content validated</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy-800">{file.fileFormat}</td>
                  <td className="px-4 py-3">{formatBytes(file.fileSizeBytes)}</td>
                  <td className="px-4 py-3">v{file.versionNumber}</td>
                  <td className="px-4 py-3">
                    <Badge tone={file.isPrivate ? 'warning' : 'success'}>{file.isPrivate ? 'Private' : 'Public on purchase'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={file.contentValidated ? 'success' : 'neutral'}>{file.contentValidated ? 'Verified' : 'Not verified'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <input
                      ref={(el) => {
                        replaceInputRefs.current[file.id] = el;
                      }}
                      type="file"
                      className="hidden"
                      onChange={(e) => onReplace(file.id, e.target.files)}
                    />
                    <Button variant="outlineNavy" size="sm" onClick={() => replaceInputRefs.current[file.id]?.click()}>
                      Replace
                    </Button>
                    <Button variant="outlineNavy" size="sm" onClick={() => onDelete(file.id)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
