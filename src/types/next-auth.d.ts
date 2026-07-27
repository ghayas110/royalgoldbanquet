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
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid: number;
    role: Role;
    permissions: Permission[];
  }
}
