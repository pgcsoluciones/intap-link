import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPatch, apiPost } from '../../lib/api'
import SuperAdminLayout, { type SuperAdminSection } from './SuperAdminLayout'

interface MetricsOverview {
  ok: boolean
  data?: Record<string, any>
  metrics?: Record<string, any>
  error?: string
}

interface Subscriber {
  user_id?: string
  id?: string
  email?: string
  slug?: string
  plan_id?: string
  is_active?: number | boolean
  is_published?: number | boolean
  created_at?: string | null
  profile_id?: string
}

interface BillingOverview {
  payments?: {
    total?: number
    pending?: number
    under_review?: number
    confirmed?: number
    confirmed_amount_cents?: number
  }
  subscriptions?: {
    active?: number
    past_due?: number
    suspended?: number
  }
  gateways?: {
    enabled?: number
  }
}

interface BillingGateway {
  id: string
  provider: string
  status: string
  display_name: string
  currency: string
  notes?: string | null
}

interface BillingPayment {
  id: string
  user_email?: string | null
  profile_slug?: string | null
  plan_id?: string | null
  amount_cents?: number
  currency?: string
  status?: string
  source?: string
  created_at?: string
}

interface BillingSubscription {
  id: string
  user_email?: string | null
  profile_slug?: string | null
  plan_id?: string
  status?: string
  source?: string
  current_period_end?: string | null
  created_at?: string
}

interface PaymentLinkItem {
  id: string
  profile_slug?: string | null
  user_email?: string | null
  plan_id?: string | null
  amount_cents: number
  currency: string
  status: string
  source?: string
  provider?: string
  admin_reference?: string | null
  concept?: string | null
  public_token?: string | null
  public_url_path?: string | null
  proof_url?: string | null
  proof_asset_id?: string | null
  expires_at?: string | null
  created_at?: string
}

interface PaymentLinkDetail {
  profile?: {
    id?: string | null
    slug?: string | null
    display_name?: string | null
  }
  customer?: {
    name?: string
    email?: string
    phone?: string
    notes?: string
  }
  proof?: {
    proof_url?: string | null
    proof_asset_id?: string | null
    source_bank_name?: string | null
    customer_reference_text?: string | null
    transferred_at?: string | null
    customer_notes?: string | null
  }
  timeline?: Array<Record<string, any>>
  tracking_events?: Array<Record<string, any>>
  voucher_admin_url?: string | null
  public_url_path?: string | null
  public_token?: string | null
  reference_code?: string | null
  concept?: string | null
  notes?: string | null
  expires_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

interface PaymentLinkForm {
  profile_id: string
  concept: string
  amount: string
  currency: string
  expires_at: string
  payment_method_code: string
  notes: string
}

export default function SuperAdminDashboard() {
  const [currentSection, setCurrentSection] = useState<SuperAdminSection>('dashboard')
  const [metrics, setMetrics] = useState<MetricsOverview | null>(null)
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null)
  const [gateways, setGateways] = useState<BillingGateway[]>([])
  const [payments, setPayments] = useState<BillingPayment[]>([])
  const [subscriptions, setSubscriptions] = useState<BillingSubscription[]>([])
  const [paymentLinks, setPaymentLinks] = useState<PaymentLinkItem[]>([])
  const [paymentLinksLoading, setPaymentLinksLoading] = useState(false)
  const [paymentLinksSaving, setPaymentLinksSaving] = useState(false)
  const [paymentLinksMessage, setPaymentLinksMessage] = useState('')
  const [paymentLinksError, setPaymentLinksError] = useState('')
  const [selectedPaymentLink, setSelectedPaymentLink] = useState<PaymentLinkItem | null>(null)
  const [selectedPaymentLinkDetail, setSelectedPaymentLinkDetail] = useState<PaymentLinkDetail | null>(null)
  const [paymentLinkDetailLoading, setPaymentLinkDetailLoading] = useState(false)
  const [paymentLinkDetailError, setPaymentLinkDetailError] = useState('')
  const [copiedPaymentLinkId, setCopiedPaymentLinkId] = useState('')
  const [reviewingPaymentLinkId, setReviewingPaymentLinkId] = useState('')
  const [paymentLinkForm, setPaymentLinkForm] = useState<PaymentLinkForm>({
    profile_id: 'profile_debug',
    concept: '',
    amount: '',
    currency: 'DOP',
    expires_at: '',
    payment_method_code: 'bank_transfer',
    notes: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const [metricsJson, subscribersJson, billingJson, gatewaysJson, paymentsJson, subscriptionsJson]: any[] = await Promise.all([
          apiGet('/superadmin/metrics/overview'),
          apiGet('/superadmin/subscribers?limit=25'),
          apiGet('/superadmin/billing/overview'),
          apiGet('/superadmin/billing/gateways'),
          apiGet('/superadmin/billing/payments?limit=10'),
          apiGet('/superadmin/billing/subscriptions?limit=10'),
        ])

        if (cancelled) return

        if (!metricsJson?.ok) {
          setError(metricsJson?.error || 'No se pudieron cargar las métricas.')
        } else {
          setMetrics(metricsJson)
        }

        if (subscribersJson?.ok) {
          const list = subscribersJson.data?.subscribers || subscribersJson.data || subscribersJson.subscribers || []
          setSubscribers(Array.isArray(list) ? list : [])
        }

        if (billingJson?.ok) setBillingOverview(billingJson.data || null)
        if (gatewaysJson?.ok) setGateways(Array.isArray(gatewaysJson.data?.gateways) ? gatewaysJson.data.gateways : [])
        if (paymentsJson?.ok) setPayments(Array.isArray(paymentsJson.data?.payments) ? paymentsJson.data.payments : [])
        if (subscriptionsJson?.ok) setSubscriptions(Array.isArray(subscriptionsJson.data?.subscriptions) ? subscriptionsJson.data.subscriptions : [])
      } catch (err) {
        if (!cancelled) setError('No se pudo conectar con Super Admin.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  async function loadPaymentLinks() {
    setPaymentLinksLoading(true)
    setPaymentLinksError('')

    try {
      const json: any = await apiGet('/superadmin/payment-links?limit=25')
      if (!json?.ok) {
        throw new Error(json?.error || 'No se pudieron cargar los enlaces de pago.')
      }

      const items = json.data?.items || []
      setPaymentLinks(Array.isArray(items) ? items : [])
    } catch (err) {
      setPaymentLinksError(err instanceof Error ? err.message : 'No se pudieron cargar los enlaces de pago.')
    } finally {
      setPaymentLinksLoading(false)
    }
  }

  async function createPaymentLink() {
    setPaymentLinksSaving(true)
    setPaymentLinksError('')
    setPaymentLinksMessage('')

    try {
      const amount = Number(paymentLinkForm.amount)

      if (!paymentLinkForm.concept.trim()) {
        throw new Error('Debes escribir el concepto del cobro.')
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Debes indicar un monto válido.')
      }

      const json: any = await apiPost('/superadmin/payment-links', {
        profile_id: paymentLinkForm.profile_id || null,
        concept: paymentLinkForm.concept.trim(),
        amount,
        currency: paymentLinkForm.currency,
        expires_at: paymentLinkForm.expires_at || null,
        payment_method_code: paymentLinkForm.payment_method_code,
        notes: paymentLinkForm.notes || null,
      })

      if (!json?.ok) {
        throw new Error(json?.error || 'No se pudo generar el enlace de pago.')
      }

      setPaymentLinksMessage(`Enlace generado: ${json.data?.reference_code || 'sin referencia'}`)
      setPaymentLinkForm((prev) => ({
        ...prev,
        concept: '',
        amount: '',
        expires_at: '',
        notes: '',
      }))
      await loadPaymentLinks()
    } catch (err) {
      setPaymentLinksError(err instanceof Error ? err.message : 'No se pudo generar el enlace de pago.')
    } finally {
      setPaymentLinksSaving(false)
    }
  }

  function buildPublicPaymentLink(path?: string | null) {
    if (!path) return ''
    if (path.startsWith('http://') || path.startsWith('https://')) return path
    return `https://intaprd.com${path.startsWith('/') ? path : `/${path}`}`
  }

  async function copyPaymentLink(item: PaymentLinkItem) {
    const url = buildPublicPaymentLink(item.public_url_path)
    if (!url) {
      setPaymentLinksError('Este enlace no tiene ruta pública disponible.')
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopiedPaymentLinkId(item.id)
      setPaymentLinksMessage('Enlace público copiado.')
      window.setTimeout(() => setCopiedPaymentLinkId(''), 1800)
    } catch {
      setPaymentLinksError('No se pudo copiar el enlace. Copia la ruta manualmente.')
    }
  }

  async function copyPaymentReference(item: PaymentLinkItem) {
    const reference = item.admin_reference || item.public_token || item.id
    if (!reference) {
      setPaymentLinksError('Este cobro no tiene referencia disponible.')
      return
    }

    try {
      await navigator.clipboard.writeText(reference)
      setPaymentLinksMessage('Referencia copiada.')
    } catch {
      setPaymentLinksError('No se pudo copiar la referencia.')
    }
  }

  function sendPaymentLinkByWhatsApp(item: PaymentLinkItem) {
    const url = buildPublicPaymentLink(item.public_url_path)
    const reference = item.admin_reference || 'sin referencia'
    const concept = item.concept || 'enlace de pago'
    const amount = formatMoney(item.amount_cents, item.currency || 'DOP')

    const message = [
      `Hola, te comparto tu enlace de pago de INTAP LINK.`,
      ``,
      `Concepto: ${concept}`,
      `Monto: ${amount}`,
      `Referencia: ${reference}`,
      ``,
      `Puedes abrirlo aquí: ${url || item.public_url_path || ''}`,
    ].join('\n')

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  async function openPaymentLinkDetail(item: PaymentLinkItem) {
    setSelectedPaymentLink(item)
    setSelectedPaymentLinkDetail(null)
    setPaymentLinkDetailError('')
    setPaymentLinkDetailLoading(true)

    try {
      const json: any = await apiGet(`/superadmin/payment-links/${item.id}/detail`)
      if (!json?.ok) {
        throw new Error(json?.error || 'No se pudo cargar el detalle del enlace.')
      }

      setSelectedPaymentLinkDetail(json.data?.detail || json.detail || null)
    } catch (err) {
      setPaymentLinkDetailError(err instanceof Error ? err.message : 'No se pudo cargar el detalle del enlace.')
    } finally {
      setPaymentLinkDetailLoading(false)
    }
  }

  function closePaymentLinkDetail() {
    setSelectedPaymentLink(null)
    setSelectedPaymentLinkDetail(null)
    setPaymentLinkDetailError('')
    setPaymentLinkDetailLoading(false)
  }

  function hasPaymentVoucher(item: PaymentLinkItem) {
    return Boolean(item.proof_asset_id || item.proof_url)
  }

  function openPaymentVoucher(item: PaymentLinkItem) {
    if (!hasPaymentVoucher(item)) {
      setPaymentLinksError('Este enlace todavía no tiene comprobante adjunto.')
      return
    }

    window.open(`/api/v1/superadmin/payment-links/${item.id}/voucher`, '_blank', 'noopener,noreferrer')
  }

  async function reviewPaymentLink(item: PaymentLinkItem, status: 'pending' | 'under_review' | 'confirmed' | 'rejected' | 'cancelled') {
    setPaymentLinksError('')
    setPaymentLinksMessage('')

    let rejectionReason = ''
    if (status === 'rejected') {
      rejectionReason = window.prompt('Escribe el motivo del rechazo:')?.trim() || ''
      if (!rejectionReason) {
        setPaymentLinksError('Debes indicar un motivo para rechazar el pago.')
        return
      }
    }

    const labels: Record<typeof status, string> = {
      pending: 'reactivado',
      under_review: 'en validación',
      confirmed: 'confirmado',
      rejected: 'rechazado',
      cancelled: 'cancelado',
    }

    setReviewingPaymentLinkId(item.id)

    try {
      const json: any = await apiPatch(`/superadmin/billing/payments/${item.id}/review`, {
        status,
        rejection_reason: status === 'rejected' ? rejectionReason : null,
        internal_notes: status === 'under_review'
          ? 'Pago marcado en validación desde Enlaces de pago.'
          : `Pago ${labels[status]} desde Enlaces de pago.`,
      })

      if (!json?.ok) {
        throw new Error(json?.error || 'No se pudo actualizar el estado del pago.')
      }

      setPaymentLinksMessage(`Pago ${labels[status]} correctamente.`)
      await loadPaymentLinks()

      if (selectedPaymentLink?.id === item.id) {
        const detailJson: any = await apiGet(`/superadmin/payment-links/${item.id}/detail`)
        if (detailJson?.ok) {
          setSelectedPaymentLinkDetail(detailJson.data?.detail || detailJson.detail || null)
        }
      }
    } catch (err) {
      setPaymentLinksError(err instanceof Error ? err.message : 'No se pudo actualizar el estado del pago.')
    } finally {
      setReviewingPaymentLinkId('')
    }
  }

  function canMovePaymentToValidation(status: string) {
    return status === 'proof_submitted'
  }

  function canConfirmPayment(status: string) {
    return status === 'under_review'
  }

  function canRejectPayment(status: string) {
    return status === 'proof_submitted' || status === 'under_review'
  }

  function canCancelPayment(status: string) {
    return status === 'pending' || status === 'proof_submitted' || status === 'under_review'
  }

  function canReactivatePayment(status: string) {
    return status === 'cancelled' || status === 'rejected'
  }

  useEffect(() => {
    if (currentSection !== 'paymentLinks') return
    loadPaymentLinks()
  }, [currentSection])

  const paymentLinkStats = {
    total: paymentLinks.length,
    pending: paymentLinks.filter((item) => item.status === 'pending').length,
    paid: paymentLinks.filter((item) => item.status === 'confirmed' || item.status === 'paid').length,
    expired: paymentLinks.filter((item) => item.status === 'expired').length,
  }

  const metricData = metrics?.data || metrics?.metrics || {}

  function formatMoney(cents?: number, currency = 'DOP') {
    const amount = (cents ?? 0) / 100
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount)
  }

  function statusLabel(status?: string) {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      proof_submitted: 'Comprobante enviado',
      under_review: 'En revisión',
      confirmed: 'Confirmado',
      rejected: 'Rechazado',
      refunded: 'Reembolsado',
      cancelled: 'Cancelado',
      expired: 'Vencido',
      active: 'Activa',
      past_due: 'Pago vencido',
      suspended: 'Suspendida',
      disabled: 'Deshabilitada',
      test: 'Prueba',
      ready: 'Lista',
    }
    return labels[status || ''] || status || '—'
  }

  function formatMetricLabel(key: string) {
    const labels: Record<string, string> = {
      users: 'Usuarios',
      profiles: 'Perfiles',
      leads: 'Leads',
      plans: 'Planes',
    }
    return labels[key] || key.replace(/_/g, ' ')
  }

  function formatMetricValue(key: string, value: any) {
    if (value == null) return '0'
    if (typeof value !== 'object') return String(value)

    if (key === 'users') {
      return `Total: ${value.total ?? 0} · Nuevos 7 días: ${value.new_7d ?? 0}`
    }

    if (key === 'profiles') {
      return `Total: ${value.total ?? 0} · Activos: ${value.active ?? 0} · Inactivos: ${value.inactive ?? 0}`
    }

    if (key === 'leads') {
      return `Total: ${value.total ?? 0} · Nuevos 7 días: ${value.new_7d ?? 0}`
    }

    if (key === 'plans' && Array.isArray(value.by_plan)) {
      return value.by_plan.map((p: any) => `${p.plan_id || 'sin plan'}: ${p.cnt ?? 0}`).join(' · ')
    }

    return Object.entries(value)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(' · ')
  }

  function renderBillingSection() {
    return (
      <div className="rounded-3xl bg-white px-4 py-8 text-slate-900 shadow-sm">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">
              INTAP LINK
            </p>
            <h1 className="mt-2 text-3xl font-black">Billing / Pagos</h1>
            <p className="mt-2 text-sm text-slate-600">
              Control de pagos manuales, revisión, suscripciones billing, pasarelas y trazabilidad financiera.
            </p>
          </header>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Pagos pendientes</p>
            <p className="mt-3 text-2xl font-black">{billingOverview?.payments?.pending ?? 0}</p>
          </div>

          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-wide text-yellow-700">En revisión</p>
            <p className="mt-3 text-2xl font-black">{billingOverview?.payments?.under_review ?? 0}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Pagos confirmados</p>
            <p className="mt-3 text-2xl font-black">{billingOverview?.payments?.confirmed ?? 0}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Ingresos confirmados</p>
            <p className="mt-3 text-2xl font-black">{formatMoney(billingOverview?.payments?.confirmed_amount_cents, 'DOP')}</p>
          </div>
        </section>

        <section className="mb-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-black">Pasarelas</h2>
            <p className="mb-5 mt-1 text-sm text-slate-500">Configuradas para uso futuro. Todas pueden permanecer deshabilitadas hasta activar cobros.</p>

            <div className="space-y-3">
              {gateways.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div>
                <p className="font-bold">{g.display_name}</p>
                <p className="text-xs text-slate-500">{g.provider} · {g.currency}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                {statusLabel(g.status)}
                  </span>
                </div>
              ))}

              {gateways.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">No hay pasarelas configuradas.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-black">Suscripciones billing</h2>
            <p className="mb-5 mt-1 text-sm text-slate-500">Últimas 10 suscripciones registradas.</p>

            <div className="space-y-3">
              {subscriptions.map((s) => (
                <div key={s.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                <p className="font-bold">{s.profile_slug || s.user_email || 'Sin perfil'}</p>
                <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                  {statusLabel(s.status)}
                </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                Plan: {s.plan_id || '—'} · Fuente: {s.source || '—'}
                  </p>
                </div>
              ))}

              {subscriptions.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">Todavía no hay suscripciones billing registradas.</p>
              )}
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-black">Pagos recientes</h2>
          <p className="mb-5 mt-1 text-sm text-slate-500">Últimos 10 pagos registrados. El registro manual se conectará en el siguiente lote.</p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-3">Cliente</th>
                  <th className="border-b border-slate-200 px-3 py-3">Perfil</th>
                  <th className="border-b border-slate-200 px-3 py-3">Plan</th>
                  <th className="border-b border-slate-200 px-3 py-3">Monto</th>
                  <th className="border-b border-slate-200 px-3 py-3">Estado</th>
                  <th className="border-b border-slate-200 px-3 py-3">Origen</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="text-slate-700">
                <td className="border-b border-slate-100 px-3 py-3">{p.user_email || '—'}</td>
                <td className="border-b border-slate-100 px-3 py-3">{p.profile_slug || '—'}</td>
                <td className="border-b border-slate-100 px-3 py-3">{p.plan_id || '—'}</td>
                <td className="border-b border-slate-100 px-3 py-3">{formatMoney(p.amount_cents, p.currency || 'DOP')}</td>
                <td className="border-b border-slate-100 px-3 py-3">{statusLabel(p.status)}</td>
                <td className="border-b border-slate-100 px-3 py-3">{p.source || '—'}</td>
                  </tr>
                ))}

                {payments.length === 0 && (
                  <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  Todavía no hay pagos registrados.
                </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        </div>
      </div>
    )
  }

  function renderPaymentLinksSection() {
    return (
      <div className="rounded-3xl bg-white px-4 py-8 text-slate-900 shadow-sm">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">
              INTAP LINK
            </p>
            <h1 className="mt-2 text-3xl font-black">Enlaces de pago</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Crea cobros compartibles, registra el concepto del pago y da seguimiento desde Billing.
            </p>
          </header>

          <section className="mb-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Total enlaces</p>
              <p className="mt-3 text-2xl font-black text-slate-900">{paymentLinkStats.total}</p>
              <p className="mt-1 text-xs text-slate-500">Creados en backend</p>
            </div>

            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-wide text-yellow-700">Pendientes</p>
              <p className="mt-3 text-2xl font-black text-slate-900">{paymentLinkStats.pending}</p>
              <p className="mt-1 text-xs text-slate-500">Cobros sin confirmar</p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Pagados</p>
              <p className="mt-3 text-2xl font-black text-slate-900">{paymentLinkStats.paid}</p>
              <p className="mt-1 text-xs text-slate-500">Pagos confirmados</p>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-wide text-red-700">Vencidos</p>
              <p className="mt-3 text-2xl font-black text-slate-900">{paymentLinkStats.expired}</p>
              <p className="mt-1 text-xs text-slate-500">Enlaces expirados</p>
            </div>
          </section>

          {(paymentLinksMessage || paymentLinksError) && (
            <div className={`mb-6 rounded-2xl border p-4 text-sm font-bold ${
              paymentLinksError
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}>
              {paymentLinksError || paymentLinksMessage}
            </div>
          )}

          <section className="mb-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="mb-5">
                <h2 className="text-xl font-black text-slate-900">Crear enlace de pago</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Esta versión crea un registro real en billing_payments con source=payment_link.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Perfil</span>
                  <input
                    value={paymentLinkForm.profile_id}
                    onChange={(event) => setPaymentLinkForm((prev) => ({ ...prev, profile_id: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                    placeholder="profile_debug"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Tipo de cobro</span>
                  <select
                    value={paymentLinkForm.payment_method_code}
                    onChange={(event) => setPaymentLinkForm((prev) => ({ ...prev, payment_method_code: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  >
                    <option value="bank_transfer">Transferencia bancaria</option>
                    <option value="manual">Pago manual</option>
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Concepto</span>
                  <input
                    value={paymentLinkForm.concept}
                    onChange={(event) => setPaymentLinkForm((prev) => ({ ...prev, concept: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                    placeholder="Ej: Activación plan Basic mensual"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Monto</span>
                  <input
                    value={paymentLinkForm.amount}
                    onChange={(event) => setPaymentLinkForm((prev) => ({ ...prev, amount: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                    placeholder="1800"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Moneda</span>
                  <select
                    value={paymentLinkForm.currency}
                    onChange={(event) => setPaymentLinkForm((prev) => ({ ...prev, currency: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  >
                    <option value="DOP">DOP</option>
                    <option value="USD">USD</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Vence el</span>
                  <input
                    value={paymentLinkForm.expires_at}
                    onChange={(event) => setPaymentLinkForm((prev) => ({ ...prev, expires_at: event.target.value }))}
                    type="date"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Notas internas</span>
                  <input
                    value={paymentLinkForm.notes}
                    onChange={(event) => setPaymentLinkForm((prev) => ({ ...prev, notes: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                    placeholder="Opcional"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={createPaymentLink}
                disabled={paymentLinksSaving}
                className="mt-6 rounded-full bg-slate-900 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {paymentLinksSaving ? 'Generando...' : 'Generar enlace de pago'}
              </button>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="mb-5">
                <h2 className="text-xl font-black text-slate-900">Configuración de cobro</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Próximo bloque: bancos, soporte, comprobantes y página pública /pay/token.
                </p>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-900">Pendiente de conexión</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  La creación y listado ya usan backend real. Falta la página pública del enlace y configuración bancaria.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">Enlaces recientes</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Registros reales desde GET /superadmin/payment-links.
                </p>
              </div>
              <button
                type="button"
                onClick={loadPaymentLinks}
                disabled={paymentLinksLoading}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black text-slate-700 disabled:opacity-60"
              >
                {paymentLinksLoading ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>

            <div className="space-y-3">
              {paymentLinks.map((item) => (
                <article
                  key={item.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-black text-slate-900">
                          {item.concept || 'Enlace de pago'}
                        </h3>
                        <p className="text-sm text-slate-500">
                          Ref: <span className="font-bold text-slate-700">{item.admin_reference || '—'}</span>
                          {' '}· Estado: <span className="font-bold text-slate-700">{statusLabel(item.status)}</span>
                          {' '}· Total: <span className="font-bold text-slate-700">{formatMoney(item.amount_cents, item.currency || 'DOP')}</span>
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {hasPaymentVoucher(item) ? (
                          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">
                            Voucher recibido
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                            Sin comprobante
                          </span>
                        )}

                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                          Cliente: {item.profile_slug || item.user_email || '—'}
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                          {statusLabel(item.status)}
                        </span>
                      </div>

                      <p className="mt-3 break-all font-mono text-xs text-slate-500">
                        {item.public_url_path || 'Sin ruta pública'}
                      </p>
                    </div>

                    <div className="text-sm text-slate-500 lg:text-right">
                      <p>
                        Vence: <span className="font-bold text-slate-700">{item.expires_at || '—'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openPaymentLinkDetail(item)}
                      className="rounded-xl border border-violet-300 bg-white px-4 py-3 text-sm font-black text-violet-700 hover:bg-violet-50"
                    >
                      Ver detalle
                    </button>

                    <button
                      type="button"
                      onClick={() => copyPaymentLink(item)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                    >
                      {copiedPaymentLinkId === item.id ? 'Copiado' : 'Copiar enlace'}
                    </button>

                    <button
                      type="button"
                      onClick={() => copyPaymentReference(item)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                    >
                      Copiar referencia
                    </button>

                    <button
                      type="button"
                      onClick={() => sendPaymentLinkByWhatsApp(item)}
                      className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-100"
                    >
                      Enviar por WhatsApp
                    </button>

                    {hasPaymentVoucher(item) && (
                      <button
                        type="button"
                        onClick={() => openPaymentVoucher(item)}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-100"
                      >
                        Ver comprobante
                      </button>
                    )}

                    {canMovePaymentToValidation(item.status) && (
                      <button
                        type="button"
                        onClick={() => reviewPaymentLink(item, 'under_review')}
                        disabled={reviewingPaymentLinkId === item.id}
                        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                      >
                        Pago en validación
                      </button>
                    )}

                    {canConfirmPayment(item.status) && (
                      <button
                        type="button"
                        onClick={() => reviewPaymentLink(item, 'confirmed')}
                        disabled={reviewingPaymentLinkId === item.id}
                        className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-black text-green-700 hover:bg-green-100 disabled:opacity-60"
                      >
                        Confirmar
                      </button>
                    )}

                    {canRejectPayment(item.status) && (
                      <button
                        type="button"
                        onClick={() => reviewPaymentLink(item, 'rejected')}
                        disabled={reviewingPaymentLinkId === item.id}
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        Rechazar
                      </button>
                    )}

                    {canCancelPayment(item.status) && (
                      <button
                        type="button"
                        onClick={() => reviewPaymentLink(item, 'cancelled')}
                        disabled={reviewingPaymentLinkId === item.id}
                        className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                    )}

                    {canReactivatePayment(item.status) && (
                      <button
                        type="button"
                        onClick={() => reviewPaymentLink(item, 'pending')}
                        disabled={reviewingPaymentLinkId === item.id}
                        className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                      >
                        Activar
                      </button>
                    )}

                    <button
                      type="button"
                      disabled
                      className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-black text-slate-400"
                      title="Disponible en el próximo bloque"
                    >
                      Archivar
                    </button>
                  </div>
                </article>
              ))}

              {paymentLinks.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-slate-500">
                  No hay enlaces de pago todavía.
                </div>
              )}
            </div>
          </section>

          {selectedPaymentLink && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
              <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">Detalle del enlace</p>
                    <h2 className="mt-2 text-2xl font-black text-slate-900">
                      {selectedPaymentLink.concept || selectedPaymentLink.admin_reference || 'Enlace de pago'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedPaymentLink.admin_reference || 'Sin referencia'} · {statusLabel(selectedPaymentLink.status)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closePaymentLinkDetail}
                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700"
                  >
                    Cerrar
                  </button>
                </div>

                {paymentLinkDetailLoading && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                    Cargando detalle...
                  </div>
                )}

                {paymentLinkDetailError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
                    {paymentLinkDetailError}
                  </div>
                )}

                {selectedPaymentLinkDetail && (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-xs font-black uppercase text-slate-500">Monto</p>
                        <p className="mt-2 text-lg font-black text-slate-900">
                          {formatMoney(selectedPaymentLink.amount_cents, selectedPaymentLink.currency)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-xs font-black uppercase text-slate-500">Perfil</p>
                        <p className="mt-2 text-sm font-bold text-slate-800">
                          {selectedPaymentLinkDetail.profile?.slug || selectedPaymentLink.profile_slug || '—'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-xs font-black uppercase text-slate-500">Vence</p>
                        <p className="mt-2 text-sm font-bold text-slate-800">
                          {selectedPaymentLinkDetail.expires_at || selectedPaymentLink.expires_at || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-5">
                      <h3 className="text-sm font-black text-slate-900">Cliente / comprobante</h3>
                      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                        <p><strong>Nombre:</strong> {selectedPaymentLinkDetail.customer?.name || '—'}</p>
                        <p><strong>Teléfono:</strong> {selectedPaymentLinkDetail.customer?.phone || '—'}</p>
                        <p><strong>Banco:</strong> {selectedPaymentLinkDetail.proof?.source_bank_name || '—'}</p>
                        <p><strong>Referencia cliente:</strong> {selectedPaymentLinkDetail.proof?.customer_reference_text || '—'}</p>
                        <p><strong>Fecha transferencia:</strong> {selectedPaymentLinkDetail.proof?.transferred_at || '—'}</p>
                        <p><strong>Archivo R2:</strong> {selectedPaymentLinkDetail.proof?.proof_asset_id ? 'Disponible' : 'No adjunto'}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-5">
                      <h3 className="text-sm font-black text-slate-900">Timeline</h3>
                      <div className="mt-4 space-y-3">
                        {(selectedPaymentLinkDetail.timeline || []).length > 0 ? (
                          (selectedPaymentLinkDetail.timeline || []).map((event, index) => (
                            <div key={`${event.event_type || 'event'}-${index}`} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                              <p className="font-black text-slate-900">{event.public_message || event.event_type || 'Evento'}</p>
                              <p className="mt-1 text-xs text-slate-500">{event.at || 'Sin fecha'}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">Sin eventos registrados.</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => copyPaymentLink(selectedPaymentLink)}
                        className="rounded-full border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700"
                      >
                        Copiar enlace público
                      </button>

                      {selectedPaymentLinkDetail.voucher_admin_url && (
                        <button
                          type="button"
                          onClick={() => openPaymentVoucher(selectedPaymentLink)}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700"
                        >
                          Abrir comprobante
                        </button>
                      )}

                      {canMovePaymentToValidation(selectedPaymentLink.status) && (
                        <button
                          type="button"
                          onClick={() => reviewPaymentLink(selectedPaymentLink, 'under_review')}
                          disabled={reviewingPaymentLinkId === selectedPaymentLink.id}
                          className="rounded-full border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 disabled:opacity-60"
                        >
                          Marcar en validación
                        </button>
                      )}

                      {canConfirmPayment(selectedPaymentLink.status) && (
                        <button
                          type="button"
                          onClick={() => reviewPaymentLink(selectedPaymentLink, 'confirmed')}
                          disabled={reviewingPaymentLinkId === selectedPaymentLink.id}
                          className="rounded-full border border-green-200 bg-green-50 px-4 py-3 text-sm font-black text-green-700 disabled:opacity-60"
                        >
                          Confirmar pago
                        </button>
                      )}

                      {canRejectPayment(selectedPaymentLink.status) && (
                        <button
                          type="button"
                          onClick={() => reviewPaymentLink(selectedPaymentLink, 'rejected')}
                          disabled={reviewingPaymentLinkId === selectedPaymentLink.id}
                          className="rounded-full border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 disabled:opacity-60"
                        >
                          Rechazar
                        </button>
                      )}

                      {canCancelPayment(selectedPaymentLink.status) && (
                        <button
                          type="button"
                          onClick={() => reviewPaymentLink(selectedPaymentLink, 'cancelled')}
                          disabled={reviewingPaymentLinkId === selectedPaymentLink.id}
                          className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                      )}

                      {canReactivatePayment(selectedPaymentLink.status) && (
                        <button
                          type="button"
                          onClick={() => reviewPaymentLink(selectedPaymentLink, 'pending')}
                          disabled={reviewingPaymentLinkId === selectedPaymentLink.id}
                          className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700 disabled:opacity-60"
                        >
                          Activar / Reactivar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderSectionPlaceholder() {
    const titles: Record<SuperAdminSection, { title: string; description: string }> = {
      dashboard: {
        title: 'Dashboard',
        description: 'Resumen ejecutivo del SaaS.',
      },
      subscribers: {
        title: 'Suscriptores',
        description: 'Gestión de usuarios, perfiles, planes y estado comercial.',
      },
      billing: {
        title: 'Billing / Pagos',
        description: 'Pagos manuales, revisión, confirmación, suscripciones y trazabilidad.',
      },
      paymentLinks: {
        title: 'Enlaces de pago',
        description: 'Creación y seguimiento de enlaces de pago para planes, servicios o activaciones.',
      },
      landing: {
        title: 'Landing marketing',
        description: 'Administración de la landing pública de INTAP LINK: hero, beneficios, planes, CTA y contenido comercial.',
      },
      plans: {
        title: 'Planes y módulos',
        description: 'Control de planes, límites, módulos, trials, overrides y funciones premium.',
      },
      gateways: {
        title: 'Pasarelas',
        description: 'Configuración y estado de PayPal, Azul, CardNet, Stripe e INTAP Payment Link.',
      },
      audit: {
        title: 'Auditoría',
        description: 'Historial de acciones administrativas y cambios sensibles del sistema.',
      },
      admins: {
        title: 'Admins / Roles',
        description: 'Gestión de usuarios administrativos, permisos y roles internos.',
      },
      settings: {
        title: 'Configuración',
        description: 'Ajustes generales del SaaS y parámetros operativos.',
      },
    }

    const current = titles[currentSection]

    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-900 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">
          INTAP LINK
        </p>
        <h1 className="mt-3 text-3xl font-black">{current.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          {current.description}
        </p>

        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          Este módulo ya quedó separado visualmente dentro del Super Admin. En el próximo lote se conecta su contenido funcional real sin cargar todo en una sola pantalla.
        </div>
      </div>
    )
  }

  return (
    <SuperAdminLayout
      currentSection={currentSection}
      onNavigate={setCurrentSection}
      onLogout={() => {
        window.location.href = '/admin/login'
      }}
    >
      {currentSection === 'dashboard' ? (
        <div className="rounded-3xl bg-white px-4 py-8 text-slate-900 shadow-sm">
          <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">
              INTAP LINK
            </p>
            <h1 className="mt-2 text-3xl font-black">Super Admin</h1>
            <p className="mt-2 text-sm text-slate-600">
              Vista inicial de métricas y suscriptores. Las acciones de cambio de plan, módulos y overrides se conectarán en el siguiente lote.
            </p>
          </div>

          <Link
            to="/admin"
            className="rounded-full border border-slate-200 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-700 hover:bg-white/10"
          >
            Volver al panel
          </Link>
        </header>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
            Cargando Super Admin...
          </div>
        )}

        {!loading && error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && (
          <>
            <section className="mb-8 grid gap-4 md:grid-cols-4">
              {Object.entries(metricData).slice(0, 8).map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {formatMetricLabel(key)}
                  </p>
                  <p className="mt-3 text-base font-bold leading-relaxed text-slate-900">
                    {formatMetricValue(key, value)}
                  </p>
                </div>
              ))}

              {Object.keys(metricData).length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 md:col-span-4">
                  <p className="text-sm text-slate-600">No se recibieron métricas para mostrar.</p>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">Suscriptores</h2>
                  <p className="text-sm text-slate-500">Primeros 25 registros.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="border-b border-slate-200 px-3 py-3">Email</th>
                      <th className="border-b border-slate-200 px-3 py-3">Slug</th>
                      <th className="border-b border-slate-200 px-3 py-3">Plan</th>
                      <th className="border-b border-slate-200 px-3 py-3">Activo</th>
                      <th className="border-b border-slate-200 px-3 py-3">Publicado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((s, index) => (
                      <tr key={s.user_id || s.id || s.profile_id || index} className="text-slate-700">
                        <td className="border-b border-slate-100 px-3 py-3">{s.email || '—'}</td>
                        <td className="border-b border-slate-100 px-3 py-3">{s.slug || '—'}</td>
                        <td className="border-b border-slate-100 px-3 py-3">{s.plan_id || '—'}</td>
                        <td className="border-b border-slate-100 px-3 py-3">{s.is_active ? 'Sí' : 'No'}</td>
                        <td className="border-b border-slate-100 px-3 py-3">{s.is_published ? 'Sí' : 'No'}</td>
                      </tr>
                    ))}

                    {subscribers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                          No hay suscriptores para mostrar o tu usuario no tiene permiso Super Admin.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
          </div>
        </div>
      ) : currentSection === 'billing' ? (
        renderBillingSection()
      ) : currentSection === 'paymentLinks' ? (
        renderPaymentLinksSection()
      ) : (
        renderSectionPlaceholder()
      )}
    </SuperAdminLayout>
  )
}
