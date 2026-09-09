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
import './team-presentation'
import './team-code-retention'
import './team-v2'
import './team-name'
import './team-corporate'
import './team-master-sync'
import './team-public-policy'
import './team-role-access'
import './team-member-media'
import './team-admin'
import './team-member-basic'
import './ai-profile-assistant-access'
import './ai-profile-assistant'
import './instagram-preview'
import { refreshDueInstagramConnections } from './instagram-token-refresh'
import { cleanupExpiredTeamCodes } from './team-v2'
import { registerDemoAiRoutes } from './routes/demo-ai'
import app from './preview-free-actions'

registerDemoAiRoutes(app)

;(app as any).scheduled = (_event: ScheduledEvent, env: any, ctx: ExecutionContext) => {
  ctx.waitUntil(Promise.all([
    refreshDueInstagramConnections(env),
    cleanupExpiredTeamCodes(env),
  ]))
}

export default app
