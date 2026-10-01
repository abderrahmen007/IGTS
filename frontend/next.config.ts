import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Public demo links (tunnels) may load the dev server from these hosts
  allowedDevOrigins: [
    '*.trycloudflare.com',
    '*.serveousercontent.com',
    '*.loca.lt',
  ],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*', // Proxy to NestJS backend
      },
    ];
  },
};

export default nextConfig;
