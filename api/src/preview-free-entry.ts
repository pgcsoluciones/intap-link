import './preview-starter-apply'
import './preview-support-tickets'
import './preview-exit-feedback'
import './preview-profile-delete-mobile'
import './account-center'
import './lifecycle-notifications'
import './free-profile-preview'
import './free-feedback'
import './feature-promotions'
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

registerDemoAiRoutes(app)

;(app as any).scheduled = (_event: ScheduledEvent, env: any, ctx: ExecutionContext) => {
  ctx.waitUntil(refreshDueInstagramConnections(env))
}

export default app
