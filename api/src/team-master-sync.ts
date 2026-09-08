import app from './index'
import { cookieNames } from './lib/cookies'

function readPermissions(raw: unknown) {
  try {
    const parsed = JSON.parse(String(raw || '[]'))
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch { return new Set<string>() }
}

function readObject(raw: unknown): Record<string, any> {
  try {
    const parsed = JSON.parse(String(raw || '{}'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch { return {} }
}

export async function syncTeamMemberFromMaster(c: any, memberProfileId: string, initialClone = false) {
  const relation = await c.env.DB.prepare(`
    SELECT tm.id member_id,tm.permissions_json,tm.profile_id,tm.admin_role,tw.master_profile_id
      FROM team_members tm
      JOIN team_workspaces tw ON tw.id=tm.team_id
     WHERE tm.profile_id=? AND tm.status='active' AND tw.status='active'
     LIMIT 1
  `).bind(memberProfileId).first()
  if (!relation) return { team_member: false, changed: false }

  const memberId = String((relation as any).member_id)
  const masterId = String((relation as any).master_profile_id)
  const adminRole = String((relation as any).admin_role || 'member')
  const permissions = readPermissions((relation as any).permissions_json)

  // Un miembro normal no tiene panel propio: RR. HH. administra su tarjeta.
  // Por eso TODO el contenido corporativo debe seguir al Master aunque el código
  // original haya llevado permisos. Los permisos solo pueden crear divergencia
  // cuando el miembro tiene un rol administrativo con acceso al panel.
  const memberOwns = (section: string) =>
    (adminRole === 'editor' || adminRole === 'subadmin') && permissions.has(section)

  const [master, member] = await Promise.all([
    c.env.DB.prepare(`SELECT bio,category,subcategory,theme_id,layout_id,free_palette_id,free_brand_color,hero_url,hero_position_x,hero_position_y,hero_zoom,accent_color,button_style,template_id,template_data,blocks_order FROM profiles WHERE id=? LIMIT 1`).bind(masterId).first(),
    c.env.DB.prepare(`SELECT template_data FROM profiles WHERE id=? LIMIT 1`).bind(memberProfileId).first(),
  ])
  if (!master || !member) return { team_member: true, changed: false }

  const masterTemplate = readObject((master as any).template_data)
  const memberTemplate = readObject((member as any).template_data)
  const preserved = {
    role: memberTemplate.role,
    free_identity_confirmed: memberTemplate.free_identity_confirmed,
    team_member: true,
    team_id: memberTemplate.team_id,
    team_master_profile_id: masterId,
    team_permissions: memberTemplate.team_permissions,
    team_access_role: memberTemplate.team_access_role,
    team_joined_at: memberTemplate.team_joined_at,
  }
  const mergedTemplate = { ...masterTemplate, ...preserved }

  const statements: any[] = []

  if (initialClone || !memberOwns('design')) {
    statements.push(c.env.DB.prepare(`
      UPDATE profiles SET
        theme_id=?,layout_id=?,free_palette_id=?,free_brand_color=?,hero_url=?,
        hero_position_x=?,hero_position_y=?,hero_zoom=?,accent_color=?,button_style=?,template_id=?,blocks_order=?,
        updated_at=datetime('now')
      WHERE id=?
    `).bind(
      (master as any).theme_id ?? null,(master as any).layout_id ?? null,(master as any).free_palette_id ?? null,
      (master as any).free_brand_color ?? null,(master as any).hero_url ?? null,(master as any).hero_position_x ?? 50,
      (master as any).hero_position_y ?? 50,(master as any).hero_zoom ?? 1,(master as any).accent_color ?? null,
      (master as any).button_style ?? null,(master as any).template_id ?? null,(master as any).blocks_order ?? null,memberProfileId,
    ))
  }

  statements.push(c.env.DB.prepare(`
    UPDATE profiles SET bio=?,category=?,subcategory=?,template_data=?,updated_at=datetime('now') WHERE id=?
  `).bind((master as any).bio ?? null,(master as any).category ?? null,(master as any).subcategory ?? null,JSON.stringify(mergedTemplate),memberProfileId))

  if (initialClone || !memberOwns('location')) {
    statements.push(c.env.DB.prepare(`
      INSERT INTO profile_contact(profile_id,whatsapp,email,phone,hours,address,map_url,updated_at)
      SELECT ?,mc.whatsapp,mc.email,mc.phone,master.hours,master.address,master.map_url,datetime('now')
        FROM profile_contact master
        LEFT JOIN profile_contact mc ON mc.profile_id=?
       WHERE master.profile_id=?
      ON CONFLICT(profile_id) DO UPDATE SET
        hours=excluded.hours,address=excluded.address,map_url=excluded.map_url,updated_at=datetime('now')
    `).bind(memberProfileId,memberProfileId,masterId))
  }

  if (initialClone || !memberOwns('links')) {
    statements.push(c.env.DB.prepare(`DELETE FROM profile_links WHERE profile_id=?`).bind(memberProfileId))
    const rows = await c.env.DB.prepare(`SELECT id,label,url,sort_order,is_active,is_cta FROM profile_links WHERE profile_id=? ORDER BY sort_order`).bind(masterId).all()
    for (const row of rows.results as any[]) {
      statements.push(c.env.DB.prepare(`INSERT INTO profile_links(id,profile_id,label,url,sort_order,is_active,is_cta) VALUES(?,?,?,?,?,?,?)`).bind(`team-sync:${memberId}:link:${row.id}`,memberProfileId,row.label,row.url,row.sort_order,row.is_active,row.is_cta))
    }
  }

  if (initialClone || !memberOwns('portfolio')) {
    statements.push(c.env.DB.prepare(`DELETE FROM profile_gallery WHERE profile_id=?`).bind(memberProfileId))
    const rows = await c.env.DB.prepare(`SELECT id,image_key,alt_text,title,description,sort_order FROM profile_gallery WHERE profile_id=? ORDER BY sort_order`).bind(masterId).all()
    for (const row of rows.results as any[]) {
      statements.push(c.env.DB.prepare(`INSERT INTO profile_gallery(id,profile_id,image_key,alt_text,title,description,sort_order) VALUES(?,?,?,?,?,?,?)`).bind(`team-sync:${memberId}:gallery:${row.id}`,memberProfileId,row.image_key,row.alt_text,row.title,row.description,row.sort_order))
    }
  }

  if (initialClone || !memberOwns('services')) {
    statements.push(c.env.DB.prepare(`DELETE FROM profile_products WHERE profile_id=?`).bind(memberProfileId))
    const rows = await c.env.DB.prepare(`SELECT id,title,description,price,image_url,whatsapp_text,is_featured,sort_order FROM profile_products WHERE profile_id=? ORDER BY sort_order`).bind(masterId).all()
    for (const row of rows.results as any[]) {
      statements.push(c.env.DB.prepare(`INSERT INTO profile_products(id,profile_id,title,description,price,image_url,whatsapp_text,is_featured,sort_order) VALUES(?,?,?,?,?,?,?,?,?)`).bind(`team-sync:${memberId}:service:${row.id}`,memberProfileId,row.title,row.description,row.price,row.image_url,row.whatsapp_text,row.is_featured,row.sort_order))
    }
  }

  if (initialClone || !memberOwns('quick_actions')) {
    statements.push(c.env.DB.prepare(`DELETE FROM profile_social_links WHERE profile_id=?`).bind(memberProfileId))
    const rows = await c.env.DB.prepare(`SELECT id,type,url,sort_order,enabled FROM profile_social_links WHERE profile_id=? ORDER BY sort_order`).bind(masterId).all()
    for (const row of rows.results as any[]) {
      statements.push(c.env.DB.prepare(`INSERT INTO profile_social_links(id,profile_id,type,url,sort_order,enabled) VALUES(?,?,?,?,?,?)`).bind(`team-sync:${memberId}:social:${row.id}`,memberProfileId,row.type,row.url,row.sort_order,row.enabled))
    }
  }

  // La habilitación de módulos NO se deduce de una lista fija de secciones Team.
  // El miembro refleja exactamente los módulos que el Master tenga habilitados
  // en profile_modules (incluidos módulos añadidos por promociones o en el futuro).
  statements.push(c.env.DB.prepare(`DELETE FROM profile_modules WHERE profile_id=?`).bind(memberProfileId))
  const moduleRows = await c.env.DB.prepare(`SELECT module_code,expires_at,activated_at FROM profile_modules WHERE profile_id=?`).bind(masterId).all()
  for (const row of moduleRows.results as any[]) {
    statements.push(c.env.DB.prepare(`INSERT INTO profile_modules(profile_id,module_code,expires_at,activated_at) VALUES(?,?,?,?)`).bind(memberProfileId,row.module_code,row.expires_at,row.activated_at))
  }

  // Contenido corporativo adicional que no forma parte de los campos variables
  // del miembro. Se copia según los datos reales presentes en el Master; si el
  // Master no usa una sección, el miembro queda igualmente vacío.
  statements.push(c.env.DB.prepare(`DELETE FROM profile_faqs WHERE profile_id=?`).bind(memberProfileId))
  const faqRows = await c.env.DB.prepare(`SELECT id,question,answer,sort_order FROM profile_faqs WHERE profile_id=? ORDER BY sort_order`).bind(masterId).all()
  for (const row of faqRows.results as any[]) {
    statements.push(c.env.DB.prepare(`INSERT INTO profile_faqs(id,profile_id,question,answer,sort_order) VALUES(?,?,?,?,?)`).bind(`team-sync:${memberId}:faq:${row.id}`,memberProfileId,row.question,row.answer,row.sort_order))
  }

  statements.push(c.env.DB.prepare(`DELETE FROM profile_videos WHERE profile_id=?`).bind(memberProfileId))
  const videoRows = await c.env.DB.prepare(`SELECT id,title,url,sort_order FROM profile_videos WHERE profile_id=? ORDER BY sort_order`).bind(masterId).all()
  for (const row of videoRows.results as any[]) {
    statements.push(c.env.DB.prepare(`INSERT INTO profile_videos(id,profile_id,title,url,sort_order) VALUES(?,?,?,?,?)`).bind(`team-sync:${memberId}:video:${row.id}`,memberProfileId,row.title,row.url,row.sort_order))
  }

  statements.push(c.env.DB.prepare(`DELETE FROM profile_bank_settings WHERE profile_id=?`).bind(memberProfileId))
  statements.push(c.env.DB.prepare(`
    INSERT INTO profile_bank_settings(profile_id,is_enabled,updated_at)
    SELECT ?,is_enabled,datetime('now') FROM profile_bank_settings WHERE profile_id=?
  `).bind(memberProfileId,masterId))

  statements.push(c.env.DB.prepare(`DELETE FROM profile_bank_accounts WHERE profile_id=?`).bind(memberProfileId))
  const bankRows = await c.env.DB.prepare(`
    SELECT id,bank_code,bank_name,account_number,account_type,currency,holder_name,
           holder_id_type,holder_id_number,display_mode,sort_order,is_active,created_at
      FROM profile_bank_accounts
     WHERE profile_id=? ORDER BY sort_order
  `).bind(masterId).all()
  for (const row of bankRows.results as any[]) {
    statements.push(c.env.DB.prepare(`
      INSERT INTO profile_bank_accounts(
        id,profile_id,bank_code,bank_name,account_number,account_type,currency,holder_name,
        holder_id_type,holder_id_number,display_mode,sort_order,is_active,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    `).bind(
      `team-sync:${memberId}:bank:${row.id}`,memberProfileId,row.bank_code,row.bank_name,row.account_number,
      row.account_type,row.currency,row.holder_name,row.holder_id_type,row.holder_id_number,row.display_mode,
      row.sort_order,row.is_active,row.created_at,
    ))
  }

  if (statements.length) await c.env.DB.batch(statements)
  return { team_member: true, changed: statements.length > 0 }
}

async function sha256Hex(input: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
function parseCookie(header:string,name:string){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=header.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));return m?decodeURIComponent(m[1]):null}
async function masterUser(c:any){const raw=parseCookie(c.req.header('Cookie')||'',cookieNames(c.env).session);if(!raw)return null;const row=await c.env.DB.prepare(`SELECT user_id FROM auth_sessions WHERE session_hash=? AND expires_at>datetime('now') AND revoked_at IS NULL LIMIT 1`).bind(await sha256Hex(raw)).first();return row?String((row as any).user_id||''):null}

app.post('/api/v1/me/team/sync-members', async (c:any) => {
  const userId=await masterUser(c)
  if(!userId)return c.json({ok:false,error:'Unauthorized'},401)
  const team=await c.env.DB.prepare(`SELECT id FROM team_workspaces WHERE owner_user_id=? AND status='active' LIMIT 1`).bind(userId).first()
  if(!team)return c.json({ok:false,error:'Solo el Administrador Master puede sincronizar el Team.'},403)
  const members=await c.env.DB.prepare(`SELECT profile_id FROM team_members WHERE team_id=? AND status='active'`).bind(String((team as any).id)).all()
  let synced=0
  for(const row of members.results as any[]){const result=await syncTeamMemberFromMaster(c,String(row.profile_id));if(result.changed)synced+=1}
  return c.json({ok:true,data:{synced,total:(members.results||[]).length}})
})

export default app
