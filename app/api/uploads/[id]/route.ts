import { getUpload } from '@/lib/uploads';

/**
 * Serves a photo stored in the database.
 *
 * Uploads used to be static files under public/, which the deployed app cannot
 * write. They now live in Postgres, so this route stands in for the static
 * handler: same <img src> shape, different backing store.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const upload = await getUpload(id);

  if (!upload) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(new Uint8Array(upload.bytes), {
    headers: {
      'Content-Type': upload.mimeType,
      // Rows are immutable once written, so this can cache hard.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
