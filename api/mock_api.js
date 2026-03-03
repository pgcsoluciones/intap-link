const http = require('http');

const PORT = 8787;

const profileData = {
    ok: true,
    data: {
        id: 'profile_debug',
        slug: 'test-valida',
        name: 'Juan Luis Pérez',
        bio: 'Arquitecto de Soluciones Cloud & Director de INTAP LINK.',
        theme_id: 'classic',
        is_published: true,
        links: [
            { id: 'l1', label: 'LinkedIn Profesional', url: 'https://linkedin.com/in/juanluis' },
            { id: 'l2', label: 'Instagram Personal', url: 'https://instagram.com/juanluis' },
            { id: 'l3', label: 'WhatsApp Directo', url: 'https://wa.me/123456789' }
        ],
        faqs: [
            { question: '¿Qué es INTAP LINK?', answer: 'Es la plataforma SaaS líder para la gestión de identidades digitales modulares en Cloudflare.' },
            { question: '¿Cómo adquiero el plan PRO?', answer: 'Puedes hacerlo directamente desde tu dashboard haciendo clic en Desbloquear PRO.' }
        ],
        gallery: [
            { id: 'g1', image_key: 'media__1771217209676.jpg' },
            { id: 'g2', image_key: 'media__1771217209763.jpg' },
            { id: 'g3', image_key: 'media__1771217209676.jpg' }
        ],
        entitlements: { canUseVCard: true, maxLinks: 20, maxPhotos: 15, maxFaqs: 10 }
    }
};

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url.includes('/api/v1/public/profiles/test-valida') || req.url.includes('/api/v1/profile/me/profile_debug')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(profileData));
    } else if (req.url.includes('/api/v1/profile/settings') && req.method === 'PATCH') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const data = JSON.parse(body);
            profileData.data.name = data.name || profileData.data.name;
            profileData.data.bio = data.bio || profileData.data.bio;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
        });
    } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
    }
});

server.listen(PORT, () => {
    console.log(`Mock API running on http://localhost:${PORT}`);
});
