import './preview-starter-apply'
import './preview-support-tickets'
import './preview-exit-feedback'
import './preview-profile-delete-mobile'
import './account-center'
import './lifecycle-notifications'
import './free-profile-preview'
import './free-feedback'
import './bank-accounts'
import './preview-bank-accounts'
import './scan-status'
import './scan-to-claim'
import './artifact-controls'
import './ai-profile-assistant-access'
import './ai-profile-assistant'
import './instagram-preview'
import { refreshDueInstagramConnections } from './instagram-token-refresh'
import { registerDemoAiRoutes } from './routes/demo-ai'
import app from './preview-free-actions'

// Register public Demo IA on the fully assembled Preview app.
// index.ts also registers it for the production entry; this explicit Preview
// registration avoids the circular preview-entry assembly dropping the route.
registerDemoAiRoutes(app)

// Production uses this module as its Worker entry. Keep the normal Hono fetch
// handler and add a daily scheduled task that renews Instagram long-lived
// tokens before they enter the final 14-day window. A failed refresh never
// overwrites the current encrypted token; the connection remains available
// for retry while Meta still considers it valid.
;(app as any).scheduled = (_event: ScheduledEvent, env: any, ctx: ExecutionContext) => {
  ctx.waitUntil(refreshDueInstagramConnections(env))
}

export default app
