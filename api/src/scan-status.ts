import app from './index'
import { cookieNames, isPreviewEnvironment } from './lib/cookies'
import { isPublicCodeShape } from './artifacts'

function configuredWebUrl(c: any): string {
  const fallback = isPreviewEnvironment(c.env) ? 'https://preview.intaprd.com' : 'https://intaprd.com'
  return String(c.env.WEB_URL || fallback).replace(/\/$/, '')
}

function configuredAppUrl(c: any): string {
  const fallback = isPreviewEnvironment(c.env) ? 'https://app.preview.intaprd.com' : 'https://app.intaprd.com'
  return String(c.env.APP_URL || fallback).replace(/\/$/, '')
}

function parseCookie(header: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sessionUserId(c: any): Promise<string | null> {
  const rawSession = parseCookie(c.req.header('Cookie') || '', cookieNames(c.env).session)
  if (!rawSession) return null
  const sessionHash = await sha256Hex(rawSession)
  const session = await c.env.DB.prepare(
    `SELECT user_id FROM auth_sessions
      WHERE session_hash = ? AND expires_at > datetime('now') AND revoked_at IS NULL LIMIT 1`,
  ).bind(sessionHash).first()
  return session ? String((session as any).user_id) : null
}

function productLabel(type: string): string {
  const labels: Record<string, string> = {
    card: 'Tarjeta NFC', ping: 'Ping NFC', bracelet: 'Pulsera NFC', keychain: 'Llavero NFC',
    stand: 'Estación de Contacto', qr: 'Código QR', other: 'Producto Kawvo',
  }
  return labels[type] || labels.other
}

app.post('/api/v1/public/artifacts/scan/status', async (c: any) => {
  let body: any = {}
  try { body = await c.req.json() } catch { return c.json({ ok: false, error: 'Solicitud inválida.' }, 400) }

  const publicCode = String(body?.public_code || '').trim().toUpperCase()
  if (!isPublicCodeShape(publicCode)) return c.json({ ok: false, error: 'Producto no válido.' }, 400)

  const artifact = await c.env.DB.prepare(
    `SELECT a.id, a.public_code, a.product_type, a.status, a.owner_user_id, a.profile_id,
            p.slug AS profile_slug, p.user_id AS profile_user_id, p.is_active AS profile_is_active, p.is_published AS profile_is_published,
            tm.id AS team_member_id, tm.user_id AS team_member_user_id, tm.status AS team_member_status, tm.admin_role AS team_admin_role,
            tw.id AS team_id, tw.name AS team_name, tw.master_profile_id AS team_master_profile_id,
            mp.slug AS team_master_slug, mp.name AS team_master_name
       FROM intap_artifacts a
       LEFT JOIN profiles p ON p.id = a.profile_id
       LEFT JOIN team_members tm ON tm.artifact_id = a.id
       LEFT JOIN team_workspaces tw ON tw.id = tm.team_id
       LEFT JOIN profiles mp ON mp.id = tw.master_profile_id
      WHERE a.public_code = ? LIMIT 1`,
  ).bind(publicCode).first()

  if (!artifact) return c.json({ ok: false, error: 'Producto no encontrado.' }, 404)

  const artifactId = String((artifact as any).id)
  const status = String((artifact as any).status || '')
  const productType = String((artifact as any).product_type || 'other')
  const profileSlug = String((artifact as any).profile_slug || '').trim()
  const teamMemberId = String((artifact as any).team_member_id || '')
  const teamMemberUserId = String((artifact as any).team_member_user_id || '')
  const currentUserId = await sessionUserId(c)
  const base = { public_code: publicCode, product_type: productType, label: productLabel(productType) }

  // Sponsored Profile is isolated from Free/Team. A sponsor assignment takes precedence
  // only for artifacts explicitly registered in sponsor_artifacts.
  const sponsored = await c.env.DB.prepare(
    `SELECT sa.sponsor_id,sa.status AS sponsor_artifact_status,sa.artifact_role,sa.beneficiary_user_id,
            sp.id AS sponsored_profile_id,sp.username,sp.status AS sponsored_profile_status,sp.user_id AS sponsored_user_id,
            st.name AS sponsor_name,st.logo_url AS sponsor_logo_url,st.banner_title,st.sponsor_type,st.is_active AS sponsor_is_active
       FROM sponsor_artifacts sa
       JOIN sponsor_tenants st ON st.id=sa.sponsor_id
       LEFT JOIN sponsored_profiles sp ON sp.id=sa.sponsored_profile_id
      WHERE sa.artifact_id=? LIMIT 1`,
  ).bind(artifactId).first().catch(() => null)

  if (sponsored) {
    const sponsorActive = Number((sponsored as any).sponsor_is_active) === 1
    const artifactRole = String((sponsored as any).artifact_role || 'beneficiary')
    const sponsorId = String((sponsored as any).sponsor_id || '')
    const sponsor = {
      id: sponsorId,
      name: String((sponsored as any).sponsor_name || 'Patrocinador'),
      logo_url: String((sponsored as any).sponsor_logo_url || ''),
      banner_title: String((sponsored as any).banner_title || 'Impulsado por'),
      type: String((sponsored as any).sponsor_type || 'merchant'),
    }

    if (artifactRole === 'master') {
      const membership = currentUserId ? await c.env.DB.prepare(`SELECT role FROM sponsor_members WHERE sponsor_id=? AND user_id=? AND status='active' LIMIT 1`).bind(sponsorId, currentUserId).first() : null
      return c.json({
        ok: true,
        state: membership ? 'sponsored_master' : 'sponsored_master_login',
        artifact: base,
        sponsor,
        message: membership ? `Este es tu llavero Master · código ${publicCode}.` : 'Este llavero Master requiere iniciar sesión como patrocinador.',
        manage_url: membership ? `${configuredAppUrl(c)}/admin/sponsor` : null,
        login_url: membership ? null : `${configuredAppUrl(c)}/admin/login?resume_sponsor=1&public_code=${encodeURIComponent(publicCode)}`,
      })
    }

    if (!sponsorActive) return c.json({ ok: true, state: 'blocked', artifact: base, message: 'Este patrocinio no está disponible actualmente.' })

    const sponsoredStatus = String((sponsored as any).sponsor_artifact_status || '')
    const sponsoredProfileStatus = String((sponsored as any).sponsored_profile_status || '')
    const sponsoredUsername = String((sponsored as any).username || '')
    const sponsoredUserId = String((sponsored as any).sponsored_user_id || (sponsored as any).beneficiary_user_id || '')

    if (sponsoredStatus === 'activated') {
      if (sponsoredProfileStatus === 'published' && sponsoredUsername) {
        return c.json({ ok: true, state: 'activated', artifact: base, sponsor, next_url: `${configuredWebUrl(c)}/p/${encodeURIComponent(sponsoredUsername)}` })
      }
      const isOwner = Boolean(currentUserId && sponsoredUserId && currentUserId === sponsoredUserId)
      return c.json({
        ok: true,
        state: isOwner ? 'sponsored_draft_owner' : 'sponsored_draft',
        artifact: base,
        sponsor,
        message: isOwner ? 'Tu presentación patrocinada todavía está en construcción.' : 'Esta presentación todavía está en construcción.',
        next_url: isOwner ? `${configuredAppUrl(c)}/admin/sponsored` : null,
        login_url: isOwner ? null : `${configuredAppUrl(c)}/admin/login?resume_sponsored=1&public_code=${encodeURIComponent(publicCode)}`,
      })
    }

    if (sponsoredStatus === 'inactive') return c.json({ ok: true, state: 'blocked', artifact: base, sponsor, message: 'Este producto patrocinado está inactivo.' })

    const activationCode = await c.env.DB.prepare(
      `SELECT id FROM artifact_activation_codes WHERE artifact_id=? AND status='active' AND (expires_at IS NULL OR expires_at>datetime('now')) ORDER BY created_at DESC,id DESC LIMIT 1`,
    ).bind(artifactId).first()
    if (!activationCode) return c.json({ ok: true, state: 'not_ready', artifact: base, sponsor, message: 'Este producto patrocinado todavía no está habilitado para activación.' })

    return c.json({
      ok: true,
      state: 'sponsored_pending_activation',
      artifact: base,
      sponsor,
      message: 'Impulsamos tu crecimiento digital. Activa ahora tu llavero y personaliza tu presentación.',
      next_url: `${configuredAppUrl(c)}/admin/sponsored/activate?public_code=${encodeURIComponent(publicCode)}`,
    })
  }

  // Un producto Team ya vinculado nunca vuelve a mostrar activación.
  if (teamMemberId) {
    const profileIsActive = Number((artifact as any).profile_is_active) === 1
    const profileIsPublished = Number((artifact as any).profile_is_published) === 1
    const memberActive = String((artifact as any).team_member_status || '') === 'active'

    if (status === 'activated' && memberActive && profileSlug && profileIsActive && profileIsPublished) {
      return c.json({ ok: true, state: 'activated', artifact: base, next_url: `${configuredWebUrl(c)}/${encodeURIComponent(profileSlug)}` })
    }

    const isRoleUser = ['editor', 'subadmin'].includes(String((artifact as any).team_admin_role || 'member'))
    const canOpenTeam = Boolean(currentUserId && currentUserId === teamMemberUserId && isRoleUser)
    const notAssigned = !profileSlug || !String((artifact as any).profile_id || '')
    return c.json({
      ok: true,
      state: notAssigned ? 'team_unassigned' : (status === 'suspended' || !memberActive ? 'team_unavailable' : 'team_pending'),
      artifact: base,
      team: { id: String((artifact as any).team_id || ''), name: String((artifact as any).team_name || (artifact as any).team_master_name || 'Team') },
      message: notAssigned ? 'Este dispositivo pertenece a un Team, pero todavía no tiene un perfil asignado.' : status === 'suspended' || !memberActive ? 'El perfil de este dispositivo no está disponible actualmente.' : 'Este dispositivo pertenece a un Team y su perfil todavía no está publicado.',
      manage_url: canOpenTeam ? `${configuredAppUrl(c)}/admin/free/team` : null,
    })
  }

  if (status === 'activated') {
    const profileIsActive = Number((artifact as any).profile_is_active) === 1
    const profileIsPublished = Number((artifact as any).profile_is_published) === 1

    if (profileSlug && profileIsActive && profileIsPublished) {
      return c.json({ ok: true, state: 'activated', artifact: base, next_url: `${configuredWebUrl(c)}/${encodeURIComponent(profileSlug)}` })
    }

    if (profileSlug && profileIsActive && !profileIsPublished) {
      const ownerUserId = String((artifact as any).owner_user_id || '')
      const profileUserId = String((artifact as any).profile_user_id || '')
      const isOwner = Boolean(currentUserId && (currentUserId === ownerUserId || currentUserId === profileUserId))
      return c.json({
        ok: true,
        state: isOwner ? 'profile_draft_owner' : 'profile_draft',
        artifact: base,
        message: isOwner ? 'Tu Perfil Digital todavía está en construcción.' : 'Este Perfil Digital todavía está en construcción.',
        next_url: isOwner ? `${configuredAppUrl(c)}/admin/free` : null,
        login_url: isOwner ? null : `${configuredAppUrl(c)}/admin/login?resume_profile=1&public_code=${encodeURIComponent(publicCode)}`,
      })
    }

    return c.json({ ok: true, state: 'unavailable', artifact: base, message: 'El Perfil Digital vinculado a este producto no está disponible actualmente.' })
  }

  if (status === 'suspended' || status === 'revoked') return c.json({ ok: true, state: 'blocked', artifact: base, message: 'Este producto no está disponible actualmente.' })
  if ((artifact as any).owner_user_id || !['available', 'unassigned'].includes(status)) return c.json({ ok: true, state: 'unavailable', artifact: base, message: 'Este producto ya no está disponible para activación.' })

  const activationCode = await c.env.DB.prepare(
    `SELECT id FROM artifact_activation_codes WHERE artifact_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > datetime('now')) ORDER BY created_at DESC, id DESC LIMIT 1`,
  ).bind(artifactId).first()
  if (!activationCode) return c.json({ ok: true, state: 'not_ready', artifact: base, message: 'Este producto todavía no está habilitado para activación.' })
  return c.json({ ok: true, state: 'pending_activation', artifact: base })
})

export default app
