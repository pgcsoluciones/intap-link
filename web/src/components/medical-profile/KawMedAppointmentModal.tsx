import { FormEvent, useEffect, useMemo, useState } from 'react'
import { FaWhatsapp } from 'react-icons/fa'
import KawMedModal from './KawMedModal'
import type { KawMedProfileData } from './types'

type Props = {
  open: boolean
  profile: KawMedProfileData
  onClose: () => void
}

function formatTime(value: string): string {
  const [rawHour = '0', rawMinute = '00'] = value.split(':')
  const hour = Number(rawHour)
  const suffix = hour >= 12 ? 'p.m.' : 'a.m.'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${rawMinute} ${suffix}`
}

export default function KawMedAppointmentModal({ open, profile, onClose }: Props) {
  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [centerId, setCenterId] = useState('')
  const [day, setDay] = useState('')
  const [scheduleId, setScheduleId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
  }, [open])

  const schedulesForCenter = useMemo(
    () => profile.schedules.filter((schedule) => schedule.center_id === centerId),
    [profile.schedules, centerId],
  )

  const availableDays = useMemo(() => {
    const seen = new Map<number, string>()
    schedulesForCenter.forEach((schedule) => seen.set(schedule.day_of_week, schedule.day_label))
    return Array.from(seen.entries()).sort((a, b) => a[0] - b[0])
  }, [schedulesForCenter])

  const schedulesForDay = useMemo(
    () => schedulesForCenter.filter((schedule) => String(schedule.day_of_week) === day),
    [schedulesForCenter, day],
  )

  const selectCenter = (value: string) => {
    setCenterId(value)
    setDay('')
    setScheduleId('')
    setError('')
  }

  const selectDay = (value: string) => {
    setDay(value)
    setScheduleId('')
    setError('')
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const center = profile.centers.find((item) => item.id === centerId)
    const schedule = profile.schedules.find((item) => item.id === scheduleId)
    const isValidSchedule = Boolean(
      center &&
      schedule &&
      schedule.center_id === center.id &&
      String(schedule.day_of_week) === day,
    )

    if (!patientName.trim() || !patientPhone.trim() || !center || !day || !isValidSchedule || !schedule) {
      setError('Completa nombre, teléfono, centro, día y horario con una opción disponible.')
      return
    }

    if (!profile.whatsapp) {
      setError('Este perfil no tiene WhatsApp configurado.')
      return
    }

    const lines = [
      `Hola ${profile.display_name}, deseo solicitar una cita.`,
      '',
      `Mi nombre es ${patientName.trim()} y mi teléfono es ${patientPhone.trim()}.`,
      '',
      `Me gustaría solicitar la cita para ${center.name}, el ${schedule.day_label.toLowerCase()}, en su horario de ${formatTime(schedule.start_time)} a ${formatTime(schedule.end_time)}.`,
    ]

    if (note.trim()) {
      lines.push('', 'Nota:', note.trim())
    }

    lines.push('', 'Quedo pendiente de su confirmación. Muchas gracias.')

    const number = profile.whatsapp.replace(/\D/g, '')
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <KawMedModal open={open} title="Solicitar cita" onClose={onClose}>
      <form className="kawmed-form" onSubmit={submit}>
        <p className="kawmed-form__intro">
          Selecciona una disponibilidad configurada. La cita queda sujeta a confirmación del médico o su asistente.
        </p>

        <label>
          <span>Nombre</span>
          <input
            value={patientName}
            onChange={(event) => setPatientName(event.target.value)}
            autoComplete="name"
            maxLength={100}
            required
          />
        </label>

        <label>
          <span>Teléfono / WhatsApp</span>
          <input
            value={patientPhone}
            onChange={(event) => setPatientPhone(event.target.value)}
            autoComplete="tel"
            inputMode="tel"
            maxLength={30}
            required
          />
        </label>

        <label>
          <span>Centro de atención</span>
          <select value={centerId} onChange={(event) => selectCenter(event.target.value)} required>
            <option value="">Selecciona un centro</option>
            {profile.centers.map((center) => (
              <option key={center.id} value={center.id}>{center.name}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Día disponible</span>
          <select value={day} onChange={(event) => selectDay(event.target.value)} disabled={!centerId} required>
            <option value="">Selecciona un día</option>
            {availableDays.map(([dayValue, label]) => (
              <option key={dayValue} value={dayValue}>{label}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Horario disponible</span>
          <select
            value={scheduleId}
            onChange={(event) => {
              setScheduleId(event.target.value)
              setError('')
            }}
            disabled={!day}
            required
          >
            <option value="">Selecciona un horario</option>
            {schedulesForDay.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                {schedule.shift ? ` · ${schedule.shift}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Nota para el médico <small>Opcional</small></span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Puedes agregar una nota breve."
          />
        </label>

        {error ? <p className="kawmed-form__error" role="alert">{error}</p> : null}

        <button className="kawmed-button kawmed-button--whatsapp kawmed-button--full" type="submit">
          <FaWhatsapp />
          Enviar solicitud por WhatsApp
        </button>

        <p className="kawmed-form__privacy">
          No envíes diagnósticos, resultados médicos ni otra información clínica sensible por este formulario.
        </p>
      </form>
    </KawMedModal>
  )
}
