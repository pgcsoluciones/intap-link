import { Context } from 'hono'

export interface Entitlements {
    maxLinks: number
    maxPhotos: number
    maxFaqs: number
    maxProducts: number
    maxVideos: number
    canUseVCard: boolean
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
        maxLinks:    Number(baseLimits.max_links),
        maxPhotos:   Number(baseLimits.max_photos),
        maxFaqs:     Number(baseLimits.max_faqs),
        maxProducts: Number((baseLimits as any).max_products ?? 3),
        maxVideos:   Number((baseLimits as any).max_videos   ?? 1),
        canUseVCard: Boolean(baseLimits.can_use_vcard),
    }

    // 4. Fusión incremental (Plan + Módulos)
    activeModules.results.forEach((mod: any) => {
        try {
            const effects = JSON.parse(mod.effects_json)
            if (effects.extraLinks)    entitlements.maxLinks    += Number(effects.extraLinks)
            if (effects.extraPhotos)   entitlements.maxPhotos   += Number(effects.extraPhotos)
            if (effects.extraFaqs)     entitlements.maxFaqs     += Number(effects.extraFaqs)
            if (effects.extraProducts) entitlements.maxProducts += Number(effects.extraProducts)
            if (effects.extraVideos)   entitlements.maxVideos   += Number(effects.extraVideos)
            if (effects.unlockVCard)   entitlements.canUseVCard  = true
        } catch (e) {
            console.error('Error parsing module effects:', e)
        }
    })

    // 5. Admin overrides (profile_plan_overrides) — applied last, take precedence.
    //    trial_plan_id is handled here: if trial is active, swap base limits first.
    //    Individual field overrides (max_links, etc.) always win over trial plan.
    //    If the table doesn't exist yet (pre-migration), query failure is silenced.
    try {
        const override = await db.prepare(`
      SELECT ppo.*, pl.max_links as t_max_links, pl.max_photos as t_max_photos,
             pl.max_faqs as t_max_faqs, pl.max_products as t_max_products,
             pl.max_videos as t_max_videos, pl.can_use_vcard as t_can_use_vcard
      FROM profile_plan_overrides ppo
      LEFT JOIN plan_limits pl ON ppo.trial_plan_id = pl.plan_id
      WHERE ppo.profile_id = ?
      LIMIT 1
    `).bind(profileId).first()

        if (override) {
            const ov = override as any
            const trialActive = ov.trial_ends_at
                ? new Date(ov.trial_ends_at + 'Z') > new Date()
                : false

            // Apply trial plan limits if trial is active and trial_plan_id is set
            if (trialActive && ov.trial_plan_id && ov.t_max_links != null) {
                entitlements.maxLinks    = Number(ov.t_max_links)
                entitlements.maxPhotos   = Number(ov.t_max_photos)
                entitlements.maxFaqs     = Number(ov.t_max_faqs)
                entitlements.maxProducts = Number(ov.t_max_products)
                entitlements.maxVideos   = Number(ov.t_max_videos)
                entitlements.canUseVCard = Boolean(ov.t_can_use_vcard)
                // Re-apply modules on top of trial plan
                activeModules.results.forEach((mod: any) => {
                    try {
                        const effects = JSON.parse(mod.effects_json)
                        if (effects.extraLinks)    entitlements.maxLinks    += Number(effects.extraLinks)
                        if (effects.extraPhotos)   entitlements.maxPhotos   += Number(effects.extraPhotos)
                        if (effects.extraFaqs)     entitlements.maxFaqs     += Number(effects.extraFaqs)
                        if (effects.extraProducts) entitlements.maxProducts += Number(effects.extraProducts)
                        if (effects.extraVideos)   entitlements.maxVideos   += Number(effects.extraVideos)
                        if (effects.unlockVCard)   entitlements.canUseVCard  = true
                    } catch { /* ignore */ }
                })
            }

            // Field-level overrides always win (even over trial plan)
            if (ov.max_links    != null) entitlements.maxLinks    = Number(ov.max_links)
            if (ov.max_photos   != null) entitlements.maxPhotos   = Number(ov.max_photos)
            if (ov.max_faqs     != null) entitlements.maxFaqs     = Number(ov.max_faqs)
            if (ov.max_products != null) entitlements.maxProducts = Number(ov.max_products)
            if (ov.max_videos   != null) entitlements.maxVideos   = Number(ov.max_videos)
            if (ov.can_use_vcard != null) entitlements.canUseVCard = Boolean(ov.can_use_vcard)
        }
    } catch (e) {
        // Table may not exist before migration 0023 runs — safe to skip
        console.warn('[entitlements] profile_plan_overrides query failed (pre-migration?):', String(e))
    }

    return entitlements
}
