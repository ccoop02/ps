import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@peerstock/shared", "@peerstock/pricing"],
};

export default nextConfig;
