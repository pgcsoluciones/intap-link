export type PromotionAccess = {
  allowed: boolean
  source: 'promotion' | null
  promotion?: {
    id: string
    name: string
    access_mode: 'all' | 'code' | 'profile'
    starts_at: string
    ends_at: string | null
  }
}

export async function resolveFeaturePromotionAccess(
  c: any,
  profileId: string,
  planId: string,
  featureCode: string,
): Promise<PromotionAccess> {
  try {
    const rows = await c.env.DB.prepare(
      `SELECT fp.id, fp.name, fp.access_mode, fp.profile_id, fp.starts_at, fp.ends_at,
              CASE WHEN fpr.profile_id IS NOT NULL THEN 1 ELSE 0 END AS redeemed
         FROM feature_promotions fp
         LEFT JOIN feature_promotion_redemptions fpr
           ON fpr.promotion_id = fp.id AND fpr.profile_id = ?
        WHERE fp.feature_code = ?
          AND fp.target_plan = ?
          AND fp.is_enabled = 1
          AND fp.starts_at <= datetime('now')
          AND (fp.ends_at IS NULL OR fp.ends_at > datetime('now'))
        ORDER BY fp.created_at DESC`,
    ).bind(profileId, featureCode, planId).all()

    for (const row of rows.results as any[]) {
      const mode = String(row.access_mode || '')
      const allowed = mode === 'all'
        || (mode === 'profile' && String(row.profile_id || '') === profileId)
        || (mode === 'code' && Number(row.redeemed || 0) === 1)
      if (!allowed) continue
      return {
        allowed: true,
        source: 'promotion',
        promotion: {
          id: String(row.id),
          name: String(row.name || ''),
          access_mode: mode as 'all' | 'code' | 'profile',
          starts_at: String(row.starts_at || ''),
          ends_at: row.ends_at ? String(row.ends_at) : null,
        },
      }
    }
  } catch (error) {
    console.warn('[feature-promotions] lookup unavailable:', String(error))
  }
  return { allowed: false, source: null }
}
