import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const apiUrl = (env.VITE_API_URL || 'https://api.intaprd.com').replace(/\/$/, '')

    return {
    plugins: [react()],
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
