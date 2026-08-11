import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const apiUrl = (env.VITE_API_URL || 'https://api.intaprd.com').replace(/\/$/, '')
    const appUrl = (env.VITE_APP_URL || 'https://app.intaprd.com').replace(/\/$/, '')

    return {
    plugins: [
        react(),
        {
            name: 'intap-pages-redirects-by-mode',
            generateBundle() {
                this.emitFile({
                    type: 'asset',
                    fileName: '_redirects',
                    source: `/admin ${appUrl}/admin/login 302\n/admin/* ${appUrl}/admin/:splat 302\n`,
                })
            },
        },
    ],
    base: '/',
    server: {
        proxy: {
            '/api': {
                target: apiUrl,
                changeOrigin: true,
            }
        }
    }
    }
})
