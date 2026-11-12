import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const src=readFileSync('app/src/components/admin/free/KawvoFreeShellPreview.tsx','utf8')
assert.match(src,/aria-label="Menú lateral Kawvo"/,'Desktop sidebar has accessible label')
assert.match(src,/md:flex/,'Desktop sidebar rendered at desktop breakpoint')
assert.match(src,/md:hidden/,'Mobile navigation hidden on desktop')
assert.match(src,/md:pl-\[244px\]/,'Desktop content reserves sidebar width')
assert.match(src,/key!=='agenda'\|\|Boolean\(agendaRoute\)/,'Agenda hidden when unavailable')
assert.match(src,/aria-current=\{tab===key\?'page':undefined\}/,'Current navigation tab is announced')
assert.match(src,/navigate\('\/admin\/free'\)/,'Actions defer to original Free panel')
assert.match(src,/import\.meta\.env\.MODE==='preview'/,'Preview only')
assert.match(src,/get\('kawvo_shell'\)==='1'/,'Opt-in only')
assert.doesNotMatch(src,/apiPost\(|apiPatch\(|apiPut\(|apiDelete\(/,'No writes in experimental UI')
console.log('PASS: Free shell desktop sidebar + mobile navigation + permission-aware Agenda + Preview-only guard')
