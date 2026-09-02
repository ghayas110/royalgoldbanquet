/**
 * The canonical origin, used for absolute URLs in the sitemap, robots and
 * Open Graph tags.
 *
 * Set SITE_URL on the server. It is NOT derived from NEXTAUTH_URL, which
 * legitimately points somewhere else during local and LAN testing, and a
 * sitemap that advertises `http://192.168.1.7:3005` would be worse than none.
 */
export function siteUrl(): string {
  const raw = process.env.SITE_URL || 'https://skylightballroom.com';
  return raw.replace(/\/+$/, ''); // no trailing slash: paths are joined onto this
}
