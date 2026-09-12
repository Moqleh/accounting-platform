import type { NextConfig } from 'next';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
const repoBasePath = '/accounting-platform';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  basePath: isGitHubPages ? repoBasePath : '',
  assetPrefix: isGitHubPages ? `${repoBasePath}/` : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
