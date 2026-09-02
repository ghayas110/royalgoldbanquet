import type { Role, Permission } from '@/lib/types';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: number;
      name?: string | null;
      email?: string | null;
      role: Role;
      permissions: Permission[];
      /** Per-device session id, used by the signed-in devices list. */
      sid?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid: number;
    role: Role;
    permissions: Permission[];
    /** Per-device session id minted at sign-in. */
    sid?: string;
    /** Last time this token's session was checked against the DB (ms). */
    chk?: number;
  }
}
