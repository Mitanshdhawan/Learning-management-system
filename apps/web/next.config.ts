import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Compile the workspace packages (they ship TS source, not built JS).
  transpilePackages: ['@toplms/validation'],
}

export default nextConfig
