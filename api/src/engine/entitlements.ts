import { Context } from 'hono'

export interface Entitlements {
    maxLinks: number
    maxPhotos: number
    maxFaqs: number
    canUseVCard: boolean
}

interface PlanLimits {
    max_links: number
    max_photos: number
    max_faqs: number
    can_use_vcard: number
}

interface ModuleRow {
    effects_json: string
}

interface ModuleEffects {
    extraLinks?: number
    extraPhotos?: number
    extraFaqs?: number
    unlockVCard?: boolean
}

export async function getEntitlements(c: Context, profileId: string): Promise<Entitlements> {
    const db = c.env.DB

    // 1. Obtener límites del plan base
    const baseLimits = await db.prepare(`
    SELECT pl.*
    FROM profiles p
    JOIN plan_limits pl ON p.plan_id = pl.plan_id
    WHERE p.id = ?
  `).bind(profileId).first<PlanLimits>()

    if (!baseLimits) {
        throw new Error('Profile or plan limits not found')
    }

    // 2. Obtener efectos de módulos activos
    const activeModules = await db.prepare(`
    SELECT m.effects_json
    FROM profile_modules pm
    JOIN modules m ON pm.module_code = m.code
    WHERE pm.profile_id = ? AND (pm.expires_at IS NULL OR pm.expires_at > datetime('now'))
  `).bind(profileId).all<ModuleRow>()

    // 3. Inicializar con valores base
    const entitlements: Entitlements = {
        maxLinks: Number(baseLimits.max_links),
        maxPhotos: Number(baseLimits.max_photos),
        maxFaqs: Number(baseLimits.max_faqs),
        canUseVCard: Boolean(baseLimits.can_use_vcard),
    }

    // 4. Fusión incremental (Plan + Módulos)
    activeModules.results.forEach((mod: ModuleRow) => {
        try {
            const effects = JSON.parse(mod.effects_json) as ModuleEffects
            if (effects.extraLinks) entitlements.maxLinks += Number(effects.extraLinks)
            if (effects.extraPhotos) entitlements.maxPhotos += Number(effects.extraPhotos)
            if (effects.extraFaqs) entitlements.maxFaqs += Number(effects.extraFaqs)
            if (effects.unlockVCard) entitlements.canUseVCard = true
        } catch (e) {
            console.error('Error parsing module effects:', e)
        }
    })

    return entitlements
}
