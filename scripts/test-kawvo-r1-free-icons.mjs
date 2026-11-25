import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const root='app/src/components/admin/'
const read=p=>readFileSync(root+p,'utf8')
const shell=read('free/KawvoFreeShellPreview.tsx'), list=read('shared/KawvoPagedList.tsx'), icon=read('shared/KawvoAdminIcon.tsx')
for(const id of ['identity','contact','quick','location','links','portfolio','services','bank','design','account','credentials','notifications','ai'])assert(shell.includes("{id:'"+id+"',icon:'"+id+"'"),'missing module '+id)
assert.equal((shell.match(/<KawvoAdminIcon name=\{icon\}/g)||[]).length,2)
for(const name of ['edit','preview','agenda','account','share','chevron'])assert(shell.includes('<KawvoAdminIcon name="'+name+'"'))
assert(list.includes('item.icon&&')&&list.includes('disabled={item.disabled}')&&list.includes('onClick={()=>onOpen(item.id,{query,group})}'))
assert(icon.includes("from 'react-icons/fi'")&&icon.includes('aria-hidden="true"')&&icon.includes('focusable="false"'))
assert(read('free/FreePanelUi.tsx').includes('<KawvoAdminIcon name="back"/>'))
console.log('PASS_R1_FREE_ICONOGRAPHY_SOURCE_CONTRACT')
