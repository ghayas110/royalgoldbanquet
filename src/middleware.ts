export { default } from 'next-auth/middleware';

export const config = {
  // Protect the whole authenticated app area. Public site + auth routes stay open.
  matcher: ['/app/:path*'],
};
