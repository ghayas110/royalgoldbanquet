'use server';

/**
 * Business profile editing.
 *
 * Each field is one row in `settings`, so a value that is cleared simply falls
 * back to the build-time default rather than printing blank on a slip.
 */

import { z } from 'zod';
import { execute } from '@/lib/db';
import { assertPermission } from '@/lib/session';
import { audit } from '@/lib/audit';
import { getBrand } from '@/lib/data';
import { brandKey, normaliseBrand, BRAND_DEFAULTS, type BrandInfo } from '@/lib/brand-info';
import { revalidatePath } from 'next/cache';

const schema = z.object({
  siteName: z.string().trim().max(160).optional(),
  name: z.string().trim().max(120).optional(),
  tagline: z.string().trim().max(60).optional(),
  phone: z.string().trim().max(40).optional(),
  footerPhone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(160).optional(),
  whatsappDisplay: z.string().trim().max(40).optional(),
  facebook: z.string().trim().max(80).optional(),
  instagram: z.string().trim().max(80).optional(),
  address: z.string().trim().max(255).optional(),
  city: z.string().trim().max(80).optional(),
});

export type BrandResult = { ok: true; message: string } | { ok: false; error: string };

export async function updateBrand(input: unknown): Promise<BrandResult> {
  const actor = await assertPermission('settings.manage');
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  const email = parsed.data.email ?? '';
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'That email address does not look right.' };
  }

  const before = await getBrand();

  // Derived fields (phoneIntl, the wa.me number, stripped handles) are worked
  // out here so the form never has to ask for them.
  const merged = normaliseBrand({ ...before, ...parsed.data } as BrandInfo);

  const fields: (keyof BrandInfo)[] = [
    'siteName', 'name', 'tagline', 'phone', 'phoneIntl', 'email',
    'whatsapp', 'whatsappDisplay', 'facebook', 'instagram',
    'address', 'footerPhone', 'city',
  ];

  for (const f of fields) {
    const value = String(merged[f] ?? '');
    await execute(
      `INSERT INTO settings (\`key\`, value) VALUES (?,?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [brandKey(f), value.slice(0, 255)],
    );
  }

  await audit({
    userId: actor.id, action: 'UPDATE', entity: 'brand',
    before: { name: before.name, phone: before.phone, email: before.email },
    after: { name: merged.name, phone: merged.phone, email: merged.email },
  });

  // Everything that prints or publishes these values.
  revalidatePath('/');
  revalidatePath('/app/settings');
  revalidatePath('/app/bookings', 'layout');
  revalidatePath('/print', 'layout');
  return { ok: true, message: 'Business profile saved.' };
}

/** Put every field back to the values the app shipped with. */
export async function resetBrand(): Promise<BrandResult> {
  const actor = await assertPermission('settings.manage');
  await execute(`DELETE FROM settings WHERE \`key\` LIKE 'brand.%'`);
  await audit({ userId: actor.id, action: 'RESET', entity: 'brand', after: BRAND_DEFAULTS });
  revalidatePath('/');
  revalidatePath('/app/settings');
  revalidatePath('/print', 'layout');
  return { ok: true, message: 'Business profile reset to the original details.' };
}
