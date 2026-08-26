import { useEffect, useState } from 'react'
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

function bankInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'B'
}

function accountTypeLabel(type: PublicBankAccount['account_type']) {
  return type === 'checking' ? 'Cuenta corriente' : 'Cuenta de ahorros'
}

export default function PublicBankAccounts() {
  const { slug = '' } = useParams()
  const [items, setItems] = useState<PublicBankAccount[]>([])
  const [enabled, setEnabled] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1'

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
    }, 120)
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

  async function shareBankSection() {
    const url = `${window.location.origin}/${encodeURIComponent(slug)}#bancos`
    const title = 'Datos bancarios'
    const text = 'Consulta los datos bancarios para realizar una transferencia.'
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 1800)
    } catch {
      // Cancelar el panel nativo de compartir no es un error.
    }
  }

  if (!enabled || items.length === 0) return null

  return (
    <section id="bancos" className="scroll-mt-4 bg-[#f7f9fc] px-4 pb-28 pt-2 font-['Inter'] text-slate-950">
      <div className="mx-auto w-full max-w-[430px]">
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-700">Datos para transferencias</p>
              <h2 className="mt-1 text-xl font-black tracking-[-0.03em]">Cuentas bancarias</h2>
              <p className="mt-1 text-sm font-medium leading-6 text-slate-500">Copia la cuenta o la identificación del titular sin salir del perfil.</p>
            </div>
            <button type="button" onClick={() => void shareBankSection()} className="shrink-0 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800">
              {shareCopied ? '✓ Copiado' : 'Compartir'}
            </button>
          </div>

          <div className="space-y-3">
            {items.map((account) => (
              <article key={account.id} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-xs font-black text-slate-700 shadow-sm">
                    {bankInitials(account.bank_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-black text-slate-950">{account.bank_name}</h3>
                    <p className="mt-0.5 text-xs font-bold text-cyan-700">{accountTypeLabel(account.account_type)} · {account.currency}</p>
                    <p className="mt-3 text-sm font-bold text-slate-800">{account.holder_name}</p>
                    <p className="mt-1 break-all font-mono text-sm font-bold tracking-wide text-slate-500">{account.display_number}</p>
                    {account.holder_id_type && <p className="mt-2 text-xs font-semibold text-slate-400">{account.holder_id_type === 'rnc' ? 'RNC' : 'Cédula'} del titular oculta por privacidad</p>}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void copyText(account.copy_value, `account:${account.id}`)}
                    className={`rounded-xl px-3 py-3 text-sm font-black transition ${copiedKey === `account:${account.id}` ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-950 text-white active:scale-[0.98]'}`}
                    aria-live="polite"
                  >
                    {copiedKey === `account:${account.id}` ? '✓ Cuenta copiada' : 'Copiar cuenta'}
                  </button>
                  <button
                    type="button"
                    disabled={!account.holder_id_type}
                    onClick={() => void copyHolderId(account)}
                    className={`rounded-xl px-3 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 ${copiedKey === `id:${account.id}` ? 'bg-emerald-100 text-emerald-800' : account.holder_id_type ? 'border border-slate-300 bg-white text-slate-800 active:scale-[0.98]' : ''}`}
                    aria-live="polite"
                  >
                    {copiedKey === `id:${account.id}` ? `✓ ${account.holder_id_type === 'rnc' ? 'RNC' : 'Cédula'} copiado` : `Copiar ${account.holder_id_type === 'rnc' ? 'RNC' : 'cédula'}`}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <a href={`/${encodeURIComponent(slug)}#bancos`} className="mt-4 block text-center text-xs font-bold text-slate-400">Enlace directo a esta sección: #{'bancos'}</a>
        </div>
      </div>
    </section>
  )
}
