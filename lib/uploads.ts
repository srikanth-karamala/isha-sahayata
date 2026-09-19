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
