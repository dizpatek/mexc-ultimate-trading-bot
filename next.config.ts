import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  /* config options here */
  reactCompiler: true,
  transpilePackages: ['lightweight-charts'],
  turbopack: {},
  async rewrites() {
    return [
      {
        source: '/command-deck/:path*',
        destination: '/api/command-deck/:path*',
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.iconify.design',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.cryptocompare.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.cryptocompare.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
