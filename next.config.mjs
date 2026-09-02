/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  images: {
    /**
     * No runtime image optimisation, deliberately.
     *
     * Next's optimiser needs `sharp`, and `sharp` is a native binary. The
     * standalone build is produced on macOS, so it bundles
     * @img/sharp-darwin-x64 — which cannot load on the Linux host this deploys
     * to. The optimiser would then throw on every image request and each
     * <Image> would render broken. That is a worse failure than shipping the
     * original file, because it fails at request time rather than build time.
     *
     * Turning it off keeps everything <Image> is actually wanted for here:
     * intrinsic width and height (so nothing shifts as it loads), `priority`
     * preloading for the hero, lazy loading below the fold, and blur
     * placeholders baked in at build time from statically imported files.
     * Only the on-the-fly resizing and WebP conversion are given up, and the
     * assets are already sized for their slots.
     *
     * To turn this back on, the build must install Linux binaries:
     *   npm i --os=linux --cpu=x64 sharp
     * inside cpanel-build/ before zipping.
     */
    unoptimized: true,
  },
  transpilePackages: ['three'],
  experimental: {
    serverActions: {
      // Expense evidence is phone photos and short clips; 2mb rejected both.
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
