import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query, toInt } from '@/lib/db';

/**
 * The notification bell's polling endpoint.
 *
 * Deliberately a route handler and NOT a server action: calling a server
 * action makes Next re-render the current route, which re-mounts the bell,
 * which polls again — a tight loop that hammered both the server and MySQL.
 * A plain fetch returns JSON and touches nothing else.
 *
 *   GET /api/notifications          → { unread }
 *   GET /api/notifications?list=1   → { unread, items }
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: number } | undefined;
  if (!user?.id) return NextResponse.json({ unread: 0, items: [] }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const wantList = searchParams.get('list') === '1';
  const limit = toInt(searchParams.get('limit') ?? '20', 20);

  const counted = await query<{ n: number }>(
    `SELECT COUNT(*) AS n
       FROM notifications n
       LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
      WHERE r.user_id IS NULL`,
    [user.id],
  );
  const unread = Number(counted[0]?.n ?? 0);
  if (!wantList) return NextResponse.json({ unread });

  const rows = await query<any>(
    `SELECT n.id, n.type, n.title, n.body, n.url,
            TIMESTAMPDIFF(SECOND, n.created_at, NOW()) AS seconds_ago,
            r.user_id IS NOT NULL AS is_read
       FROM notifications n
       LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
      ORDER BY n.id DESC
      LIMIT ${Math.min(Math.max(limit, 1), 50)}`,
    [user.id],
  );

  return NextResponse.json({
    unread,
    items: rows.map((n: any) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      url: n.url ?? null,
      secondsAgo: Math.max(0, Number(n.seconds_ago ?? 0)),
      read: !!Number(n.is_read),
    })),
  });
}
