import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const repositoryName = "OpenTaigi";

const nextConfig: NextConfig = {
  output: isGitHubPages ? "export" : undefined,
  basePath: isGitHubPages ? `/${repositoryName}` : "",
  assetPrefix: isGitHubPages ? `/${repositoryName}/` : "",
  trailingSlash: isGitHubPages,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: isGitHubPages,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
