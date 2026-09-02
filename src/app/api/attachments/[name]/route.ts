import { requireUser } from '@/lib/session';
import { readUpload, contentTypeFor, isSafeUploadName } from '@/lib/uploads';

/**
 * Serves one piece of expense evidence.
 *
 * Behind the session on purpose: these files sit outside public/ precisely so
 * that reaching them requires being logged in. A signed-out request gets the
 * redirect `requireUser` issues, not the file.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  await requireUser();
  const { name } = await params;
  if (!isSafeUploadName(name)) return new Response('Not found', { status: 404 });

  const buf = await readUpload(name);
  if (!buf) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': contentTypeFor(name),
      'Content-Length': String(buf.length),
      // Generated names never change content, so this is safe to hold, but
      // private: it must not land in a shared proxy cache.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
