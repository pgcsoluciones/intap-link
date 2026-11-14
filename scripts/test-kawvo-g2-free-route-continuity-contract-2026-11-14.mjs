import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

// G2.3 navigation contracts. These are static anti-regression checks,
// NOT substitutes for authenticated tests of saving, navigation, and account isolation.
const f=(name)=>readFileSync(name,'utf8')
const helper=f('app/src/components/admin/free/KawvoShellReturn.ts')
const back=f('app/src/components/admin/free/FreePanelUi.tsx')
const account=f('app/src/components/admin/free/FreeAccount.tsx')
const credentials=f('app/src/components/admin/free/FreeCredentials.tsx')
const identity=f('app/src/components/admin/free/onboarding/FreeOnboardingIdentity.tsx')
const contact=f('app/src/components/admin/free/onboarding/FreeOnboardingContact.tsx')
const identifier=f('app/src/components/admin/free/FreeIdentifier.tsx')
const notices=f('app/src/components/admin/free/FreeNotifications.tsx')
const ai=f('app/src/components/admin/free/FreeAiProfileAssistant.tsx')
const shell=f('app/src/components/admin/free/KawvoFreeShellPreview.tsx')
const legacy=f('app/src/components/admin/free/FreeDashboard.tsx')
const app=f('app/src/App.tsx')
const must=(source,match,label)=>assert.ok(source.includes(match),label)
const not=(source,match,label)=>assert.ok(!source.includes(match),label)

// Navigation state is untrusted and never becomes an auth flag.
must(helper,"kawvoShellViaAccount?: boolean",'Optional nested account marker is typed')
must(helper,'if (state.kawvoShellViaAccount === true) result.kawvoShellViaAccount = true','Only literal true can mark an account route')
must(helper,"if (context.kawvoShellViaEditor)",'Editor origin has priority')
must(helper,"if (context.kawvoShellViaAccount)",'Account origin is supported')
must(helper,"path:'/admin/free/account', state:{...context,kawvoShellViaAccount:false}",'Returning to Account clears only nested account flag')
must(helper,"path:KAWVO_SHELL_PREVIEW_ROUTE, state:context",'Direct More route goes back to shell')
must(helper,"import.meta.env.MODE === 'preview'",'Feature remains Preview build only')
must(helper,"window.location.hostname === 'app.preview.intaprd.com'",'Feature remains exact App Preview host only')
must(helper,"kawvoShellAccount: string",'Account-scoped state survives')
must(shell,"incomingReturn.kawvoShellAccount!==activeAccount",'Shell still verifies /me identity before restoring')

// Credenciales directly from Más goes to shell; through Cuenta returns to Cuenta.
// onBack is used by embedded views and takes precedence over history hints.
must(credentials,"const location = useLocation()", 'Credentials reads route state')
must(credentials,"const shellReturn = isKawvoShellPreviewHost() ? getKawvoShellReturn(location.state) : null",'Credentials validates Preview-origin only')
must(credentials,"if(onBack){onBack();return}",'Embedded credentials keep parent callback')
must(credentials,"const target=kawvoShellBackTarget(shellReturn)",'Credentials returns to precise origin')
must(credentials,"navigate(backTo)",'Original default return to Account remains for old panel')
must(account,"const openAccountSection = (path:string)",'Account has scoped navigation')
must(account,"kawvoShellViaAccount:true",'Account marks nested route')
must(account,"openAccountSection('/admin/free/credentials')",'Credentials entered via Account preserves context')
must(account,"openAccountSection('/admin/free/ai-profile')",'Account AI entry preserves context')
must(account,"openAccountSection('/admin/free/team')",'Account Team entry preserves context')
must(account,"shellReturn ? KAWVO_SHELL_PREVIEW_ROUTE : '/admin/free'",'Account back still falls back to legacy panel')
must(back,"else if (returnContext.kawvoShellViaAccount)",'Shared Back returns to Account if appropriate')
must(back,"navigate('/admin/free/account', {state:{...returnContext,kawvoShellViaAccount:false}})",'Shared Back preserves shell origin under Account')
must(back,"onClick(event)",'Legacy button behavior survives')

// Saving an already-existing form should never create an extra API write,
// or redirect to the old panel when the same session arrived from the shell.
for(const [name,src] of [['Identidad',identity],['Contacto',contact],['Identificador',identifier]]){
 must(src,'getKawvoShellReturn(location.state)',name+' must validate incoming shell context')
 must(src,'kawvoShellBackTarget(shellReturn)',name+' must use scoped return')
 must(src,'replace:true,state:target.state',name+' must complete without leaving the old panel in history')
}
must(identity,"apiPut('/me/profile', body)",'Identity saves still go through original API')
must(identity,"navigate(teamMember || editingFromPanel ? '/admin/free' : '/admin/free/onboarding/contact', { replace: true })",'Original identity onboarding still works outside shell')
must(contact,"apiPut('/me/contact', body)",'Contact saves still use original API')
must(contact,"else navigate('/admin/free',{replace:true})",'Original Contact save destination survives')
must(identifier,"apiPut('/me/profile/slug'",'Identifier saves still use original API')
must(identifier,"else navigate('/admin/free',{replace:true})",'Original Identifier destination survives')

// Account/notifications/AI nested navigation retains proper return for Preview users.
must(notices,'shellReturn?{state:shellReturn}:undefined','Notifications retain context on internal navigations')
must(ai,'const goBackToOrigin=()=>','AI gets scoped exit when entered from shell')
must(ai,'onClick={goBackToOrigin}','AI cancellation and success do not force the original panel')
must(ai,"else navigate('/admin/free')",'AI legacy behavior remains for old sessions')
not(credentials,'window.location.replace','No credential flow cross-host redirects')
not(helper,'apiPut(','Route helper never writes profile')
not(helper,'apiPost(','Route helper never writes credentials')

// Existing authorization/publication continues to be the sole authority.
must(app,'path="/admin/free/credentials" element={<FreeOwnerOnly><AdminGuard planScope="free">','Credential guard unchanged')
must(app,'path="/admin/free/shell-preview" element={<AdminGuard planScope="free">','Shell guard unchanged')
must(legacy,'const togglePublished = async () =>','Publication remains in FreeDashboard')
console.log('PASS: G2.3 credential/Account/AI and save-flow return to original Kawvo tab without new writes')
