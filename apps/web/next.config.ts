import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@peerstock/shared", "@peerstock/pricing", "@peerstock/db"],
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
