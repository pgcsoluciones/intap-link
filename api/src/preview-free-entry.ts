import './preview-starter-apply'
import './preview-support-tickets'
import './preview-exit-feedback'
import './preview-profile-delete-mobile'
import './account-center'
import './free-profile-preview'
import './free-feedback'
import './bank-accounts'
import './preview-bank-accounts'
import './scan-status'
import './scan-to-claim'
import './ai-profile-assistant-access'
import './ai-profile-assistant'
import { registerDemoAiRoutes } from './routes/demo-ai'
import app from './preview-free-actions'

// Register public Demo IA on the fully assembled Preview app.
// index.ts also registers it for the production entry; this explicit Preview
// registration avoids the circular preview-entry assembly dropping the route.
registerDemoAiRoutes(app)

export default app
