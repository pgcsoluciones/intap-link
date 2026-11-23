// Exact G8-004 authorization: one immutable corrective handler, never a general exclusion.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

export const G8_SNAPSHOT='474b52d3b173c40ecda346030acd8e7438e79003'
export const G8_CORRECTION='8bc33c1b62d2c11147ffc192119fac98009cd5b5'
export const G8_HANDLER='api/src/kawmed-demo-invitations.ts'
export const G8_RUNTIME=['api','app','web','functions','shared','.github','package.json','package-lock.json']
export function assertAuthorizedDelta(changed,actual,expected){
 assert.deepEqual(changed,[G8_HANDLER],'Only the authorized LIVE handler may differ in runtime')
 assert.deepEqual(actual,expected,'LIVE handler must equal the complete immutable #183 blob; arbitrary edits forbidden')
}
export function assertG8Runtime(root,reference=G8_SNAPSHOT,paths=G8_RUNTIME){
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim()
 assert.equal(git('rev-parse',G8_CORRECTION+'^'),G8_SNAPSHOT,'Fast-forward lineage, no duplicated correction')
 git('merge-base','--is-ancestor',G8_CORRECTION,'HEAD')
 const changed=git('diff','--name-only',reference,'--',...paths).split('\n').filter(Boolean)
 const expected=execFileSync('git',['show',G8_CORRECTION+':'+G8_HANDLER],{cwd:root})
 assertAuthorizedDelta(changed,readFileSync(join(root,G8_HANDLER)),expected)
 git('diff','--exit-code',G8_CORRECTION,'--',G8_HANDLER)
 const extra=git('ls-files','--others','--exclude-standard','--',...paths)
 assert.equal(extra,'','No untracked runtime file may bypass the freeze')
 git('diff','--exit-code',reference,'--',...paths,':(exclude)'+G8_HANDLER)
 return {snapshot:G8_SNAPSHOT,correction:G8_CORRECTION,onlyRuntimeDelta:G8_HANDLER}
}
