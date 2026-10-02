import { useEffect, useRef, useState } from 'react'
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
  vimenca: 'banco-vimenca.webp', promerica: 'banco-promerica.webp', popular: 'banco-popular.webp', bdi: 'banco-bdi.webp',
  'santa-cruz': 'banco-santa-cruz.webp', 'bhd-leon': 'banco-bhd-leon.webp', ademi: 'banco-ademi.webp', banesco: 'banesco.webp',
  scotiabank: 'scotiabank.webp', 'la-nacional': 'la-nacional.webp', banreservas: 'banreservas.webp', citi: 'citi.webp',
  caribe: 'banco-caribe.webp', 'lopez-de-haro': 'banco-lopez-de-haro.webp', bellbank: 'bellbank.webp',
  'activo-dominicana': 'banco-activo-dominicana.webp', lafise: 'banco-lafise.webp', 'asociacion-cibao': 'asociacion-cibao.webp',
}

function bankInitials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'B' }
function accountTypeLabel(type: PublicBankAccount['account_type']) { return type === 'checking' ? 'Cuenta corriente' : 'Cuenta de ahorros' }
function bankLogoUrl(code: string | null) { if (!code) return null; const file = BANK_LOGO_FILES[code]; return file ? `/bank-logos/${file}` : null }
function teamCompanyName() { return String(document.documentElement.dataset.kawvoTeamName || '').trim() }

export default function PublicBankAccounts() {
  const params = useParams()
  const host = window.location.hostname.toLowerCase()
  const slug =
    String(params.slug || '') ||
    ((host === 'argenisgrullon.com' || host === 'www.argenisgrullon.com') ? 'argenisg' : '')
  const [items, setItems] = useState<PublicBankAccount[]>([])
  const [enabled, setEnabled] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const sectionRef = useRef<HTMLElement | null>(null)
  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1'

  useEffect(() => {
    let createdHost: HTMLElement | null = null
    const attach = () => {
      const existing = document.getElementById('ilx-bank-slot')
      if (existing) { setPortalHost(existing); return true }
      const shareSection = document.querySelector('.ilx-share')
      const body = shareSection?.parentElement
      if (!shareSection || !body) return false
      const host = document.createElement('div'); host.id = 'ilx-bank-slot'; body.insertBefore(host, shareSection); createdHost = host
      setPortalHost(host)
      return true
    }
    if (attach()) return () => undefined
    const observer = new MutationObserver(() => { if (attach()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { observer.disconnect(); setPortalHost(null); if (createdHost?.parentElement) createdHost.parentElement.removeChild(createdHost) }
  }, [])

  useEffect(() => {
    if (!slug) return
    if (document.documentElement.dataset.kawvoTeamMember === '1' && document.documentElement.dataset.kawvoTeamShowBanks === '0') {
      setEnabled(false); setItems([]); return
    }
    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
    const endpoint = isPreview
      ? `${apiUrl}/api/v1/public/profiles/${encodeURIComponent(slug)}/preview-bank-accounts?preview=1`
      : `${apiUrl}/api/v1/public/profiles/${encodeURIComponent(slug)}/bank-accounts`
    fetch(endpoint, { headers: { Accept: 'application/json' }, credentials: isPreview ? 'include' : 'omit' })
      .then((response) => response.json()).then((json) => { if (!json?.ok) return; setEnabled(json.data?.enabled === true); setItems(Array.isArray(json.data?.items) ? json.data.items : []) }).catch(() => undefined)
  }, [slug, isPreview])

  useEffect(() => {
    if (!enabled || items.length === 0 || window.location.hash !== '#bancos') return
    setExpanded(true)
    window.setTimeout(() => { document.getElementById('bancos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 160)
  }, [enabled, items.length])

  useEffect(() => {
    if (!expanded) return
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && !sectionRef.current?.contains(target)) setExpanded(false)
    }
    document.addEventListener('pointerdown', closeOutside, true)

    let idleTimer = window.setTimeout(() => setExpanded(false), 8000)
    const resetIdle = () => { window.clearTimeout(idleTimer); idleTimer = window.setTimeout(() => setExpanded(false), 8000) }
    const section = sectionRef.current
    section?.addEventListener('pointerdown', resetIdle)
    section?.addEventListener('keydown', resetIdle)

    return () => {
      document.removeEventListener('pointerdown', closeOutside, true)
      section?.removeEventListener('pointerdown', resetIdle)
      section?.removeEventListener('keydown', resetIdle)
      window.clearTimeout(idleTimer)
    }
  }, [expanded])

  async function writeClipboard(value: string) {
    try { await navigator.clipboard.writeText(value) } catch {
      const textarea = document.createElement('textarea'); textarea.value = value; textarea.style.position = 'fixed'; textarea.style.opacity = '0'; document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove()
    }
  }

  async function copySensitive(value: string) {
    await writeClipboard(value)
  }

  async function copyHolderId(account: PublicBankAccount) {
    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
    const endpoint = isPreview
      ? `${apiUrl}/api/v1/public/profiles/${encodeURIComponent(slug)}/preview-bank-accounts/${encodeURIComponent(account.id)}/holder-id?preview=1`
      : `${apiUrl}/api/v1/public/profiles/${encodeURIComponent(slug)}/bank-accounts/${encodeURIComponent(account.id)}/holder-id`
    try {
      const response = await fetch(endpoint, { headers: { Accept: 'application/json' }, credentials: isPreview ? 'include' : 'omit' })
      const json = await response.json(); if (!json?.ok || !json.data?.copy_value) return; await copySensitive(String(json.data.copy_value))
    } catch { /* identificación protegida */ }
  }

  function bankSectionUrl() {
    return `${window.location.origin}/${encodeURIComponent(slug)}?share=bancos&card=3#bancos`
  }

  function shareBankSectionWhatsApp() {
    const url = bankSectionUrl()
    const company = teamCompanyName()
    const message = company
      ? `Te comparto los datos bancarios de ${company}: ${url}`
      : `Te comparto mis datos bancarios para transferencias: ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  async function copyBankSectionLink() {
    await writeClipboard(bankSectionUrl())
    setCopiedLink(true)
    window.setTimeout(() => setCopiedLink(false), 1500)
  }

  if (!enabled || items.length === 0 || !portalHost) return null

  const content = (
    <section ref={sectionRef} id="bancos" className="ilx-section scroll-mt-5" aria-labelledby="ilx-bank-title" style={{ borderTop: '1px solid var(--ilx-border)', paddingTop: 18, marginTop: 22 }}>
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-xl py-1 text-left transition active:scale-[0.995]"
        aria-expanded={expanded}
        aria-controls="ilx-bank-content"
      >
        <span className="flex items-center gap-2">
<span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: 'var(--ilx-soft-primary)', color: 'var(--ilx-text)' }}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 3 3 7v2h18V7l-9-4Zm-7 8v6H3v2h18v-2h-2v-6h-2v6h-3v-6h-2v6H9v-6H7v6H5v-6Z"/></svg>
          </span>
          <h2 id="ilx-bank-title" className="text-xl font-black tracking-[-0.03em]" style={{ color: 'var(--ilx-text)' }}>Cuentas</h2>
        </span>
        <span aria-hidden="true" className="text-xl font-black transition-transform duration-200" style={{ color: 'var(--ilx-muted)', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>⌄</span>
      </button>

      {expanded && (
        <div id="ilx-bank-content">
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold">
            <button type="button" onClick={shareBankSectionWhatsApp} className="p-0 underline underline-offset-4 transition active:opacity-60" style={{ color: 'var(--ilx-primary)', background: 'transparent', border: 0 }}>Enviar cuentas por WhatsApp</button>
            <button type="button" onClick={() => void copyBankSectionLink()} className="p-0 underline underline-offset-4 transition active:opacity-60" style={{ color: 'var(--ilx-text)', background: 'transparent', border: 0 }} aria-live="polite">{copiedLink ? 'Enlace copiado' : 'Copiar enlace'}</button>
          </div>

          <div className="mt-4 space-y-3">
            {items.map((account) => {
              const logo = bankLogoUrl(account.bank_code)
              return (
                <article key={account.id} className="rounded-[20px] border p-4" style={{ borderColor: 'var(--ilx-border)', background: 'var(--ilx-soft-primary)' }}>
                  <div className="flex items-start gap-4">
                    <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-white p-1 shadow-sm" style={{ borderColor: 'var(--ilx-border)' }}>
                      {logo ? <img src={logo} alt={`Logo de ${account.bank_name}`} className="h-full w-full object-contain" loading="lazy" decoding="async" /> : <span className="text-sm font-black text-slate-600">{bankInitials(account.bank_name)}</span>}
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                      <h3 className="text-sm font-black leading-5" style={{ color: 'var(--ilx-text)' }}>{account.bank_name}</h3>
                      <p className="mt-0.5 text-xs font-bold" style={{ color: 'var(--ilx-primary)' }}>{accountTypeLabel(account.account_type)} · {account.currency}</p>
                      <p className="mt-3 text-sm font-bold" style={{ color: 'var(--ilx-text)' }}>{account.holder_name}</p>
                      <p className="mt-1 break-all font-mono text-sm font-bold tracking-wide" style={{ color: 'var(--ilx-muted)' }}>{account.display_number}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => void copySensitive(account.copy_value)} className="rounded-xl px-3 py-3 text-sm font-black transition active:scale-[0.96]" style={{ background: 'var(--ilx-action)', color: 'var(--ilx-on-action)' }} aria-label="Cuenta">Cuenta</button>
                    <button type="button" disabled={!account.holder_id_type} onClick={() => void copyHolderId(account)} className="rounded-xl border px-3 py-3 text-sm font-black transition active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45" style={{ background: 'var(--ilx-surface)', color: 'var(--ilx-text)', borderColor: 'var(--ilx-border)' }} aria-label="RNC o cédula">RNC / CÉD.</button>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )

  return createPortal(content, portalHost)
}
