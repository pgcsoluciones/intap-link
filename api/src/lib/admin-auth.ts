/**
 * admin-auth.ts — Fase 7.1 Super Admin Foundation
 *
 * Exports:
 *  - requireSuperAdmin(minRole)  → Hono middleware factory
 *  - logAdminAction(...)         → Write to admin_audit_log
 *  - ensureAdminUser(db, email)  → Bootstrap: upsert admin_users from ADMIN_EMAILS
 *
 * Role hierarchy (lowest → highest privilege):
 *   viewer < support < super_admin
 *
 * Fallback: If admin_users table has no record for the user but their email
 * appears in ADMIN_EMAILS env var, they are treated as 'super_admin' during
 * the migration window. This keeps backwards compatibility while transitioning
 * away from the env-var approach.
 */

export type AdminRole = 'viewer' | 'support' | 'super_admin'

const ROLE_RANK: Record<AdminRole, number> = {
  viewer:      1,
  support:     2,
  super_admin: 3,
}

// ─── SHA-256 helper (same as in index.ts to keep zero deps) ─────────────────

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function parseCookie(header: string, name: string): string | null {
  const match = header.match(new RegExp(`(?:^|;\\s*)${encodeURIComponent(name)}=([^;]*)`))
  if (match) return decodeURIComponent(match[1])
  const match2 = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match2 ? decodeURIComponent(match2[1]) : null
}

// ─── requireSuperAdmin middleware factory ────────────────────────────────────

/**
 * Hono middleware factory. Usage:
 *
 *   app.get('/api/v1/superadmin/...', requireSuperAdmin('viewer'), handler)
 *   app.patch('...', requireSuperAdmin('support'), handler)
 *   app.delete('...', requireSuperAdmin('super_admin'), handler)
 *
 * Sets ctx variables:
 *   c.set('adminUserId', userId)
 *   c.set('adminRole', role)
 */
export function requireSuperAdmin(minRole: AdminRole = 'viewer') {
  return async (c: any, next: any) => {
    // 1. Session validation
    const cookieHeader = c.req.header('Cookie') || ''
    const rawSession   = parseCookie(cookieHeader, 'session_id')
    if (!rawSession) return c.json({ ok: false, error: 'Unauthorized' }, 401)

    const sessionHash = await sha256Hex(rawSession)
    const session = await c.env.DB.prepare(
      `SELECT user_id FROM auth_sessions
       WHERE session_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL
       LIMIT 1`
    ).bind(sessionHash).first()
    if (!session) return c.json({ ok: false, error: 'Unauthorized' }, 401)

    const userId: string = (session as any).user_id

    // 2. Look up role in admin_users table first
    // .catch(() => null): si la tabla aún no existe (pre-migración 0023), cae al fallback ADMIN_EMAILS
    const adminRow = await c.env.DB.prepare(
      `SELECT role FROM admin_users WHERE user_id = ? LIMIT 1`
    ).bind(userId).first<{ role: AdminRole }>().catch(() => null)

    let resolvedRole: AdminRole | null = adminRow?.role ?? null

    // 3. Fallback: ADMIN_EMAILS env var → treat as super_admin (transition period)
    if (!resolvedRole) {
      const userRow = await c.env.DB.prepare(
        `SELECT email FROM users WHERE id = ? LIMIT 1`
      ).bind(userId).first<{ email: string }>()

      if (userRow?.email) {
        const adminEmailsRaw: string = c.env.ADMIN_EMAILS || ''
        const adminList = adminEmailsRaw
          .split(',')
          .map((e: string) => e.trim().toLowerCase())
          .filter(Boolean)

        if (adminList.includes(userRow.email.toLowerCase())) {
          resolvedRole = 'super_admin'
          // Auto-upsert into admin_users so future requests skip the fallback
          c.env.DB.prepare(
            `INSERT INTO admin_users (user_id, role, notes)
             VALUES (?, 'super_admin', 'Auto-seeded from ADMIN_EMAILS')
             ON CONFLICT(user_id) DO NOTHING`
          ).bind(userId).run().catch(() => {})
        }
      }
    }

    if (!resolvedRole) return c.json({ ok: false, error: 'Forbidden' }, 403)

    // 4. Role hierarchy check
    if (ROLE_RANK[resolvedRole] < ROLE_RANK[minRole]) {
      return c.json({ ok: false, error: 'Insufficient permissions', required: minRole, have: resolvedRole }, 403)
    }

    // 5. Expose to handler
    c.set('adminUserId', userId)
    c.set('adminRole', resolvedRole)

    await next()
  }
}

// ─── logAdminAction ──────────────────────────────────────────────────────────

export interface AdminActionParams {
  db:          D1Database
  adminUserId: string
  action:      string
  targetType:  'profile' | 'user' | 'module' | 'admin_user'
  targetId:    string
  before?:     Record<string, unknown> | null
  after?:      Record<string, unknown> | null
  ip?:         string
}

/**
 * Fire-and-forget audit log. Non-blocking — awaiting is optional.
 * Returns the generated log entry id.
 */
export async function logAdminAction(params: AdminActionParams): Promise<string> {
  const id = crypto.randomUUID()
  const {
    db, adminUserId, action, targetType, targetId,
    before = null, after = null, ip = null,
  } = params

  await db.prepare(
    `INSERT INTO admin_audit_log
       (id, admin_user_id, action, target_type, target_id, before_json, after_json, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    id,
    adminUserId,
    action,
    targetType,
    targetId,
    before !== null ? JSON.stringify(before) : null,
    after  !== null ? JSON.stringify(after)  : null,
    ip,
  ).run()

  return id
}
