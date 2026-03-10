module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                intap: {
                    dark: '#030712',
                    card: '#111827',
                    mint: '#0df2c9',
                    blue: '#3b82f6',
                }
            },
            borderRadius: {
                '3xl': '24px',
                '4xl': '32px',
            }
        },
    },
    plugins: [],
}
