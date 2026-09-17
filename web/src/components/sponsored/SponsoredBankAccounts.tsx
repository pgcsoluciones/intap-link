import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

type Bank={id:string;bank_name:string;account_number:string;account_type:string;currency:string;holder_name:string}

export default function SponsoredBankAccounts(){
  const{username=''}=useParams();const[enabled,setEnabled]=useState(false);const[items,setItems]=useState<Bank[]>([]);const[copied,setCopied]=useState('')
  useEffect(()=>{let alive=true;fetch(`/api/v1/public/sponsored/${encodeURIComponent(username)}/bank-accounts`).then(r=>r.json()).then((j:any)=>{if(!alive||!j?.ok)return;setEnabled(Boolean(j.data?.enabled));setItems(Array.isArray(j.data?.items)?j.data.items:[])}).catch(()=>undefined);return()=>{alive=false}},[username])
  async function copy(value:string,id:string){await navigator.clipboard.writeText(value).catch(()=>undefined);setCopied(id);window.setTimeout(()=>setCopied(''),1500)}
  if(!enabled||items.length===0)return null
  return <section style={{width:'100%',maxWidth:520,margin:'0 auto',background:'#fff',padding:'30px 22px 34px',boxSizing:'border-box',fontFamily:'Inter,system-ui,sans-serif'}}><div style={{height:1,background:'#dce7f6',marginBottom:26}}/><h2 style={{margin:'0 0 14px',fontSize:23,lineHeight:1.15,fontWeight:850,color:'#0f2d63'}}>Cuentas bancarias</h2><div style={{display:'grid',gap:10}}>{items.map(item=><article key={item.id} style={{border:'1px solid #dce7f6',borderRadius:18,padding:'15px 16px',background:'#f8fbff'}}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start'}}><div><strong style={{display:'block',fontSize:15,color:'#0f2d63'}}>{item.bank_name}</strong><span style={{display:'block',marginTop:4,fontSize:12,color:'#64748b'}}>{item.account_type==='checking'?'Cuenta corriente':'Cuenta de ahorros'} · {item.currency}</span></div><button type="button" onClick={()=>void copy(item.account_number,item.id)} style={{border:'1px solid #cbd5e1',borderRadius:10,background:'#fff',padding:'7px 10px',fontSize:11,fontWeight:800,color:'#334155',cursor:'pointer'}}>{copied===item.id?'Copiado':'Copiar'}</button></div><div style={{marginTop:12,fontSize:18,fontWeight:850,letterSpacing:.5,color:'#172033'}}>{item.account_number}</div><div style={{marginTop:6,fontSize:12,color:'#64748b'}}>Titular: {item.holder_name}</div></article>)}</div></section>
}
