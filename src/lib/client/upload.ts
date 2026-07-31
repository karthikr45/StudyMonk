'use client';

import { api } from './api';

interface PresignResp { uploadUrl: string; storageKey: string }

function materialType(contentType: string): string {
  if (contentType === 'application/pdf') return 'PDF';
  if (contentType.startsWith('video/')) return 'VIDEO';
  if (contentType.startsWith('image/')) return 'IMAGE';
  if (contentType.includes('word') || contentType.includes('document')) return 'DOCUMENT';
  return 'OTHER';
}

/**
 * Three-step upload: (1) ask the API for a presigned R2 PUT URL, (2) PUT the
 * file straight to R2 from the browser, (3) record the material in the DB.
 * The file bytes never pass through our server.
 */
export async function uploadMaterial(
  chapterId: string,
  file: File,
  title: string,
  description?: string,
) {
  const { uploadUrl, storageKey } = await api.post<PresignResp>('/api/admin/upload-url', {
    chapterId,
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    fileSize: file.size,
  });

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!put.ok) throw new Error('Upload to storage failed');

  return api.post('/api/admin/materials', {
    chapterId,
    title,
    description: description || undefined,
    type: materialType(file.type || ''),
    storageKey,
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type || 'application/octet-stream',
  });
}
