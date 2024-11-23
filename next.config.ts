import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externalsPresets = { ...config.externalsPresets, node: true };
    }
    return config;
  },
};

export default nextConfig;
