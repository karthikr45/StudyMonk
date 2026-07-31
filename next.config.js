/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // pdf-parse (pdfjs) uses dynamic requires — keep it out of the bundle so it
  // loads correctly at runtime for AI question generation from PDFs.
  experimental: { serverComponentsExternalPackages: ['pdf-parse'] },
  async headers() {
    return [
      {
        // Security headers applied to every response
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
