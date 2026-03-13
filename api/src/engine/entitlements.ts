import { Context } from 'hono'

// ─── Core entitlements interface (límites del plan vigente) ─────────────────

export interface Entitlements {
    maxLinks: number
    maxPhotos: number
    maxFaqs: number
    maxProducts: number
    maxVideos: number
    canUseVCard: boolean
}

// ─── Retention interfaces (estado funcional de recursos) ────────────────────

export interface ResourceRetention {
    /** Total de ítems en DB */
    used: number
    /** Máximo permitido por el plan vigente */
    allowed: number
    /** Ítems que exceden el plan (= used - allowed, mínimo 0) */
    exceeded: number
    /** IDs de los primeros `allowed` ítems (por sort_order): están activos */
    active_ids: string[]
    /** IDs de ítems más allá del límite: conservados pero bloqueados */
    exceeded_ids: string[]
    /** true si el usuario tiene más ítems de los permitidos */
    requires_selection: boolean
}

export interface PausedModule {
    module_code: string
    module_name: string
    /** Fecha de vencimiento; null si se revocó sin fecha */
    expired_at: string | null
    paused_reason: 'expired' | 'plan_insufficient'
}

export interface RetentionStatus {
    /** Plan base activo (sin trial) */
    plan_code: string
    resources: {
        links: ResourceRetention
        photos: ResourceRetention
        faqs: ResourceRetention
        products: ResourceRetention
        videos: ResourceRetention
    }
    /** Módulos que estaban activos y ya vencieron */
    paused_modules: PausedModule[]
    /** true si algún recurso tiene ítems que exceden el plan */
    requires_selection: boolean
    /** Cantidad de features/bloques funcionales pausados (módulos + tipos de recurso excedidos) */
    paused_features_count: number
    /** Cantidad total de ítems conservados pero bloqueados */
    recoverable_items_count: number
    trial_status: 'active' | 'expired' | 'none'
    trial_expires_at: string | null
    /**
     * V1: null (se expone cuando se implemente billing lifecycle en V2).
     * Indica cuándo un downgrade pagado entra en vigor.
     */
    downgrade_effective_at: string | null
}

// ─── getEntitlements ──────────────────────────────────────────────────────────
// Calcula los límites vigentes del plan para un perfil.
// Precedencia (mayor a menor): override admin > plan trial > módulos > plan base.

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

// ─── getRetentionStatus ───────────────────────────────────────────────────────
// Calcula el estado funcional de retención: qué está dentro del plan, qué excede,
// qué módulos están pausados. NO modifica datos — solo lectura + audit side-effects.
//
// Regla central: nunca borrar data. Solo cambiar el estado funcional calculado.
// "Activo" = los primeros `allowed` ítems (por sort_order ascendente).
// "Excedente/bloqueado" = ítems con índice >= allowed.

export async function getRetentionStatus(
    c: Context,
    profileId: string,
    ents?: Entitlements,
): Promise<RetentionStatus> {
    const db = c.env.DB

    // Usar entitlements proporcionados o calcularlos
    const entitlements = ents ?? await getEntitlements(c, profileId)

    // Plan base + info de trial
    const profileRow = await db.prepare(`
        SELECT p.plan_id, ppo.trial_ends_at, ppo.trial_plan_id
        FROM profiles p
        LEFT JOIN profile_plan_overrides ppo ON ppo.profile_id = p.id
        WHERE p.id = ?
        LIMIT 1
    `).bind(profileId).first().catch(() => null)

    const planCode     = (profileRow as any)?.plan_id      ?? 'free'
    const trialEndsAt  = (profileRow as any)?.trial_ends_at ?? null
    const trialActive  = trialEndsAt ? new Date(trialEndsAt + 'Z') > new Date() : false
    const trialExpired = trialEndsAt ? !trialActive : false
    const trialStatus: 'active' | 'expired' | 'none' =
        trialActive ? 'active' : (trialExpired ? 'expired' : 'none')

    // IDs de recursos ordenados por sort_order — determina cuáles son "activos"
    const [linksRes, photosRes, faqsRes, productsRes, videosRes, expiredModulesRes] =
        await Promise.all([
            db.prepare(`SELECT id FROM profile_links   WHERE profile_id = ? ORDER BY sort_order ASC`).bind(profileId).all(),
            db.prepare(`SELECT id FROM profile_gallery WHERE profile_id = ? ORDER BY sort_order ASC`).bind(profileId).all(),
            db.prepare(`SELECT id FROM profile_faqs    WHERE profile_id = ? ORDER BY sort_order ASC`).bind(profileId).all(),
            db.prepare(`SELECT id FROM profile_products WHERE profile_id = ? ORDER BY sort_order ASC`).bind(profileId).all(),
            db.prepare(`SELECT id FROM profile_videos  WHERE profile_id = ? ORDER BY sort_order ASC`).bind(profileId).all(),
            // Módulos que existían pero ya vencieron (conservados en DB, no activos)
            db.prepare(`
                SELECT pm.module_code, pm.expires_at, m.name AS module_name
                FROM profile_modules pm
                JOIN modules m ON pm.module_code = m.code
                WHERE pm.profile_id = ?
                  AND pm.expires_at IS NOT NULL
                  AND pm.expires_at <= datetime('now')
                ORDER BY pm.expires_at DESC
            `).bind(profileId).all().catch(() => ({ results: [] })),
        ])

    const buildResourceRetention = (
        allIds: string[],
        allowed: number,
    ): ResourceRetention => {
        const used        = allIds.length
        const activeIds   = allIds.slice(0, allowed)
        const exceededIds = allIds.slice(allowed)
        return {
            used,
            allowed,
            exceeded: exceededIds.length,
            active_ids: activeIds,
            exceeded_ids: exceededIds,
            requires_selection: exceededIds.length > 0,
        }
    }

    const links    = buildResourceRetention((linksRes.results    as any[]).map(r => r.id), entitlements.maxLinks)
    const photos   = buildResourceRetention((photosRes.results   as any[]).map(r => r.id), entitlements.maxPhotos)
    const faqs     = buildResourceRetention((faqsRes.results     as any[]).map(r => r.id), entitlements.maxFaqs)
    const products = buildResourceRetention((productsRes.results as any[]).map(r => r.id), entitlements.maxProducts)
    const videos   = buildResourceRetention((videosRes.results   as any[]).map(r => r.id), entitlements.maxVideos)

    const pausedModules: PausedModule[] = (expiredModulesRes.results as any[]).map(m => ({
        module_code:   m.module_code,
        module_name:   m.module_name,
        expired_at:    m.expires_at,
        paused_reason: 'expired' as const,
    }))

    const requires_selection =
        links.requires_selection || photos.requires_selection ||
        faqs.requires_selection  || products.requires_selection || videos.requires_selection

    const recoverable_items_count =
        links.exceeded + photos.exceeded + faqs.exceeded +
        products.exceeded + videos.exceeded

    // paused_features_count: módulos vencidos + tipos de recurso con excedentes
    const paused_features_count =
        pausedModules.length +
        (links.exceeded    > 0 ? 1 : 0) +
        (photos.exceeded   > 0 ? 1 : 0) +
        (faqs.exceeded     > 0 ? 1 : 0) +
        (products.exceeded > 0 ? 1 : 0) +
        (videos.exceeded   > 0 ? 1 : 0)

    // ── Side-effects de auditoría (fire-and-forget, deduplicados por 24h) ──────
    if (trialExpired && trialEndsAt) {
        logPlanEvent(db, {
            profileId,
            eventType: 'trial_expired',
            triggeredBy: null,
            eventData: { trial_ended_at: trialEndsAt, plan_reverted_to: planCode },
        }).catch(() => { })
    }
    for (const mod of pausedModules) {
        logPlanEvent(db, {
            profileId,
            eventType: 'module_expired',
            triggeredBy: null,
            eventData: { module_code: mod.module_code, expired_at: mod.expired_at },
        }).catch(() => { })
    }

    return {
        plan_code: planCode,
        resources: { links, photos, faqs, products, videos },
        paused_modules: pausedModules,
        requires_selection,
        paused_features_count,
        recoverable_items_count,
        trial_status: trialStatus,
        trial_expires_at: trialEndsAt,
        downgrade_effective_at: null, // V2: billing lifecycle
    }
}

// ─── logPlanEvent ─────────────────────────────────────────────────────────────
// Registra un evento del ciclo de vida del plan en profile_plan_events.
// Fire-and-forget: el caller debe `.catch(() => {})` si no quiere esperar.
//
// Deduplicación:
//   - retention_selection: siempre se registra (es acción explícita del usuario)
//   - trial_expired / override_expired / downgrade: 1 vez por (profile, type) / 24h
//   - module_expired: 1 vez por (profile, type, module_code) / 24h
//
// Silencia errores si la tabla aún no existe (pre-migración 0025).

export async function logPlanEvent(
    db: D1Database,
    params: {
        profileId: string
        eventType: 'trial_expired' | 'module_expired' | 'retention_selection' | 'override_expired' | 'downgrade'
        triggeredBy?: string | null
        eventData?: Record<string, unknown>
    },
): Promise<void> {
    const { profileId, eventType, triggeredBy = null, eventData } = params

    // Los eventos de selección manual siempre se registran sin dedup
    if (eventType !== 'retention_selection') {
        try {
            if (eventType === 'module_expired' && eventData?.module_code) {
                // Dedup per (profile, type, module_code) para evitar spam en cada GET
                const existing = await db.prepare(`
                    SELECT id FROM profile_plan_events
                    WHERE profile_id = ?
                      AND event_type = ?
                      AND json_extract(event_data, '$.module_code') = ?
                      AND created_at > datetime('now', '-24 hours')
                    LIMIT 1
                `).bind(profileId, eventType, String(eventData.module_code)).first()
                if (existing) return
            } else {
                // Dedup per (profile, type) para otros eventos sistémicos
                const existing = await db.prepare(`
                    SELECT id FROM profile_plan_events
                    WHERE profile_id = ?
                      AND event_type = ?
                      AND created_at > datetime('now', '-24 hours')
                    LIMIT 1
                `).bind(profileId, eventType).first()
                if (existing) return
            }
        } catch {
            // Si la tabla no existe todavía, skip dedup (la inserción también fallará y se silencia)
        }
    }

    await db.prepare(`
        INSERT INTO profile_plan_events (profile_id, event_type, triggered_by, event_data, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(
        profileId,
        eventType,
        triggeredBy ?? null,
        eventData ? JSON.stringify(eventData) : null,
    ).run().catch((e: any) => {
        // La tabla puede no existir antes de que corra la migración 0025 — silencio seguro
        console.warn('[plan_events] insert failed (pre-migration 0025?):', String(e))
    })
}
