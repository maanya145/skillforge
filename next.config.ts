import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Mastra resolves providers dynamically and `pg`/`unpdf` ship prebuilt bundles.
  // Keeping them external stops the bundler trying to statically analyse them.
  serverExternalPackages: [
    '@mastra/core',
    '@mastra/memory',
    '@mastra/pg',
    '@mastra/ai-sdk',
    'pg',
    'unpdf',
  ],
}

export default nextConfig
