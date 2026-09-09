import app from './index'

const TEAM_CODE_PANEL_HOURS = 48
const TEAM_CODE_PAGE_SIZE = 5

function readPermissions(raw: unknown): string[] {
  try {
    const parsed = JSON.parse(String(raw || '[]'))
    return Array.isArray(parsed) ? Array.from(new Set(parsed.map(String))) : []
  } catch {
    return []
  }
}

async function purgeExpiredUnusedCodes(env: any) {
  if (!env?.DB) return
  await env.DB.prepare(
    `UPDATE team_link_codes
        SET status='expired',updated_at=datetime('now')
      WHERE status='active' AND expires_at<=datetime('now')`,
  ).run()
  await env.DB.prepare(
    `DELETE FROM team_link_codes
      WHERE status!='used'
        AND used_at IS NULL
        AND created_at<=datetime('now','-${TEAM_CODE_PANEL_HOURS} hours')`,
  ).run()
}

async function loadVisibleCodes(c: any, teamId: string, page: number, q: string) {
  const safePage = Math.max(1, Number(page || 1) || 1)
  const offset = (safePage - 1) * TEAM_CODE_PAGE_SIZE
  const like = `%${q}%`

  const [rows, count] = await Promise.all([
    c.env.DB.prepare(
      `SELECT tc.id,tc.code,tc.status,tc.permissions_json,tc.expires_at,tc.used_at,tc.created_at,tc.updated_at,tc.artifact_id,
              u.email used_by_email,p.name member_name,p.slug member_slug,a.public_code product_code,a.product_type
         FROM team_link_codes tc
         LEFT JOIN users u ON u.id=tc.used_by_user_id
         LEFT JOIN profiles p ON p.id=tc.member_profile_id
         LEFT JOIN intap_artifacts a ON a.id=tc.artifact_id
        WHERE tc.team_id=?
          AND tc.created_at>datetime('now','-${TEAM_CODE_PANEL_HOURS} hours')
          AND (?='' OR tc.code LIKE ? OR COALESCE(u.email,'') LIKE ? OR COALESCE(p.name,'') LIKE ? OR COALESCE(a.public_code,'') LIKE ?)
        ORDER BY tc.created_at DESC
        LIMIT ? OFFSET ?`,
    ).bind(teamId, q, like, like, like, like, TEAM_CODE_PAGE_SIZE, offset).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) n
         FROM team_link_codes tc
         LEFT JOIN users u ON u.id=tc.used_by_user_id
         LEFT JOIN profiles p ON p.id=tc.member_profile_id
         LEFT JOIN intap_artifacts a ON a.id=tc.artifact_id
        WHERE tc.team_id=?
          AND tc.created_at>datetime('now','-${TEAM_CODE_PANEL_HOURS} hours')
          AND (?='' OR tc.code LIKE ? OR COALESCE(u.email,'') LIKE ? OR COALESCE(p.name,'') LIKE ? OR COALESCE(a.public_code,'') LIKE ?)`,
    ).bind(teamId, q, like, like, like, like).first(),
  ])

  const total = Number((count as any)?.n || 0)
  return {
    codes: (rows.results || []).map((row: any) => ({
      ...row,
      permissions: readPermissions(row.permissions_json),
      reserved: Boolean(row.artifact_id && !row.used_at),
    })),
    pagination: {
      page: safePage,
      page_size: TEAM_CODE_PAGE_SIZE,
      total,
      pages: Math.max(1, Math.ceil(total / TEAM_CODE_PAGE_SIZE)),
    },
  }
}

app.use('/api/v1/me/team*', async (c: any, next: any) => {
  await purgeExpiredUnusedCodes(c.env)
  await next()

  if (c.req.method !== 'GET') return
  if (!['/api/v1/me/team', '/api/v1/me/team/manage'].includes(c.req.path)) return
  if (!c.res?.ok) return

  let payload: any
  try {
    payload = await c.res.clone().json()
  } catch {
    return
  }
  if (!payload?.ok || !payload?.data?.team?.id) return

  const teamId = String(payload.data.team.id)
  const q = String(c.req.query('q') || '').trim()
  const page = Math.max(1, Number(c.req.query('page') || 1) || 1)
  const visible = await loadVisibleCodes(c, teamId, page, q)

  payload.data.codes = visible.codes
  payload.data.pagination = visible.pagination
  return c.json(payload, c.res.status as any)
})

export { purgeExpiredUnusedCodes }
