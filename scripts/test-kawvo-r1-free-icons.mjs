import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const root='app/src/components/admin/'
const read=p=>readFileSync(root+p,'utf8')
const shell=read('free/KawvoFreeShellPreview.tsx'), list=read('shared/KawvoPagedList.tsx'), icon=read('shared/KawvoAdminIcon.tsx')
for(const id of ['identity','contact','quick','location','links','portfolio','services','bank','design','account','credentials','notifications','ai'])assert(shell.includes("{id:'"+id+"',icon:'"+id+"'"),'missing module '+id)
assert.equal((shell.match(/<KawvoIconTile name=\{icon\}/g)||[]).length,2)
for(const name of ['edit','preview','agenda','account','share'])assert(shell.includes('<KawvoActionContent name="'+name+'"'))
assert(list.includes('item.icon&&')&&list.includes('disabled={item.disabled}')&&list.includes('onClick={()=>onOpen(item.id,{query,group})}'))
assert(icon.includes("from 'react-icons/fi'")&&icon.includes('aria-hidden="true"')&&icon.includes('focusable="false"'))
assert(read('free/FreePanelUi.tsx').includes('<KawvoAdminIcon name="back"/>'))


assert(icon.includes('export function KawvoIconTile')&&icon.includes('export function KawvoActionContent'))
for(const p of ['medical/MedicalDashboard.tsx','medical/KawMedAgendaOverview.tsx','sponsored/SponsorKawMed.tsx','sponsored/SponsoredUnifiedShell.tsx'])assert(read(p).includes('KawvoActionContent'),p)
assert(read('medical/KawMedUnifiedShellFrame.tsx').includes('<KawvoNavIcon id={item.id}/>'))

const master=read('sponsored/SponsorDashboard.tsx')
for(const title of ['Patrocinios','Gestión de patrocinio','Mi presentación','Agenda Master','Identidad de patrocinio','Credenciales y seguridad','Dispositivos','Ver enlace Master'])assert(master.includes('title="'+title+'"'),'Link Master missing '+title)
assert(master.includes('title={commercialConfig.resource_label||\'Recurso comercial\'}'))
assert(master.includes('aria-pressed={!assignmentsView}')&&master.includes('aria-pressed={assignmentsView}'))
console.log('PASS_R1_LINK_SPONSOR_MASTER_SOURCE_CONTRACT')
