import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

type PublicBankAccount = {
  id: string
  bank_code: string | null
  bank_name: string
  account_type: 'savings' | 'checking'
  currency: 'DOP' | 'USD'
  holder_name: string
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
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
    fetch(`${apiUrl}/api/v1/public/profiles/${encodeURIComponent(slug)}/bank-accounts`, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
    })
      .then((response) => response.json())
      .then((json) => {
        if (!json?.ok) return
        setEnabled(json.data?.enabled === true)
        setItems(Array.isArray(json.data?.items) ? json.data.items : [])
      })
      .catch(() => undefined)
  }, [slug])

  async function copyAccount(account: PublicBankAccount) {
    try {
      await navigator.clipboard.writeText(account.copy_value)
      setCopiedId(account.id)
      window.setTimeout(() => setCopiedId((current) => current === account.id ? null : current), 1800)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = account.copy_value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
      setCopiedId(account.id)
      window.setTimeout(() => setCopiedId((current) => current === account.id ? null : current), 1800)
    }
  }

  if (!enabled || items.length === 0) return null

  return (
    <section className="bg-[#f7f9fc] px-4 pb-28 pt-2 font-['Inter'] text-slate-950">
      <div className="mx-auto w-full max-w-[430px]">
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
          <div className="mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-700">Datos para transferencias</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.03em]">Cuentas bancarias</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-500">Toca “Copiar cuenta” para usar el número completo.</p>
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
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void copyAccount(account)}
                  className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-black transition ${copiedId === account.id ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-950 text-white active:scale-[0.98]'}`}
                  aria-live="polite"
                >
                  {copiedId === account.id ? '✓ Cuenta copiada' : 'Copiar cuenta'}
                </button>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
