import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { queryOne } from './db';
import { resolvePermissions } from './permissions';
import type { UserRow, Permission, Role } from './types';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await queryOne<UserRow>(
          `SELECT * FROM users WHERE email = ? AND is_active = 1 LIMIT 1`,
          [credentials.email.toLowerCase().trim()],
        );
        if (!user) return null;
        const ok = await bcrypt.compare(credentials.password, user.password_hash);
        if (!ok) return null;

        const permissions = resolvePermissions(user.role, user.permissions);
        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          permissions,
        } as { id: string; name: string; email: string; role: Role; permissions: Permission[] };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { id: string; role: Role; permissions: Permission[] };
        token.uid = Number(u.id);
        token.role = u.role;
        token.permissions = u.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as number;
        session.user.role = token.role as Role;
        session.user.permissions = (token.permissions as Permission[]) ?? [];
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
