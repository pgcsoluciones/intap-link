import app from './preview-entry'
import { requireSuperAdmin } from './lib/admin-auth'

function parseTemplateData(value: unknown): Record<string, any> {
  try {
    const parsed = JSON.parse(String(value || '{}'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

app.get('/api/v1/superadmin/free-feedback', requireSuperAdmin(), async (c: any) => {
  const [profiles, exits] = await Promise.all([
    c.env.DB.prepare(
      `SELECT p.id, p.slug, p.name, p.category, p.subcategory, p.template_data,
              p.created_at, p.updated_at, u.email
         FROM profiles p
         JOIN users u ON u.id = p.user_id
        WHERE p.plan_id = 'free'
        ORDER BY COALESCE(p.updated_at, p.created_at) DESC
        LIMIT 250`,
    ).all(),
    c.env.DB.prepare(
      `SELECT f.id, f.user_id, f.profile_id, f.profile_slug, f.reason,
              f.improvement_one, f.improvement_two, f.trial_offer_eligible,
              f.created_at, u.email
         FROM profile_exit_feedback f
         LEFT JOIN users u ON u.id = f.user_id
        ORDER BY f.created_at DESC
        LIMIT 250`,
    ).all(),
  ])

  const onboarding = (profiles.results || []).map((row: any) => {
    const template = parseTemplateData(row.template_data)
    return {
      profile_id: row.id,
      slug: row.slug,
      name: row.name,
      email: row.email,
      category: row.category || template.free_starter_category || null,
      subcategory: row.subcategory || template.free_starter_subcategory || null,
      lead_source: template.free_starter_lead_source || null,
      starter_variant: template.free_starter_variant || null,
      starter_generated_at: template.free_starter_generated_at || template.free_starter_materialized_at || null,
      identity_confirmed: Boolean(template.free_identity_confirmed),
      updated_at: row.updated_at || row.created_at || null,
    }
  }).filter((row: any) => row.category || row.subcategory || row.lead_source)

  return c.json({
    ok: true,
    data: {
      onboarding,
      exits: exits.results || [],
      counts: {
        onboarding: onboarding.length,
        exits: (exits.results || []).length,
      },
    },
  })
})

export default app
