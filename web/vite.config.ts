import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ADMIN_APP_URLS = {
    production: 'https://app.intaprd.com',
    preview: 'https://app.preview.intaprd.com',
} as const

function cloudflareRedirects(mode: string) {
    const environment = mode === 'preview' ? 'preview' : 'production'
    const adminAppUrl = ADMIN_APP_URLS[environment]
    let outputDirectory = ''

    return {
        name: 'cloudflare-redirects-by-environment',
        apply: 'build' as const,
        configResolved(config) {
            outputDirectory = resolve(config.root, config.build.outDir)
        },
        closeBundle() {
            const redirects = [
                `/admin ${adminAppUrl}/admin/login 302`,
                `/admin/* ${adminAppUrl}/admin/:splat 302`,
                '/* /index.html 200',
                '',
            ].join('\n')

            writeFileSync(resolve(outputDirectory, '_redirects'), redirects, 'utf8')
        },
    }
}

export default defineConfig(({ mode }) => ({
    plugins: [react(), cloudflareRedirects(mode)],
    base: '/',
    server: {
        proxy: {
            '/api': {
                target: 'https://intaprd.com',
                changeOrigin: true,
            }
        }
    }
}))
