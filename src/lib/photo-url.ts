import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'user-photos';
const cache = new Map<string, string>();

/** Extracts the storage object path from a stored value (full URL or bare path). */
export const extractPhotoPath = (stored?: string | null): string | null => {
  if (!stored) return null;
  const marker = `/${BUCKET}/`;
  const idx = stored.indexOf(marker);
  if (idx >= 0) return stored.slice(idx + marker.length).split('?')[0];
  if (stored.startsWith('http')) return null;
  return stored;
};

/**
 * The user-photos bucket is private: convert a stored value into a
 * short-lived signed URL that only signed-in users can obtain.
 */
export const getPhotoSignedUrl = async (stored?: string | null): Promise<string | null> => {
  const path = extractPhotoPath(stored);
  if (!path) return null;
  const cached = cache.get(path);
  if (cached) return cached;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  cache.set(path, data.signedUrl);
  return data.signedUrl;
};
