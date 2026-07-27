import { execute } from './db';

/**
 * Append a row to audit_log. Every mutation should call this.
 * before/after are serialized to JSON columns.
 */
export async function audit(params: {
  userId: number | null | undefined;
  action: string;          // CREATE | UPDATE | DELETE | LOCK | UNLOCK | SETTLE | ...
  entity: string;          // booking | payment | petty_cash | disbursement | user | ...
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  const { userId, action, entity, entityId, before, after } = params;
  await execute(
    `INSERT INTO audit_log (user_id, action, entity, entity_id, before_json, after_json)
     VALUES (?,?,?,?,?,?)`,
    [
      userId ?? null,
      action,
      entity,
      entityId != null ? String(entityId) : null,
      before != null ? JSON.stringify(before) : null,
      after != null ? JSON.stringify(after) : null,
    ],
  );
}
