import { prisma } from '@/lib/prisma';

/**
 * Photo storage.
 *
 * Photos live in Postgres rather than on disk. The app deploys to serverless
 * hosting where the filesystem is read-only and discarded between invocations,
 * so the previous approach — writing into public/uploads — worked locally and
 * would have thrown in production on the first repair confirmation, which
 * requires a photo.
 *
 * These are phone snapshots of a bicycle fault or a found item, a few hundred
 * kilobytes each, so a bytea column is simpler than adding an object store and
 * behaves identically in both environments.
 */

const MAX_BYTES = 4.5 * 1024 * 1024;

export type UploadFolder = 'faults' | 'repairs' | 'lost-found';

/**
 * Persist a camera data-URL and return the path the app serves it from.
 * The returned value goes straight into an <img src>.
 */
export async function saveUploadDataUrl(dataUrl: string, folder: UploadFolder) {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error('Please upload a photo from the camera or gallery.');

  const mimeType = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], 'base64');

  if (bytes.byteLength > MAX_BYTES) {
    throw new Error('Photo is too large. Use a smaller image (under 4.5 MB).');
  }

  const row = await prisma.upload.create({
    data: { folder, mimeType, bytes },
    select: { id: true },
  });

  return `/api/uploads/${row.id}`;
}

/** Read one stored photo back, for the route that serves it. */
export async function getUpload(id: string) {
  return prisma.upload.findUnique({
    where: { id },
    select: { mimeType: true, bytes: true },
  });
}

/**
 * Load a stored photo as base64, for a vision call.
 *
 * Takes the public URL the app stores on a row ("/api/uploads/<id>") and reads
 * the bytes straight from Postgres rather than going back out over HTTP.
 *
 * This exists because the older on-disk convention outlived the move to
 * database storage: lib/triage.ts still expects "/uploads/..." under public/,
 * so every real upload fails its check and photo triage silently never runs.
 * New code should use this and match on the /api/uploads/ prefix.
 */
export async function loadUploadForAi(
  url: string | null | undefined
): Promise<{ mediaType: string; data: string } | null> {
  if (!url) return null;
  const id = /^\/api\/uploads\/([0-9a-f-]{36})$/i.exec(url)?.[1];
  if (!id) return null;

  const row = await getUpload(id);
  if (!row) return null;

  // The vision endpoint rejects very large payloads; skip rather than fail the
  // whole classification for one oversized photo.
  if (row.bytes.byteLength > 4 * 1024 * 1024) return null;

  return { mediaType: row.mimeType, data: Buffer.from(row.bytes).toString('base64') };
}
