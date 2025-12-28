import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
// GitHub Pages requires basePath when deploying to a repository subdirectory
const basePath = process.env.BASE_PATH || (isProd && isGitHubPages ? '/llka-verwaltung' : '')

const nextConfig: NextConfig = {
  output: 'export',

  basePath,

  // Expose basePath to client-side code for asset paths
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },

  // Required for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;