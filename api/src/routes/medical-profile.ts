const DAY_LABELS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
}

function cleanSlug(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 80)
}

function profileResponse(profile: any, centers: any[], schedules: any[], services: any[], insuranceExclusions: any[]) {
  const centerById = new Map(centers.map((center) => [String(center.id), center]))

  return {
    id: profile.id,
    slug: profile.slug,
    name: profile.name,
    professional_prefix: profile.professional_prefix || null,
    display_name: [profile.professional_prefix, profile.name].filter(Boolean).join(' '),
    specialty: profile.specialty,
    subspecialty: profile.subspecialty || null,
    bio: profile.bio || null,
    avatar_url: profile.avatar_url || null,
    cover_url: profile.cover_url || null,
    phone: profile.phone || null,
    whatsapp: profile.whatsapp || null,
    email: profile.email || null,
    city: profile.city || null,
    province: profile.province || null,
    country: profile.country || null,
    organization: profile.organization || null,
    status: profile.status,
    centers: centers.map((center) => ({
      id: center.id,
      name: center.name,
      address: center.address || null,
      city: center.city || null,
      province: center.province || null,
      country: center.country || null,
      phone: center.phone || null,
      map_url: center.map_url || null,
      latitude: center.latitude ?? null,
      longitude: center.longitude ?? null,
      sort_order: Number(center.sort_order || 0),
    })),
    schedules: schedules.map((schedule) => ({
      id: schedule.id,
      center_id: schedule.center_id,
      center_name: centerById.get(String(schedule.center_id))?.name || null,
      day_of_week: Number(schedule.day_of_week),
      day_label: DAY_LABELS[Number(schedule.day_of_week)] || '',
      shift: schedule.shift || null,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      notes: schedule.notes || null,
      sort_order: Number(schedule.sort_order || 0),
    })),
    services: services.map((service) => ({
      id: service.id,
      title: service.title,
      description: service.description || null,
      category: service.category || null,
      sort_order: Number(service.sort_order || 0),
    })),
    insurance_policy: {
      accepts_all: true,
      excluded: insuranceExclusions.map((row) => String(row.insurance_name)),
    },
  }
}

export function registerMedicalProfileRoutes(app: any) {
  app.get('/api/v1/public/medical-profiles/:slug', async (c: any) => {
    const slug = cleanSlug(c.req.param('slug'))
    if (!slug) return c.json({ ok: false, error: 'Perfil médico no encontrado.' }, 404)

    try {
      const profile = await c.env.DB.prepare(
        `SELECT id, slug, name, professional_prefix, specialty, subspecialty, bio,
                avatar_url, cover_url, phone, whatsapp, email, city, province, country,
                organization, status
           FROM medical_profiles
          WHERE slug = ? AND status = 'active'
          LIMIT 1`
      ).bind(slug).first()

      if (!profile) {
        return c.json({ ok: false, error: 'Perfil médico no encontrado.' }, 404, {
          'Cache-Control': 'public, max-age=60',
        })
      }

      const [centersResult, schedulesResult, servicesResult, insuranceExclusionsResult] = await Promise.all([
        c.env.DB.prepare(
          `SELECT id, name, address, city, province, country, phone, map_url,
                  latitude, longitude, sort_order
             FROM medical_profile_centers
            WHERE medical_profile_id = ? AND active = 1
            ORDER BY sort_order ASC, name ASC`
        ).bind((profile as any).id).all(),
        c.env.DB.prepare(
          `SELECT id, center_id, day_of_week, shift, start_time, end_time, notes, sort_order
             FROM medical_profile_schedules
            WHERE medical_profile_id = ? AND active = 1
            ORDER BY day_of_week ASC, sort_order ASC, start_time ASC`
        ).bind((profile as any).id).all(),
        c.env.DB.prepare(
          `SELECT id, title, description, category, sort_order
             FROM medical_profile_services
            WHERE medical_profile_id = ? AND active = 1
            ORDER BY sort_order ASC, title ASC`
        ).bind((profile as any).id).all(),
        c.env.DB.prepare(
          `SELECT insurance_name
             FROM medical_profile_insurance_exclusions
            WHERE medical_profile_id = ? AND active = 1
            ORDER BY sort_order ASC, insurance_name ASC`
        ).bind((profile as any).id).all(),
      ])

      return c.json({
        ok: true,
        data: profileResponse(
          profile,
          centersResult.results || [],
          schedulesResult.results || [],
          servicesResult.results || [],
          insuranceExclusionsResult.results || [],
        ),
      }, 200, {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      })
    } catch (error) {
      console.error('[GET /public/medical-profiles/:slug]', error)
      return c.json({ ok: false, error: 'No se pudo cargar el perfil médico.' }, 500)
    }
  })
}
