import fs from 'node:fs'

function read(path){return fs.readFileSync(path,'utf8')}
function has(text,needle,label){if(!text.includes(needle))throw new Error('Falta contrato: '+label)}
function absent(text,needle,label){if(text.includes(needle))throw new Error('Regresión: '+label)}

const dashboard=read('app/src/components/admin/free/FreeDashboard.tsx')
const account=read('app/src/components/admin/free/FreeAccount.tsx')
const dashboardTour=read('app/src/components/admin/free/FreeGuidedTour.tsx')
const accountTour=read('app/src/components/admin/free/FreeAccountGuidedTour.tsx')

has(dashboard,"<FreeGuidedTour storageId={me ? String(me.email || me.profile_id || '') : ''} />",'Dashboard espera identidad estable antes del auto recorrido')
absent(dashboard,"me?.profile_id || me?.email || 'free'",'Dashboard no puede arrancar con clave provisional free')
has(account,"<FreeAccountGuidedTour storageId={me ? String(me.email || me.slug || '') : ''} />",'Mi cuenta usa identidad estable del usuario')
absent(account,"me?.slug || me?.email || 'free'",'Mi cuenta no puede arrancar con slug/fallback provisional')
has(dashboardTour,"if (autoStartedRef.current || !storageId) return",'Dashboard no auto inicia sin storageId estable')
has(accountTour,"if(started.current||!storageId)return",'Mi cuenta no auto inicia sin storageId estable')
has(dashboardTour,"localStorage.setItem(autoKey, '1')",'Dashboard persiste Ya entendí')
has(accountTour,"localStorage.setItem(autoKey,'1')",'Mi cuenta persiste Ya entendí')
has(dashboardTour,"const onReplay = () => start(true)",'Recorrido manual Dashboard sigue disponible')
has(accountTour,"const fn=()=>start(true)",'Recorrido manual Mi cuenta sigue disponible')

console.log('Free guided tour persistence checks: OK')
