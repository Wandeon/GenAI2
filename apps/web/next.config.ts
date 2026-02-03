import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode
  reactStrictMode: true,

  // Transpile workspace packages
  transpilePackages: ["@genai/ui", "@genai/trpc", "@genai/shared"],

  // Note: typedRoutes disabled during scaffold phase
  // Enable when routes are finalized
};

export default nextConfig;
