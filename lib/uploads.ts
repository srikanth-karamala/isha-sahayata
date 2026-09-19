import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

/** Persist a camera data-URL under public/uploads and return the public path. */
export async function saveUploadDataUrl(dataUrl: string, folder: 'faults' | 'repairs' | 'lost-found') {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error('Please upload a photo from the camera or gallery.');

  const mime = match[1].toLowerCase();
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.byteLength > 4.5 * 1024 * 1024) {
    throw new Error('Photo is too large. Use a smaller image (under 4.5 MB).');
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', folder);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  await writeFile(path.join(dir, filename), buffer);
  return `/uploads/${folder}/${filename}`;
}
