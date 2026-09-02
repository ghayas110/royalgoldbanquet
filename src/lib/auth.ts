import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { queryOne, execute } from './db';
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
        // Mint a per-device id at sign-in. Sessions are JWT (stateless), so this
        // is what lets a specific device be listed and signed out remotely.
        token.sid = randomUUID();
        token.chk = Date.now();
        try {
          await execute(
            `INSERT INTO user_sessions (user_id, sid) VALUES (?,?)`,
            [Number(u.id), token.sid],
          );
        } catch { /* never block sign-in on device bookkeeping */ }
      }

      // Enforce remote sign-out, but at most once a minute so we aren't
      // hitting the database on every single request.
      const sid = token.sid as string | undefined;
      const lastCheck = Number(token.chk ?? 0);
      if (sid && Date.now() - lastCheck > 60_000) {
        token.chk = Date.now();
        try {
          const row = await queryOne<{ revoked_at: string | null }>(
            `SELECT revoked_at FROM user_sessions WHERE sid = ?`, [sid],
          );
          // Row deleted or revoked -> this device has been signed out.
          if (!row || row.revoked_at) return null as unknown as typeof token;
          await execute(`UPDATE user_sessions SET last_seen_at = NOW() WHERE sid = ?`, [sid]);
        } catch { /* a DB blip must not log everyone out */ }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as number;
        session.user.role = token.role as Role;
        session.user.permissions = (token.permissions as Permission[]) ?? [];
        session.user.sid = token.sid as string | undefined;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
