import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '8f1e1dae249307fc-196-238-52-94.serveousercontent.com',
    'igts-veille.loca.lt'
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
