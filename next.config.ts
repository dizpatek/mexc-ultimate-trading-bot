import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    reactCompiler: true,
  },
  output: 'standalone',
  transpilePackages: ['lightweight-charts'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        tls: false,
        net: false,
        fs: false,
        dns: false,
        child_process: false,
      };
    }
    return config;
  },
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
