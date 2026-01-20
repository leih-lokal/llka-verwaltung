import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
const isDocker = process.env.DOCKER_BUILD === 'true';

// GitHub Pages requires basePath when deploying to a repository subdirectory
const basePath = process.env.BASE_PATH || (isProd && isGitHubPages ? '/llka-verwaltung' : '');

// Use 'standalone' for Docker builds, 'export' for GitHub Pages/static hosting
const outputMode = isDocker ? 'standalone' : 'export';

const nextConfig: NextConfig = {
  output: outputMode,

  basePath,

  // Expose basePath to client-side code for asset paths
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },

  // Required for static export (also helps with standalone)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;