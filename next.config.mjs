import withPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = withPWA({
    dest: 'public',
    register: true,
    skipWaiting: true,
    experimental: {
        proxyClientMaxBodySize: '50mb', // bigger than your largest expected PDF
    },
});

/** Add Next.js options outside of PWA config */
export default {
    ...nextConfig,
    reactStrictMode: true,
};
