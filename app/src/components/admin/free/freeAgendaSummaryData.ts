/** Reduce only the existing scoped Agenda response. Never render another profile's data. */
export type AgendaSummaryItem={id:string;customer_name:string;reason_label:string;appointment_date:string;start_time:string;created_at:string}
export function newestPendingAgenda(response:unknown,profileId:string):AgendaSummaryItem[]{
  if(!profileId||!response||typeof response!=='object')throw Error('Agenda no verificable')
  const payload=response as {ok?:boolean;data?:{profile?:{id?:string|number};requests?:unknown[]}}
  if(payload.ok!==true||String(payload.data?.profile?.id??'')!==profileId||!Array.isArray(payload.data?.requests))throw Error('Agenda no corresponde a la cuenta activa')
  const time=(value:string)=>Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)?value.replace(' ','T')+'Z':value)
  const rows:AgendaSummaryItem[]=[]
  for(const raw of payload.data.requests){
    if(!raw||typeof raw!=='object')throw Error('Solicitud no verificable')
    const item=raw as Record<string,unknown>
    if(item.status!=='pending')continue
    if(typeof item.id!=='string'||!item.id||typeof item.created_at!=='string'||!Number.isFinite(time(item.created_at)))throw Error('Fecha de solicitud no verificable')
    rows.push({id:item.id,created_at:item.created_at,customer_name:typeof item.customer_name==='string'?item.customer_name:'Solicitud de cita',reason_label:typeof item.reason_label==='string'?item.reason_label:'Cita',appointment_date:typeof item.appointment_date==='string'?item.appointment_date:'',start_time:typeof item.start_time==='string'?item.start_time:''})
  }
  return rows.sort((a,b)=>time(b.created_at)-time(a.created_at)||a.id.localeCompare(b.id)).slice(0,5)
}
