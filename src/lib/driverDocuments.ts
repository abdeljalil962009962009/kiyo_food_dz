import { supabase } from './supabase';

export const DRIVER_DOCUMENTS_BUCKET = 'driver-documents';
export const MAX_DRIVER_DOCUMENT_BYTES = 8 * 1024 * 1024;

export type DriverDocumentType =
  | 'license'
  | 'id_card'
  | 'vehicle_registration'
  | 'insurance';

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function validateDriverDocument(file: File): 'type' | 'size' | 'empty' | null {
  if (!EXTENSIONS[file.type]) return 'type';
  if (file.size < 1) return 'empty';
  if (file.size > MAX_DRIVER_DOCUMENT_BYTES) return 'size';
  return null;
}

export async function uploadDriverDocument(
  userId: string,
  type: DriverDocumentType,
  file: File,
): Promise<{ document_type: DriverDocumentType; path: string; mime_type: string; size_bytes: number }> {
  const validation = validateDriverDocument(file);
  if (validation) throw new Error(`driver_document_${validation}`);
  const path = `${userId}/${type}-${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const { error } = await supabase.storage.from(DRIVER_DOCUMENTS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return {
    document_type: type,
    path,
    mime_type: file.type,
    size_bytes: file.size,
  };
}

export async function removeUnsubmittedDriverDocuments(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from(DRIVER_DOCUMENTS_BUCKET).remove(paths);
}
