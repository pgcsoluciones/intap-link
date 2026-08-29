import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'

type HolderIdType = 'cedula' | 'rnc'

type PublicBankAccount = {
  id: string
  bank_code: string | null
  bank_name: string
  account_type: 'savings' | 'checking'
  currency: 'DOP' | 'USD'
  holder_name: string
  holder_id_type: HolderIdType | null
  display_mode: 'masked' | 'visible'
  display_number: string
  copy_value: string
}

const BANK_LOGO_FILES: Record<string, string> = {
  vimenca: 'banco-vimenca.webp',
  promerica: 'banco-promerica.webp',
  popular: 'banco-popular.webp',
  bdi: 'banco-bdi.webp',
  'santa-cruz': 'banco-santa-cruz.webp',
  'bhd-leon': 'banco-bhd-leon.webp',
  ademi: 'banco-ademi.webp',
  banesco: 'banesco.webp',
  scotiabank: 'scotiabank.webp',
  'la-nacional': 'la-nacional.webp',
  banreservas: 'banreservas.webp',
  citi: 'citi.webp',
  caribe: 'banco-caribe.webp',
  'lopez-de-haro': 'banco-lopez-de-haro.webp',
  bellbank: 'bellbank.webp',
  'activo-dominicana': 'banco-activo-dominicana.webp',
  lafise: 'banco-lafise.webp',
  'asociacion-cibao': 'asociacion-cibao.webp',
}

function bankInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'B'
}

function accountTypeLabel(type: PublicBankAccount['account_type']) {
  return type === 'checking' ? 'Cuenta corriente' : 'Cuenta de ahorros'
}

function bankLogoUrl(code: string | null) {
  if (!code) return null
  const file = BANK_LOGO_FILES[code]
  return file ? `/bank-logos/${file}` : null
}

export default function PublicBankAccounts() {
  const { slug = '' } = useParams()
  const [items, setItems] = useState<PublicBankAccount[]>([])
  const [enabled, setEnabled] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1'

  useEffect(() => {
    let createdHost: HTMLElement | null = null

    const attach = () => {
      const shareSection = document.querySelector('.ilx-share')
      const body = shareSection?.parentElement
      if (!shareSection || !body) return false

      let host = document.getElementById('ilx-bank-slot')
      if (!host) {
        host = document.createElement('div')
        host.id = 'ilx-bank-slot'
        body.insertBefore(host, shareSection)
        createdHost = host
      }
      setPortalHost(host)
      return true
    }

    if (attach()) return () => undefined

    const observer = new MutationObserver(() => {
      if (attach()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      setPortalHost(null)
      if (createdHost?.parentElement) createdHost.parentElement.removeChild(createdHost)
    }
  }, [])

  useEffect(() => {
    if (!slug) return
    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
    const endpoint = isPreview
      ? `${apiUrl}/api/v1/public/profiles/${encodeURIComponent(slug)}/preview-bank-accounts?preview=1`
      : `${apiUrl}/api/v1/public/profiles/${encodeURIComponent(slug)}/bank-accounts`

    fetch(endpoint, {
      headers: { Accept: 'application/json' },
      credentials: isPreview ? 'include' : 'omit',
    })
      .then((response) => response.json())
      .then((json) => {
        if (!json?.ok) return
        setEnabled(json.data?.enabled === true)
        setItems(Array.isArray(json.data?.items) ? json.data.items : [])
      })
      .catch(() => undefined)
  }, [slug, isPreview])

  useEffect(() => {
    if (!enabled || items.length === 0 || window.location.hash !== '#bancos') return
    window.setTimeout(() => {
      document.getElementById('bancos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 160)
  }, [enabled, items.length])

  async function copyText(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey((current) => current === key ? null : current), 1800)
  }

  async function copyHolderId(account: PublicBankAccount) {
    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
    const endpoint = isPreview
      ? `${apiUrl}/api/v1/public/profiles/${encodeURIComponent(slug)}/preview-bank-accounts/${encodeURIComponent(account.id)}/holder-id?preview=1`
      : `${apiUrl}/api/v1/public/profiles/${encodeURIComponent(slug)}/bank-accounts/${encodeURIComponent(account.id)}/holder-id`

    try {
      const response = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
        credentials: isPreview ? 'include' : 'omit',
      })
      const json = await response.json()
      if (!json?.ok || !json.data?.copy_value) return
      await copyText(String(json.data.copy_value), `id:${account.id}`)
    } catch {
      // La identificación se mantiene oculta si no puede recuperarse.
    }
  }

  function bankSectionUrl() {
    return `${window.location.origin}/${encodeURIComponent(slug)}#bancos`
  }

  function shareBankSectionWhatsApp() {
    const url = bankSectionUrl()
    const message = `Te comparto mis datos bancarios para transferencias: ${url}`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  }

  async function copyBankSectionLink() {
    await copyText(bankSectionUrl(), 'bank-link')
  }

  if (!enabled || items.length === 0 || !portalHost) return null

  const content = (
    <section
      id="bancos"
      className="ilx-section scroll-mt-5"
      aria-labelledby="ilx-bank-title"
      style={{ borderTop: '1px solid var(--ilx-border)', paddingTop: 22, marginTop: 22 }}
    >
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--ilx-primary)' }}>Datos para transferencias</p>
        <h2 id="ilx-bank-title" className="mt-1 text-xl font-black tracking-[-0.03em]" style={{ color: 'var(--ilx-text)' }}>Cuentas bancarias</h2>
        <p className="mt-1 max-w-[320px] text-sm font-medium leading-5" style={{ color: 'var(--ilx-muted)' }}>Elige una cuenta y copia los datos que necesitas para transferir.</p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={shareBankSectionWhatsApp}
            className="rounded-xl border px-3 py-2.5 text-xs font-black transition active:scale-[0.98]"
            style={{ borderColor: 'var(--ilx-border)', background: 'var(--ilx-soft-primary)', color: 'var(--ilx-primary)' }}
            aria-label="Compartir enlace de cuentas bancarias por WhatsApp"
          >
            Enviar por WhatsApp
          </button>

          <button
            type="button"
            onClick={() => void copyBankSectionLink()}
            className="rounded-xl border px-3 py-2.5 text-xs font-black transition active:scale-[0.98]"
            style={{ borderColor: 'var(--ilx-border)', background: 'var(--ilx-surface)', color: 'var(--ilx-text)' }}
            aria-label="Copiar enlace directo a cuentas bancarias"
            aria-live="polite"
          >
            {copiedKey === 'bank-link' ? '✓ Enlace copiado' : 'Copiar enlace'}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((account) => {
          const logo = bankLogoUrl(account.bank_code)
          return (
            <article
              key={account.id}
              className="rounded-[20px] border p-4"
              style={{ borderColor: 'var(--ilx-border)', background: 'var(--ilx-soft-primary)' }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-white p-1 shadow-sm"
                  style={{ borderColor: 'var(--ilx-border)' }}
                >
                  {logo ? (
                    <img src={logo} alt={`Logo de ${account.bank_name}`} className="h-full w-full object-contain" loading="lazy" decoding="async" />
                  ) : (
                    <span className="text-sm font-black text-slate-600">{bankInitials(account.bank_name)}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1 pt-1">
                  <h3 className="text-sm font-black leading-5" style={{ color: 'var(--ilx-text)' }}>{account.bank_name}</h3>
                  <p className="mt-0.5 text-xs font-bold" style={{ color: 'var(--ilx-primary)' }}>{accountTypeLabel(account.account_type)} · {account.currency}</p>
                  <p className="mt-3 text-sm font-bold" style={{ color: 'var(--ilx-text)' }}>{account.holder_name}</p>
                  <p className="mt-1 break-all font-mono text-sm font-bold tracking-wide" style={{ color: 'var(--ilx-muted)' }}>{account.display_number}</p>
                  {account.holder_id_type && (
                    <p className="mt-1.5 text-[11px] font-semibold" style={{ color: 'var(--ilx-muted)' }}>
                      {account.holder_id_type === 'rnc' ? 'RNC' : 'Cédula'} protegido · se copia sin mostrarse
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void copyText(account.copy_value, `account:${account.id}`)}
                  className="rounded-xl px-3 py-3 text-sm font-black transition active:scale-[0.98]"
                  style={copiedKey === `account:${account.id}`
                    ? { background: '#D1FAE5', color: '#065F46' }
                    : { background: 'var(--ilx-action)', color: 'var(--ilx-on-action)' }}
                  aria-live="polite"
                >
                  {copiedKey === `account:${account.id}` ? '✓ Cuenta copiada' : 'Copiar cuenta'}
                </button>
                <button
                  type="button"
                  disabled={!account.holder_id_type}
                  onClick={() => void copyHolderId(account)}
                  className="rounded-xl border px-3 py-3 text-sm font-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                  style={copiedKey === `id:${account.id}`
                    ? { background: '#D1FAE5', color: '#065F46', borderColor: '#A7F3D0' }
                    : { background: 'var(--ilx-surface)', color: 'var(--ilx-text)', borderColor: 'var(--ilx-border)' }}
                  aria-live="polite"
                >
                  {copiedKey === `id:${account.id}`
                    ? `✓ ${account.holder_id_type === 'rnc' ? 'RNC' : 'Cédula'} copiado`
                    : `Copiar ${account.holder_id_type === 'rnc' ? 'RNC' : 'cédula'}`}
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <p className="mt-3 text-center text-[11px] font-semibold" style={{ color: 'var(--ilx-muted)' }}>
        Tus datos de identificación no se muestran públicamente.
      </p>
    </section>
  )

  return createPortal(content, portalHost)
}
