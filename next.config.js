
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    // This is the experimental block.
  },
  // The 'allowedDevOrigins' key should be at the top level, not inside 'experimental'.
  // This configuration is necessary to prevent cross-origin errors in the development environment.
  allowedDevOrigins: ["*.cloudworkstations.dev"],
};

module.exports = nextConfig;
