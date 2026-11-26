// Private commercial contact only. Never reuse the public banner template.
export const SPONSOR_MESSAGE_LIMIT=400
export const DEFAULT_SPONSOR_MESSAGE='Hola {vendedor}, soy {patrocinado}. Me gustaría recibir información de {patrocinador}.'
export const SPONSOR_MESSAGE_VARIABLES=['vendedor','visitador','patrocinado','negocio','patrocinador'] as const
export function validSponsorMessage(value:unknown):value is string{
 if(typeof value!=='string'||!value.trim()||value.length>SPONSOR_MESSAGE_LIMIT)return false
 const rest=value.replace(/\{(vendedor|visitador|patrocinado|negocio|patrocinador)\}/gi,'')
 return !/[{}]/.test(rest)&&!/[^\S\r\n\t]*[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)
}
export function renderSponsorMessage(template:string,values:{representative:string;beneficiary:string;sponsor:string}){
 const lookup:Record<string,string>={vendedor:values.representative,visitador:values.representative,patrocinado:values.beneficiary,negocio:values.beneficiary,patrocinador:values.sponsor}
 return (validSponsorMessage(template)?template:DEFAULT_SPONSOR_MESSAGE).replace(/\{(vendedor|visitador|patrocinado|negocio|patrocinador)\}/gi,(_,key:string)=>lookup[key.toLowerCase()]||'')
}
export function commercialWhatsAppNumber(value:unknown){
 const raw=String(value??'').trim()
 if(!/^[+()0-9 .-]+$/.test(raw))return ''
 let digits=raw.replace(/\D/g,'')
 if(digits.length===10&&/^(809|829|849)/.test(digits))digits='1'+digits
 return /^[1-9][0-9]{6,14}$/.test(digits)?digits:''
}
