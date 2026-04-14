import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const isProd = process.env.NODE_ENV === 'production';
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
const isDocker = process.env.DOCKER_BUILD === 'true';

// GitHub Pages requires basePath when deploying to a repository subdirectory
const basePath = process.env.BASE_PATH || (isProd && isGitHubPages ? '/llka-verwaltung' : '');

// Use 'standalone' for Docker builds, 'export' for GitHub Pages/static hosting
const outputMode = isDocker ? 'standalone' : 'export';

// Resolve build metadata (app version + short git commit) so we can show
// it in the menu footer. Read package.json at config time rather than
// bundling it client-side.
const appVersion = (() => {
  try {
    return JSON.parse(readFileSync('./package.json', 'utf-8')).version as string;
  } catch {
    return 'unknown';
  }
})();

// Allow CI to pass the commit SHA explicitly (useful in containers where
// `git` isn't available), otherwise fall back to shelling out. Falls back
// silently to 'dev' if neither works.
const buildCommit = (() => {
  if (process.env.BUILD_COMMIT) return process.env.BUILD_COMMIT;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
})();

const nextConfig: NextConfig = {
  output: outputMode,

  basePath,

  // Expose basePath + build metadata to client-side code.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit,
  },

  // Required for static export (also helps with standalone)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;