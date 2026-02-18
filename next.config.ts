import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  transpilePackages: ['lightweight-charts'],
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
