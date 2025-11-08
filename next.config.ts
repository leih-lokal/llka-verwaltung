import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

const nextConfig: NextConfig = {
  output: 'export',

  // GitHub Pages requires basePath when deploying to a repository subdirectory
  basePath: isProd && isGitHubPages ? '/llka-verwaltung' : '',

  // Required for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
