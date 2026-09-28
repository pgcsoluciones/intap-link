export type KawMedProfileStatus = 'draft' | 'active' | 'inactive'

export interface KawMedCenter {
  id: string
  name: string
  address: string | null
  city: string | null
  province: string | null
  country: string | null
  phone: string | null
  map_url: string | null
  latitude: number | null
  longitude: number | null
  sort_order: number
}

export interface KawMedSchedule {
  id: string
  center_id: string
  center_name: string | null
  day_of_week: number
  day_label: string
  shift: string | null
  start_time: string
  end_time: string
  notes: string | null
  sort_order: number
}

export interface KawMedService {
  id: string
  title: string
  description: string | null
  category: string | null
  sort_order: number
}

export interface KawMedProfileData {
  id: string
  slug: string
  name: string
  professional_prefix: string | null
  display_name: string
  specialty: string
  subspecialty: string | null
  bio: string | null
  avatar_url: string | null
  cover_url: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  city: string | null
  province: string | null
  country: string | null
  organization: string | null
  status: KawMedProfileStatus
  centers: KawMedCenter[]
  schedules: KawMedSchedule[]
  services: KawMedService[]
}
