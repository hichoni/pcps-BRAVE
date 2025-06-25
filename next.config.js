
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
  // This configuration is necessary to prevent cross-origin errors in the development environment.
  // It should be at the top level, not inside 'experimental'.
  allowedDevOrigins: ["*.cloudworkstations.dev"],
};

module.exports = nextConfig;
