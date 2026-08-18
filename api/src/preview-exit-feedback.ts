import app from './preview-entry'
import { cookieNames } from './lib/cookies'

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((value) => value.toString(16).padStart(2, '0')).join('')
}

function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function requirePreviewAuth(c: any, next: any) {
  const rawSession = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!rawSession) return c.json({ ok: false, error: 'Unauthorized' }, 401)

  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id FROM auth_sessions
      WHERE session_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL
      LIMIT 1`,
  ).bind(sessionHash).first()

  if (!session) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  c.set('userId', (session as any).user_id)
  await next()
}

async function trialEligibility(c: any, profileId: string) {
  try {
    const row = await c.env.DB.prepare(
      `SELECT trial_plan_id, trial_ends_at
         FROM profile_plan_overrides
        WHERE profile_id = ?
        LIMIT 1`,
    ).bind(profileId).first()

    const usedTrial = Boolean((row as any)?.trial_plan_id || (row as any)?.trial_ends_at)
    return { eligible: !usedTrial, used_trial: usedTrial }
  } catch {
    // Ante cualquier duda de datos, no ofrecer una segunda prueba por error.
    return { eligible: false, used_trial: true }
  }
}

app.get('/api/v1/me/profile/exit-options', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  const profile = await c.env.DB.prepare(
    `SELECT id, slug FROM profiles WHERE user_id = ? LIMIT 1`,
  ).bind(userId).first()

  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado.' }, 404)
  const trial = await trialEligibility(c, String((profile as any).id))

  return c.json({
    ok: true,
    data: {
      trial_offer_eligible: trial.eligible,
      used_trial: trial.used_trial,
      trial_days: 7,
      trial_plan: 'basic',
    },
  })
})

app.post('/api/v1/me/profile/exit-feedback', requirePreviewAuth, async (c: any) => {
  const userId = c.get('userId') as string
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Invalid JSON' }, 400) }

  const reason = String(body.reason || '').trim().slice(0, 120)
  const improvementOne = String(body.improvement_one || '').trim().slice(0, 600)
  const improvementTwo = String(body.improvement_two || '').trim().slice(0, 600)
  if (!reason) return c.json({ ok: false, error: 'Selecciona el motivo principal.' }, 400)

  const profile = await c.env.DB.prepare(
    `SELECT id, slug FROM profiles WHERE user_id = ? LIMIT 1`,
  ).bind(userId).first()
  if (!profile) return c.json({ ok: false, error: 'Perfil no encontrado.' }, 404)

  const profileId = String((profile as any).id)
  const trial = await trialEligibility(c, profileId)

  await c.env.DB.prepare(
    `INSERT INTO profile_exit_feedback
      (id, user_id, profile_id, profile_slug, reason, improvement_one, improvement_two, trial_offer_eligible, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).bind(
    crypto.randomUUID(),
    userId,
    profileId,
    String((profile as any).slug || ''),
    reason,
    improvementOne || null,
    improvementTwo || null,
    trial.eligible ? 1 : 0,
  ).run()

  return c.json({ ok: true, data: { trial_offer_eligible: trial.eligible } })
})
