from pathlib import Path

p = Path('api/src/preview-free-entry.ts')
s = p.read_text()

if "registerDemoAiRoutes" not in s:
    s = s.replace("import './ai-profile-assistant'\n", "import './ai-profile-assistant'\nimport { registerDemoAiRoutes } from './routes/demo-ai'\n")

needle = "import app from './preview-free-actions'\n\nexport default app"
replacement = "import app from './preview-free-actions'\n\n// Register public Demo IA on the fully assembled Preview app.\n// index.ts also registers it for the production entry; this explicit Preview\n// registration avoids the circular preview-entry assembly dropping the route.\nregisterDemoAiRoutes(app)\n\nexport default app"
if needle in s:
    s = s.replace(needle, replacement)
elif "registerDemoAiRoutes(app)" not in s:
    raise SystemExit('No pude localizar el punto final de ensamblaje Preview')

p.write_text(s)
print('✓ Demo IA registrada explícitamente sobre el app final de Preview')
