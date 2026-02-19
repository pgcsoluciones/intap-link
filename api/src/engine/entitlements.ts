import { Context } from 'hono'

export interface Entitlements {
    maxLinks: number
    maxPhotos: number
    maxFaqs: number
    canUseVCard: boolean
    allowedTemplates: string[]
}

export async function getEntitlements(c: Context, profileId: string): Promise<Entitlements> {
    const db = c.env.DB

    // 1. Obtener límites del plan base
    const baseLimits = await db.prepare(`
    SELECT pl.*
    FROM profiles p
    JOIN plan_limits pl ON p.plan_id = pl.plan_id
    WHERE p.id = ?
  `).bind(profileId).first()

    if (!baseLimits) {
        throw new Error('Profile or plan limits not found')
    }

    // 2. Obtener efectos de módulos activos
    const activeModules = await db.prepare(`
    SELECT m.effects_json
    FROM profile_modules pm
    JOIN modules m ON pm.module_code = m.code
    WHERE pm.profile_id = ? AND (pm.expires_at IS NULL OR pm.expires_at > datetime('now'))
  `).bind(profileId).all()

    // 3. Inicializar con valores base
    let entitlements: Entitlements = {
        maxLinks: Number(baseLimits.max_links),
        maxPhotos: Number(baseLimits.max_photos),
        maxFaqs: Number(baseLimits.max_faqs),
        canUseVCard: Boolean(baseLimits.can_use_vcard),
        allowedTemplates: []
    }

    // 4. Fusión incremental (Plan + Módulos)
    activeModules.results.forEach((mod: any) => {
        try {
            const effects = JSON.parse(mod.effects_json)
            if (effects.extraLinks) entitlements.maxLinks += Number(effects.extraLinks)
            if (effects.extraPhotos) entitlements.maxPhotos += Number(effects.extraPhotos)
            if (effects.extraFaqs) entitlements.maxFaqs += Number(effects.extraFaqs)
            if (effects.unlockVCard) entitlements.canUseVCard = true
        } catch (e) {
            console.error('Error parsing module effects:', e)
        }
    })

    // 5. Resolver allowedTemplates: backend traduce required_tool → IDs accesibles
    // El frontend nunca evalúa required_tool; solo consulta este array.
    try {
        const templateRows = await db.prepare(`
      SELECT id FROM templates
      WHERE required_tool IS NULL
         OR required_tool IN (
           SELECT module_code FROM profile_modules
           WHERE profile_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
         )
    `).bind(profileId).all()
        entitlements.allowedTemplates = templateRows.results.map((r: any) => r.id)
    } catch {
        // Tabla templates puede no existir aún durante migración
        entitlements.allowedTemplates = []
    }

    return entitlements
}
