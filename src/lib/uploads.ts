import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Where uploaded expense evidence lives.
 *
 * Deliberately NOT under public/. These are financial records, and public/ is
 * served to anyone who can guess a filename. They are read back through an
 * authenticated route instead. It also survives a redeploy, which replaces
 * public/ wholesale.
 *
 * Override with UPLOAD_DIR on the server if the account keeps writable storage
 * somewhere else.
 */
export function uploadDir(): string {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(process.cwd(), 'uploads');
}

/** What a phone camera actually produces, plus the obvious desktop formats. */
const ALLOWED: Record<string, { ext: string; kind: 'IMAGE' | 'VIDEO' }> = {
  'image/jpeg': { ext: 'jpg', kind: 'IMAGE' },
  'image/png': { ext: 'png', kind: 'IMAGE' },
  'image/webp': { ext: 'webp', kind: 'IMAGE' },
  'image/heic': { ext: 'heic', kind: 'IMAGE' },
  'image/heif': { ext: 'heif', kind: 'IMAGE' },
  'video/mp4': { ext: 'mp4', kind: 'VIDEO' },
  'video/quicktime': { ext: 'mov', kind: 'VIDEO' },
};

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export type SavedUpload = { name: string; kind: 'IMAGE' | 'VIDEO' };

/**
 * Write one uploaded file and hand back the name to store on the row.
 *
 * The name is generated, never taken from the client: a browser-supplied
 * filename can contain path separators, and joining that onto a directory is
 * how a traversal bug is written.
 */
export async function saveUpload(file: File): Promise<
  { ok: true; saved: SavedUpload } | { ok: false; error: string }
> {
  const meta = ALLOWED[file.type];
  if (!meta) return { ok: false, error: 'Attach a photo (JPG, PNG, HEIC) or a video (MP4, MOV).' };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `That file is ${(file.size / 1048576).toFixed(1)} MB. The limit is 20 MB.` };
  }
  if (file.size === 0) return { ok: false, error: 'That file is empty.' };

  const name = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}.${meta.ext}`;
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return { ok: true, saved: { name, kind: meta.kind } };
}

/** Generated names only: anything with a separator or a dot-dot is refused. */
export function isSafeUploadName(name: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(name) && !name.includes('..');
}

export async function readUpload(name: string): Promise<Buffer | null> {
  if (!isSafeUploadName(name)) return null;
  try {
    return await readFile(path.join(uploadDir(), name));
  } catch {
    return null;
  }
}

export function contentTypeFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'heic': return 'image/heic';
    case 'heif': return 'image/heif';
    case 'mp4': return 'video/mp4';
    case 'mov': return 'video/quicktime';
    default: return 'image/jpeg';
  }
}
