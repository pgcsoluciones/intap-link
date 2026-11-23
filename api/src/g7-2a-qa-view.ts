// G7.2 isolated first-party QA view. No external assets; no PII in HTML or logs.
// All actual commercial records are fetched through authenticated, tenant-scoped GETs.
export function renderCommercialQaPage(){
 const html=String.raw`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Kawvo · Paginación comercial G7.2</title>
<style>
:root{font-family:system-ui,-apple-system,sans-serif;color:#142237;background:#f1f5f9}*{box-sizing:border-box}body{margin:0}main{max-width:960px;margin:auto;padding:18px 14px 70px}.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px}.brand{font-size:22px;font-weight:850;letter-spacing:-.5px}.brand em{font-style:normal;color:#077e91}h1{font-size:clamp(22px,5vw,32px);line-height:1.2;margin:8px 0}p{line-height:1.5}a{color:#075b79}.small{font-size:13px;color:#475569}.panel{background:white;border:1px solid #d7e1ea;border-radius:20px;padding:18px;box-shadow:0 2px 8px #16274208}.stack{display:grid;gap:12px}.grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}@media(min-width:650px){.grid{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}}button,input,select{font:inherit}button{cursor:pointer;min-height:44px;padding:10px 14px;border-radius:12px;border:1px solid #cbd5e1;background:white;font-weight:700;color:#142237}button[aria-pressed=true]{background:#e2f9fc;border-color:#00869b;color:#075a68}button:disabled{opacity:.42;cursor:not-allowed}input,select{width:100%;min-width:0;min-height:44px;border-radius:11px;border:1px solid #cbd5e1;background:white;padding:10px}label{font-size:13px;font-weight:750;display:block}label>*{margin-top:6px}.tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:17px 0}.card{border:1px solid #e0e7ef;border-radius:13px;padding:14px;min-width:0;overflow-wrap:anywhere}.person{font-weight:800;margin-bottom:5px}.row{display:flex;justify-content:space-between;align-items:start;gap:12px;flex-wrap:wrap}.chip{border-radius:22px;background:#edf3f7;padding:5px 10px;font-size:12px;white-space:nowrap}.controls{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:16px}.error{background:#fff1f2;border:1px solid #fecdd3;border-radius:12px;padding:14px;color:#991b1b}.info{background:#ebfafc;border-radius:12px;padding:11px 14px;font-size:13px;color:#075a68}#items{margin-top:12px}#status{min-height:25px}#retry{display:none}a.back{font-size:14px;text-decoration:none;font-weight:700}
</style></head>
<body><main><header class="top"><div class="brand">Kaw<em>vo</em> <span class="small">/ Master</span></div><a class="back" href="/admin/sponsor">Volver al panel Master</a></header>
<section class="panel"><div class="info">Vista de prueba G7.2 · Datos reales de D1 Preview · Solo lectura · No modifica asignaciones</div>
<h1>Paginación comercial</h1><p class="small">Consulta vendedores, visitadores y asignaciones sin descargar el listado completo. Para registrar o reasignar dispositivos usa el panel Master G5.</p>
<div class="tabs"><button id="sellerTab" type="button" aria-pressed="true">Vendedores / visitadores</button><button id="assignmentTab" type="button" aria-pressed="false">Asignaciones</button></div>
<div class="grid"><label>Buscar<input id="search" type="search" placeholder="Nombre, código, grupo o zona" autocomplete="off"></label><label>Estado<select id="state"><option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></label></div>
<div id="status" role="status" aria-live="polite" class="small" style="margin-top:16px"></div>
<div id="error" role="alert"></div><button id="retry" type="button">Reintentar</button>
<div id="items" class="stack" aria-live="polite"></div>
<nav class="controls" aria-label="Paginación"><button id="previous" type="button">Anterior</button><span id="position" class="small">Página 1</span><button id="next" type="button">Siguiente</button></nav></section></main>
<script>
(()=>{'use strict';
const dom=id=>document.getElementById(id);const st={resource:'sellers',page:1,limit:10,q:'',state:'all',current:null,serial:0};
const $={search:dom('search'),state:dom('state'),items:dom('items'),status:dom('status'),error:dom('error'),retry:dom('retry'),prev:dom('previous'),next:dom('next'),position:dom('position')};
const el=(tag,klass,text)=>{const e=document.createElement(tag);if(klass)e.className=klass;if(text!==undefined)e.textContent=String(text);return e};
function field(row,key){return String(row[key]??'').trim()}
function showRow(row){const box=el('article','card'),top=el('div','row'),left=el('div'),chip=el('span','chip');
 if(st.resource==='sellers'){left.append(el('div','person',field(row,'first_name')+' '+field(row,'last_name')),el('div','small',field(row,'whatsapp')));
 const detail=[field(row,'employee_code'),field(row,'zone'),field(row,'territory')].filter(Boolean).join(' · ');if(detail)left.append(el('div','small',detail));chip.textContent=Number(row.active)===1?'Activo':'Inactivo'}
 else{left.append(el('div','person',field(row,'public_code')),el('div','small',field(row,'representative_name')));
 if(field(row,'group_label'))left.append(el('div','small',field(row,'group_label')));chip.textContent=Number(row.active)===1?'Actual':'Histórica'}
 top.append(left,chip);box.append(top);return box}
function loading(){return st.current===null}
async function load(){const id=++st.serial;st.current=null;$.items.replaceChildren();$.status.textContent='Cargando página '+st.page+'…';$.error.replaceChildren();$.retry.style.display='none';$.prev.disabled=true;$.next.disabled=true;
 const p=new URLSearchParams({limit:String(st.limit),page:String(st.page),state:st.state});if(st.q)p.set('q',st.q);
 try{const res=await fetch('/api/v1/sponsor/commercial/'+st.resource+'/page?'+p.toString(),{credentials:'same-origin',headers:{'X-Intap-Account-Tab':sessionStorage.getItem('kawvo_intap_active_tab_v1')||''}});
 const data=await res.json();if(id!==st.serial)return;
 if(!res.ok||data.ok!==true||!data.data||data.data.version!=='g7.2-a'||data.data.resource!==st.resource||!Array.isArray(data.data.items))throw Error(data.error||'No se pudo cargar la página.');
 if(data.data.reset_required&&st.page!==1){st.page=1;return load()}
 st.current=data.data;$.status.textContent=st.current.total+' registros · '+st.current.items.length+' en esta página';
 if(!st.current.items.length)$.items.append(el('p','small','No se encontraron resultados.'));
 for(const row of st.current.items)$.items.append(showRow(row));
 $.prev.disabled=!st.current.has_previous;$.next.disabled=!st.current.has_more;
 $.position.textContent='Página '+st.current.page+' de '+Math.max(1,Math.ceil(st.current.total/st.current.limit));
 }catch(e){if(id!==st.serial)return;$.status.textContent='';
 const msg=e instanceof Error?e.message:'Error de consulta';$.error.replaceChildren(el('p','error',msg));
 if(/Acceso|patrocinador|pestaña|autoriz|habilitado/i.test(msg))$.error.append(el('p','small','Inicia sesión en app.preview.intaprd.com y selecciona tu patrocinador Master.'));
 $.retry.style.display='inline-block';$.position.textContent='Sin datos';}
}
let debounce;$.search.addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>{st.q=$.search.value.trim();st.page=1;void load()},300)});
$.state.addEventListener('change',()=>{st.state=$.state.value;st.page=1;void load()});
$.prev.addEventListener('click',()=>{if(!loading()&&st.current.has_previous){st.page=Math.max(1,st.page-1);void load()}});
$.next.addEventListener('click',()=>{if(!loading()&&st.current.has_more){st.page++;void load()}});
$.retry.addEventListener('click',()=>void load());
for(const [name,id,other] of [['sellers','sellerTab','assignmentTab'],['assignments','assignmentTab','sellerTab']])dom(id).addEventListener('click',()=>{st.resource=name;st.page=1;dom(id).setAttribute('aria-pressed','true');dom(other).setAttribute('aria-pressed','false');void load()});
void load();
})();
</script></body></html>`;
 return new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}})
}
